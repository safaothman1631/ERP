"""Central Bank of Iraq (CBI) exchange-rate fetcher (growth-to-100 § R4.15).

Fetches the daily official IQD↔USD rate from CBI and persists to Firestore at
``cbi_rates/{yyyy-mm-dd}``. A daily APScheduler cron job at 09:00 Baghdad
local time is added in ``app.services.scheduler``.

The public CBI URL is a **placeholder** pending R7.6 verification:

    https://cbi.iq/en/api/exchange-rate   (real endpoint TBD)

When the live endpoint is unavailable (network failure, schema change), the
fetcher falls back to *yesterday's* persisted rate so the UI keeps working —
``source="fallback"`` is recorded so accounting can see this happened.

Tests in ``backend/tests/test_cbi_rates.py`` patch the HTTP layer; no real
network call is required.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, date, timedelta
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────

# Placeholder URL until R7.6 sign-off. Override via env in production.
CBI_API_URL = os.getenv(
    "CBI_API_URL",
    "https://cbi.iq/en/api/exchange-rate",  # placeholder
)
CBI_API_TIMEOUT_SECONDS = float(os.getenv("CBI_API_TIMEOUT", "10"))

# Conservative bundled rate of last resort. Keeps formatting working when the
# Firestore lookup also misses. Audited via ``source="hardcoded_fallback"``.
HARDCODED_FALLBACK_IQD_PER_USD = 1320.0

CBI_COLLECTION = "cbi_rates"


# ─────────────────────────────────────────────────────────────────────────
# Persistence
# ─────────────────────────────────────────────────────────────────────────


def _doc_id(on_date: date) -> str:
    return on_date.isoformat()


def _get_db():
    try:
        from app.firebase_client import get_db
        return get_db()
    except Exception:  # pragma: no cover - tests patch get_rate / store_rate
        return None


def store_rate(
    on_date: date,
    rate: float,
    *,
    source: str = "cbi",
    metadata: Optional[dict] = None,
) -> dict:
    """Persist a daily rate document at ``cbi_rates/{yyyy-mm-dd}``.

    Returns the saved record (also when the DB layer is unavailable — the
    record is returned without persisting so tests stay deterministic).
    """
    doc = {
        "id": _doc_id(on_date),
        "rate_date": on_date.isoformat(),
        "from_currency": "USD",
        "to_currency": "IQD",
        "rate": float(rate),
        "source": source,
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "metadata": metadata or {},
    }
    db = _get_db()
    if db is not None:
        try:
            db.collection(CBI_COLLECTION).document(_doc_id(on_date)).set(doc)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("CBI rate persist failed for %s: %s", on_date, exc)
    return doc


def get_rate(on_date: Optional[date] = None) -> Optional[dict]:
    """Return the rate document for the date, or ``None`` if not stored.

    Does **not** fall back to other dates — that is the caller's choice
    (``get_latest_rate_with_fallback`` does the fallback walk).
    """
    target = on_date or date.today()
    db = _get_db()
    if db is None:
        return None
    try:
        snap = db.collection(CBI_COLLECTION).document(_doc_id(target)).get()
        if snap.exists:
            return snap.to_dict()
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("CBI rate read failed for %s: %s", target, exc)
    return None


def get_latest_rate_with_fallback(on_date: Optional[date] = None) -> dict:
    """Return today's rate; on miss, walk back up to 7 days; finally hard-coded.

    Always returns a dict — never ``None`` — so the UI can always display
    something. Caller can inspect ``source`` to know whether this is fresh.
    """
    target = on_date or date.today()
    for offset in range(0, 8):  # today + 7 days back
        candidate = target - timedelta(days=offset)
        doc = get_rate(candidate)
        if doc:
            if offset > 0:
                doc = {**doc, "source": "fallback", "fallback_age_days": offset}
            return doc
    return {
        "id": _doc_id(target),
        "rate_date": target.isoformat(),
        "from_currency": "USD",
        "to_currency": "IQD",
        "rate": HARDCODED_FALLBACK_IQD_PER_USD,
        "source": "hardcoded_fallback",
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "metadata": {"reason": "no CBI rate in Firestore for last 7 days"},
    }


# ─────────────────────────────────────────────────────────────────────────
# Network fetch
# ─────────────────────────────────────────────────────────────────────────


def _parse_cbi_response(payload) -> Optional[float]:
    """Extract an IQD-per-USD float from a CBI-shaped JSON blob.

    The real CBI schema is not yet documented (R7.6); we tolerate several
    plausible shapes so the integration can light up the moment the real
    endpoint is approved without code changes here.
    """
    if not payload:
        return None
    # Shape A: {"rate": 1320.0}
    if isinstance(payload, dict):
        for key in ("rate", "USD", "usd", "value"):
            if key in payload:
                try:
                    return float(payload[key])
                except (TypeError, ValueError):
                    pass
        # Shape B: {"data": [{"currency": "USD", "rate": 1320.0}, …]}
        for collection_key in ("data", "rates", "results"):
            rows = payload.get(collection_key)
            if isinstance(rows, list):
                for row in rows:
                    if not isinstance(row, dict):
                        continue
                    if str(row.get("currency", "")).upper() == "USD":
                        try:
                            return float(row.get("rate") or row.get("value"))
                        except (TypeError, ValueError):
                            pass
    # Shape C: bare number
    try:
        return float(payload)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def fetch_cbi_usd_iqd_rate() -> Optional[float]:
    """One-shot HTTP fetch. Returns ``None`` on any failure.

    The scheduler job uses this; the API does not call it synchronously.
    """
    try:
        with httpx.Client(timeout=CBI_API_TIMEOUT_SECONDS) as client:
            resp = client.get(CBI_API_URL)
            resp.raise_for_status()
            try:
                data = resp.json()
            except ValueError:
                data = resp.text
            rate = _parse_cbi_response(data)
            if rate and rate > 0:
                return rate
            logger.warning("CBI response had no usable rate: %s", data)
            return None
    except Exception as exc:
        logger.warning("CBI fetch failed (placeholder endpoint?): %s", exc)
        return None


def refresh_today_rate() -> dict:
    """Cron entrypoint — fetch today's rate and persist it.

    On HTTP failure, the function records a fallback document so the report
    surface can see *something happened today*; the value comes from the
    previous day.
    """
    today = date.today()
    rate = fetch_cbi_usd_iqd_rate()
    if rate is not None and rate > 0:
        return store_rate(today, rate, source="cbi", metadata={"url": CBI_API_URL})

    # Fallback path — record the miss explicitly.
    yesterday = get_rate(today - timedelta(days=1))
    fallback_rate = (yesterday or {}).get("rate") or HARDCODED_FALLBACK_IQD_PER_USD
    return store_rate(
        today,
        float(fallback_rate),
        source="fallback",
        metadata={"reason": "CBI fetch failed or returned no rate", "url": CBI_API_URL},
    )
