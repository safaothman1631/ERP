"""TMS (Transportation Management) repositories (Pool 3.5 buildout).

Carriers and shipments scoped under an org_id, persisting the freight/route
data produced by the pure ``app.services.tms_rating`` engine.
"""
from app.firestore.base import BaseRepository


class CarrierRepository(BaseRepository):
    """Repository for freight carriers / transport providers."""
    collection_name = "tms_carriers"


class ShipmentRepository(BaseRepository):
    """Repository for outbound/inbound shipments (rated + routed)."""
    collection_name = "tms_shipments"
