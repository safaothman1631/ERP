"""Smoke test for Phase 10 CRM Pipeline Service."""
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from app.firebase_client import init_firebase
from app.services.crm import CRMService

init_firebase()
results = []


def _assert(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((status, name, detail))
    print(f"  [{status}] {name}{(' - ' + detail) if detail else ''}")


def t1_lead_score_cold():
    print("\nT1 - cold lead (minimal data)")
    lead = {"email": "x@y.com"}
    out = CRMService.compute_lead_score(lead)
    _assert("score == 5", out["score"] == 5)
    _assert("grade cold", out["grade"] == "cold")


def t2_lead_score_hot_full():
    """Lead with everything: email+phone+large+referral+high engagement+recent+full BANT."""
    print("\nT2 - hot lead (every signal)")
    now = datetime(2026, 4, 30)
    lead = {
        "email": "ceo@bigco.com", "phone": "0750-...",
        "company_size": 500, "source": "referral",
        "interactions_count": 8,
        "last_activity_at": datetime(2026, 4, 28),  # 2 days ago
        "budget_confirmed": True, "authority_confirmed": True,
        "need_confirmed": True, "timing_confirmed": True,
    }
    out = CRMService.compute_lead_score(lead, as_of=now)
    # 5 + 5 + 15 + 20 + 15 + 10 + 28 = 98
    _assert("score 98", out["score"] == 98, str(out["score"]))
    _assert("grade hot", out["grade"] == "hot")


def t3_lead_score_capped_at_100():
    """If weights overflow, cap at 100."""
    print("\nT3 - score capped at 100")
    # Build a lead that would naturally overflow if more weights existed
    now = datetime(2026, 4, 30)
    lead = {
        "email": "x", "phone": "y", "company_size": 200, "source": "referral",
        "interactions_count": 50,
        "last_activity_at": now,
        "budget_confirmed": True, "authority_confirmed": True,
        "need_confirmed": True, "timing_confirmed": True,
    }
    out = CRMService.compute_lead_score(lead, as_of=now)
    _assert("score <= 100", out["score"] <= 100)


def t4_advance_stage_valid():
    print("\nT4 - valid stage transitions")
    _assert("new->qualified", CRMService.advance_stage("new", "qualified")["allowed"])
    _assert("qualified->proposal",
            CRMService.advance_stage("qualified", "proposal")["allowed"])
    _assert("negotiation->won",
            CRMService.advance_stage("negotiation", "won")["allowed"])


def t5_advance_stage_invalid():
    print("\nT5 - invalid transitions blocked")
    r = CRMService.advance_stage("new", "won")
    _assert("new->won blocked", not r["allowed"])
    r2 = CRMService.advance_stage("won", "qualified")
    _assert("won->qualified blocked", not r2["allowed"])


def t6_advance_stage_reopen_lost():
    print("\nT6 - reopening lost is allowed")
    r = CRMService.advance_stage("lost", "qualified")
    _assert("lost->qualified allowed", r["allowed"])


def t7_summarize_pipeline():
    print("\nT7 - summarize_pipeline aggregates")
    opps = [
        {"stage": "qualified", "value": 1000},
        {"stage": "qualified", "value": 2000},
        {"stage": "negotiation", "value": 5000},
        {"stage": "won", "value": 10000},
        {"stage": "lost", "value": 999},
    ]
    s = CRMService.summarize_pipeline(opps)
    _assert("qualified count 2", s["by_stage"]["qualified"]["count"] == 2)
    _assert("qualified value 3000", s["by_stage"]["qualified"]["value"] == 3000.0)
    _assert("active count 3 (excludes won+lost)", s["active_count"] == 3,
            str(s["active_count"]))
    _assert("active value = 1000+2000+5000 = 8000",
            s["active_value"] == 8000.0, str(s["active_value"]))


def t8_forecast_revenue():
    """Won 10k counted at 100%; qualified 5k * 0.3 = 1500;
    proposal 8k * 0.5 = 4000; lost ignored. Total weighted = 15500"""
    print("\nT8 - forecast_revenue weighted")
    opps = [
        {"stage": "won", "value": 10000, "win_probability": 0.5},  # ignored prob
        {"stage": "qualified", "value": 5000, "win_probability": 0.3},
        {"stage": "proposal", "value": 8000, "win_probability": 0.5},
        {"stage": "lost", "value": 50000, "win_probability": 0.9},  # excluded
    ]
    f = CRMService.forecast_revenue(opps)
    _assert("won_total 10000", f["won_total"] == 10000.0)
    _assert("weighted 15500", f["weighted_forecast"] == 15500.0,
            str(f["weighted_forecast"]))


def t9_stale_opportunities():
    print("\nT9 - detect_stale_opportunities")
    now = datetime(2026, 4, 30)
    opps = [
        {"id": "O1", "stage": "qualified",
         "last_activity_at": datetime(2026, 4, 1)},   # 29 days idle
        {"id": "O2", "stage": "proposal",
         "last_activity_at": datetime(2026, 4, 25)},  # 5 days idle
        {"id": "O3", "stage": "negotiation",
         "last_activity_at": None},                    # never => stale
        {"id": "O4", "stage": "won",
         "last_activity_at": datetime(2025, 1, 1)},   # terminal => excluded
        {"id": "O5", "stage": "lost",
         "last_activity_at": datetime(2025, 1, 1)},   # terminal => excluded
    ]
    out = CRMService.detect_stale_opportunities(opps, days_threshold=14, as_of=now)
    ids = [o["id"] for o in out]
    _assert("O1 + O3 stale", set(ids) == {"O1", "O3"}, str(ids))
    _assert("O2 not stale (5 days)", "O2" not in ids)
    _assert("won/lost excluded", "O4" not in ids and "O5" not in ids)


def t10_score_breakdown_keys():
    print("\nT10 - score breakdown lists rule names + points")
    lead = {"email": "x", "phone": "y", "source": "website"}
    out = CRMService.compute_lead_score(lead)
    keys = [b[0] for b in out["breakdown"]]
    _assert("has has_email", "has_email" in keys)
    _assert("has has_phone", "has_phone" in keys)
    _assert("has source_website", "source_website" in keys)


def main():
    print("=" * 70)
    print("PHASE 10 SMOKE TEST - CRM Pipeline (Lead Score + Forecast)")
    print("=" * 70)
    t1_lead_score_cold()
    t2_lead_score_hot_full()
    t3_lead_score_capped_at_100()
    t4_advance_stage_valid()
    t5_advance_stage_invalid()
    t6_advance_stage_reopen_lost()
    t7_summarize_pipeline()
    t8_forecast_revenue()
    t9_stale_opportunities()
    t10_score_breakdown_keys()

    print("\n" + "=" * 70)
    p = sum(1 for r in results if r[0] == "PASS")
    f = sum(1 for r in results if r[0] == "FAIL")
    print(f"RESULT: {p} PASS, {f} FAIL")
    print("=" * 70)
    if f:
        for s, n, d in results:
            if s == "FAIL":
                print(f"  FAIL: {n} - {d}")
    return 0 if f == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
