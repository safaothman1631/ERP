"""
/api/v1/ versioned router — aggregates all v1 sub-routers.

داواکاری ٧.٣: API versioning `/api/v1/`

This module creates a single APIRouter with prefix="/api/v1" that includes
all resource-specific v1 routers. Register it in main.py:

    from app.api.v1.router import v1_router
    app.include_router(v1_router)
"""

from fastapi import APIRouter

from app.api.v1 import contacts as v1_contacts
from app.api.v1 import invoices as v1_invoices
from app.api.v1 import items as v1_items
from app.api.v1 import accounts as v1_accounts
from app.api.v1 import journals as v1_journals
from app.api.v1 import bills as v1_bills
from app.api.v1 import purchase_orders as v1_purchase_orders
from app.api.v1 import sales_orders as v1_sales_orders
from app.api.v1 import payments as v1_payments

v1_router = APIRouter(prefix="/api/v1", tags=["v1"])

# Register resource routers (each has its own prefix relative to /api/v1)
v1_router.include_router(v1_contacts.router)
v1_router.include_router(v1_invoices.router)
v1_router.include_router(v1_items.router)
v1_router.include_router(v1_accounts.router)
v1_router.include_router(v1_journals.router)
v1_router.include_router(v1_bills.router)
v1_router.include_router(v1_purchase_orders.router)
v1_router.include_router(v1_sales_orders.router)
v1_router.include_router(v1_payments.router)
