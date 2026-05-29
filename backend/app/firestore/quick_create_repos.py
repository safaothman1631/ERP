"""Firestore repositories backing the quick-create endpoints.

Deliberately no ``WRITE_MODEL`` is set: ``BaseRepository.create`` only runs the
permissive generic validator (which drops undeclared fields) when a write model
is present. Input validation already happens at the FastAPI layer via the
``*Create`` request models, so these repos persist the full payload as-is.
"""
from __future__ import annotations

from app.firestore.base import BaseRepository


class ExpenseCategoryRepository(BaseRepository):
    collection_name = "expense_categories"


class EquipmentCategoryRepository(BaseRepository):
    collection_name = "equipment_categories"


class CurrencyRepository(BaseRepository):
    collection_name = "currencies"


class TagRepository(BaseRepository):
    collection_name = "tags"


class PaymentMethodRepository(BaseRepository):
    collection_name = "payment_methods"


class TeamRepository(BaseRepository):
    collection_name = "teams"


class BusinessLocationRepository(BaseRepository):
    """Business/operating locations (warehouse, retail, kitchen, office).

    Distinct from ``app.firestore.locations.LocationRepository`` which models
    stock sub-locations (zone/aisle/bin) and requires a parent warehouse.
    """

    collection_name = "business_locations"
