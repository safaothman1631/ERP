"""CRM Pipeline Service - Phase 10

Provides:
- compute_lead_score(lead): rule-based score 0..100 with breakdown
- advance_stage(lead, target_stage): validate stage transition
- summarize_pipeline(opportunities): aggregate value/count by stage
- forecast_revenue(opportunities): weighted by win_probability
- detect_stale_opportunities(opportunities, days): no activity in N days

Lead document fields used:
- email (str), phone (str), company_size (int), industry (str)
- source (str: website/referral/event/cold_call/import)
- last_activity_at (datetime), interactions_count (int)
- budget_confirmed (bool), authority_confirmed (bool)
- need_confirmed (bool), timing_confirmed (bool)  # BANT

Opportunity document fields:
- stage (str), value (float), win_probability (0..1)
- expected_close_date, last_activity_at
"""
from datetime import datetime, timedelta
from typing import Optional


# Lead score weights (tunable)
SCORE_WEIGHTS = {
    "has_email": 5,
    "has_phone": 5,
    "company_size_large": 15,    # >= 100
    "company_size_medium": 10,   # 25..99
    "company_size_small": 5,     # 1..24
    "source_referral": 20,
    "source_event": 12,
    "source_website": 8,
    "source_cold_call": 3,
    "source_import": 1,
    "high_engagement": 15,       # >= 5 interactions
    "med_engagement": 8,         # 2..4
    "recent_activity": 10,       # within 7 days
    "bant_each": 7,              # +7 per confirmed BANT criterion
}

# Standard B2B pipeline stages
PIPELINE_STAGES = [
    "new", "qualified", "proposal", "negotiation", "won", "lost",
]
TERMINAL_STAGES = {"won", "lost"}

# Allowed stage transitions (forward + back to qualified for re-engagement)
ALLOWED_TRANSITIONS = {
    "new":         {"qualified", "lost"},
    "qualified":   {"proposal", "lost"},
    "proposal":    {"negotiation", "qualified", "lost"},
    "negotiation": {"won", "lost", "proposal"},
    "won":         set(),
    "lost":        {"qualified"},   # reopen
}


def _to_dt(v) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, str):
        try:
            s = v.replace(" ", "T").rstrip("Z")
            if len(s) == 10:
                s += "T00:00:00"
            return datetime.fromisoformat(s)
        except Exception:
            return None
    return None


class CRMService:

    @staticmethod
    def compute_lead_score(lead: dict, as_of: Optional[datetime] = None) -> dict:
        """Score 0..100 with per-rule breakdown."""
        as_of = as_of or datetime.utcnow()
        score = 0
        breakdown = []

        if lead.get("email"):
            score += SCORE_WEIGHTS["has_email"]
            breakdown.append(("has_email", SCORE_WEIGHTS["has_email"]))
        if lead.get("phone"):
            score += SCORE_WEIGHTS["has_phone"]
            breakdown.append(("has_phone", SCORE_WEIGHTS["has_phone"]))

        size = int(lead.get("company_size", 0) or 0)
        if size >= 100:
            score += SCORE_WEIGHTS["company_size_large"]
            breakdown.append(("company_size_large", SCORE_WEIGHTS["company_size_large"]))
        elif size >= 25:
            score += SCORE_WEIGHTS["company_size_medium"]
            breakdown.append(("company_size_medium", SCORE_WEIGHTS["company_size_medium"]))
        elif size >= 1:
            score += SCORE_WEIGHTS["company_size_small"]
            breakdown.append(("company_size_small", SCORE_WEIGHTS["company_size_small"]))

        source_key = f"source_{lead.get('source', '').lower()}"
        if source_key in SCORE_WEIGHTS:
            score += SCORE_WEIGHTS[source_key]
            breakdown.append((source_key, SCORE_WEIGHTS[source_key]))

        interactions = int(lead.get("interactions_count", 0) or 0)
        if interactions >= 5:
            score += SCORE_WEIGHTS["high_engagement"]
            breakdown.append(("high_engagement", SCORE_WEIGHTS["high_engagement"]))
        elif interactions >= 2:
            score += SCORE_WEIGHTS["med_engagement"]
            breakdown.append(("med_engagement", SCORE_WEIGHTS["med_engagement"]))

        last_act = _to_dt(lead.get("last_activity_at"))
        if last_act and (as_of - last_act).days <= 7:
            score += SCORE_WEIGHTS["recent_activity"]
            breakdown.append(("recent_activity", SCORE_WEIGHTS["recent_activity"]))

        for bant_field in ("budget_confirmed", "authority_confirmed",
                           "need_confirmed", "timing_confirmed"):
            if lead.get(bant_field):
                score += SCORE_WEIGHTS["bant_each"]
                breakdown.append((bant_field, SCORE_WEIGHTS["bant_each"]))

        score = max(0, min(100, score))

        if score >= 70:
            grade = "hot"
        elif score >= 40:
            grade = "warm"
        else:
            grade = "cold"

        return {"score": score, "grade": grade, "breakdown": breakdown}

    @staticmethod
    def advance_stage(current_stage: str, target_stage: str) -> dict:
        """Validate a stage transition. Returns {allowed, reason}."""
        if current_stage == target_stage:
            return {"allowed": False, "reason": "Already in this stage"}
        if current_stage not in ALLOWED_TRANSITIONS:
            return {"allowed": False, "reason": f"Unknown current stage: {current_stage}"}
        if target_stage not in PIPELINE_STAGES:
            return {"allowed": False, "reason": f"Unknown target stage: {target_stage}"}
        if target_stage in ALLOWED_TRANSITIONS[current_stage]:
            return {"allowed": True, "reason": None}
        return {
            "allowed": False,
            "reason": f"Transition {current_stage} -> {target_stage} not allowed",
        }

    @staticmethod
    def summarize_pipeline(opportunities: list[dict]) -> dict:
        """Aggregate count + total value by stage."""
        summary = {s: {"count": 0, "value": 0.0} for s in PIPELINE_STAGES}
        for o in opportunities:
            s = o.get("stage", "new")
            if s not in summary:
                continue
            summary[s]["count"] += 1
            summary[s]["value"] += float(o.get("value", 0) or 0)

        for s in summary:
            summary[s]["value"] = round(summary[s]["value"], 2)

        active_count = sum(
            v["count"] for k, v in summary.items() if k not in TERMINAL_STAGES
        )
        active_value = round(sum(
            v["value"] for k, v in summary.items() if k not in TERMINAL_STAGES
        ), 2)

        return {
            "by_stage": summary,
            "active_count": active_count,
            "active_value": active_value,
        }

    @staticmethod
    def forecast_revenue(opportunities: list[dict]) -> dict:
        """Weighted forecast: sum(value * win_probability) for non-terminal opps.

        Won is counted at 100%; Lost excluded. Otherwise uses opp's `win_probability`.
        """
        weighted = 0.0
        won_total = 0.0
        for o in opportunities:
            stage = o.get("stage", "new")
            value = float(o.get("value", 0) or 0)
            if stage == "lost":
                continue
            if stage == "won":
                won_total += value
                weighted += value
                continue
            prob = float(o.get("win_probability", 0) or 0)
            weighted += value * prob

        return {
            "weighted_forecast": round(weighted, 2),
            "won_total": round(won_total, 2),
        }

    @staticmethod
    def detect_stale_opportunities(
        opportunities: list[dict],
        days_threshold: int = 14,
        as_of: Optional[datetime] = None,
    ) -> list[dict]:
        """Return non-terminal opps with no activity for `days_threshold` days."""
        as_of = as_of or datetime.utcnow()
        cutoff = as_of - timedelta(days=days_threshold)
        out = []
        for o in opportunities:
            if o.get("stage") in TERMINAL_STAGES:
                continue
            last = _to_dt(o.get("last_activity_at"))
            if last is None or last < cutoff:
                days_idle = None
                if last is not None:
                    days_idle = (as_of - last).days
                out.append({**o, "days_idle": days_idle})
        out.sort(key=lambda x: x.get("days_idle") or 9999, reverse=True)
        return out
