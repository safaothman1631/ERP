"""RUM ingest endpoint (T-0.1, R6.1, R6.2).

POST /api/rum/vitals — receives batched Core Web Vitals events from the
browser. Validates with Pydantic, hands off to the ingest service which
batches and (optionally) streams into BigQuery.

The endpoint is intentionally permissive: it must never break the user's
experience, so validation errors return 422 with a tight error body and
unknown fields are ignored (forward-compat).
"""

from __future__ import annotations

from typing import List, Literal, Optional

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.services.rum_ingest import get_rum_ingest_service

router = APIRouter(prefix="/api/rum", tags=["rum"])


# --- Schema (design §3.5) -------------------------------------------------

DeviceClass = Literal[
    "mobile-low", "mobile-mid", "mobile-high", "tablet", "desktop"
]
NetworkClass = Literal["slow-2g", "2g", "3g", "4g", "wifi", "unknown"]
VitalName = Literal["LCP", "INP", "CLS", "TTFB", "FCP"]
VitalRating = Literal["good", "needs-improvement", "poor"]


class VitalEvent(BaseModel):
    """One Core Web Vitals data point captured in the browser."""

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    sessionId: str = Field(min_length=1, max_length=128)
    appVersion: str = Field(min_length=1, max_length=64)
    route: str = Field(min_length=1, max_length=512)
    deviceClass: DeviceClass
    network: NetworkClass
    metric: VitalName
    value: float = Field(ge=0)
    rating: VitalRating
    ts: Optional[int] = Field(
        default=None,
        description="Client ms-epoch when the metric was captured.",
    )


class VitalBatch(BaseModel):
    """Body of POST /api/rum/vitals — a batch of events."""

    model_config = ConfigDict(extra="ignore")

    events: List[VitalEvent] = Field(min_length=1, max_length=200)


class VitalAck(BaseModel):
    """Lean ack to avoid wasting bytes on the response path."""

    accepted: int


# --- Endpoint -------------------------------------------------------------


@router.post(
    "/vitals",
    response_model=VitalAck,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingest a batch of Core Web Vitals events from a browser session.",
)
async def ingest_vitals(batch: VitalBatch, request: Request) -> JSONResponse:
    """Accept and enqueue a batch of RUM vitals events.

    The handler returns 202 quickly; flushing is asynchronous. Tenant id is
    pulled from request state when available (set by tenant middleware), but
    is optional here — RUM is allowed for unauthenticated routes (login,
    landing) which precede tenant resolution.
    """
    tenant_id = getattr(request.state, "tenant_id", None)
    service = get_rum_ingest_service()
    await service.enqueue(batch.events, tenant_id=tenant_id)
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"accepted": len(batch.events)},
    )
