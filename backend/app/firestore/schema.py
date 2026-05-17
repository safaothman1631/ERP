"""
Firestore Schema Documentation
================================
ستراکچەری کۆلێکشنەکانی Firestore بۆ سیستەمی ERP

Root structure:
    organizations/{org_id}/          ← هەموو داتای org لەژێر ئەم collection ەدا
        users/{user_id}
        contacts/{contact_id}
        items/{item_id}
        invoices/{invoice_id}
            lines/{line_id}
        quotes/{quote_id}
            lines/{line_id}
        sales_orders/{so_id}
            lines/{line_id}
        credit_notes/{cn_id}
            lines/{line_id}
            applications/{app_id}
        purchase_orders/{po_id}
            lines/{line_id}
        bills/{bill_id}
            lines/{line_id}
        payments_received/{payment_id}
            allocations/{alloc_id}
        payments_made/{payment_id}
            allocations/{alloc_id}
        journal_entries/{entry_id}
            lines/{line_id}
        accounts/{account_id}
        taxes/{tax_id}
        hr_employees/{employee_id}
        hr_contracts/{contract_id}
        hr_attendance/{record_id}
        hr_time_off/{record_id}
        hr_departments/{dept_id}
        hr_positions/{pos_id}
        hr_leave_types/{type_id}
        hr_leave_allocations/{alloc_id}
        payroll_runs/{run_id}
            payslips/{slip_id}
        crm_leads/{lead_id}
        crm_stages/{stage_id}
        crm_activities/{activity_id}
        inventory_adjustments/{adj_id}
            lines/{line_id}
        stock_moves/{move_id}
        warehouses/{warehouse_id}
        locations/{location_id}
        expenses/{expense_id}
        fixed_assets/{asset_id}
        budgets/{budget_id}
            lines/{line_id}
        fiscal_years/{fy_id}
        bank_accounts/{account_id}
        bank_transactions/{txn_id}
        bank_reconciliations/{rec_id}
        audit_logs/{log_id}
        settings/{setting_key}
        numbering_sequences/{seq_id}
        price_lists/{list_id}
            items/{item_id}
        analytic_accounts/{account_id}
        projects/{project_id}
        recurring_invoices/{rec_id}
        vendor_credits/{vc_id}
            lines/{line_id}
        subscriptions/{sub_id}
        pos_sessions/{session_id}
        pos_orders/{order_id}
        manufacturing_orders/{mo_id}
        email_templates/{template_id}
        automation_rules/{rule_id}
        custom_reports/{report_id}
        dashboards/{dashboard_id}

    # Global collections (no org_id prefix)
    currencies/{currency_id}         ← global, org_id = "system"
"""

from typing import TypedDict, Optional, Any


# ─────────────────────────────────────────────────────────────────────────────
# Collection name constants
# ─────────────────────────────────────────────────────────────────────────────

class Collections:
    """Constants for all Firestore collection names used in the ERP system."""

    # Core
    ORGANIZATIONS = "organizations"
    USERS = "users"
    CONTACTS = "contacts"
    ITEMS = "items"
    SETTINGS = "settings"
    AUDIT_LOGS = "audit_logs"

    # Sales
    INVOICES = "invoices"
    QUOTES = "quotes"
    SALES_ORDERS = "sales_orders"
    CREDIT_NOTES = "credit_notes"
    RECURRING_INVOICES = "recurring_invoices"
    PAYMENTS_RECEIVED = "payments_received"
    RETAINER_APPLICATIONS = "retainer_applications"

    # Purchasing
    PURCHASE_ORDERS = "purchase_orders"
    BILLS = "bills"
    VENDOR_CREDITS = "vendor_credits"
    RECURRING_BILLS = "recurring_bills"
    PAYMENTS_MADE = "payments_made"

    # Accounting
    ACCOUNTS = "accounts"
    JOURNAL_ENTRIES = "journal_entries"
    TAXES = "taxes"
    FISCAL_YEARS = "fiscal_years"
    BUDGETS = "budgets"
    ANALYTIC_ACCOUNTS = "analytic_accounts"
    REVALUATIONS = "revaluations"
    TAX_RETURNS = "tax_returns"

    # Banking
    BANK_ACCOUNTS = "bank_accounts"
    BANK_TRANSACTIONS = "bank_transactions"
    BANK_RECONCILIATIONS = "bank_reconciliations"
    BANK_RULES = "bank_rules"

    # Inventory
    WAREHOUSES = "warehouses"
    LOCATIONS = "locations"
    STOCK_MOVES = "stock_moves"
    INVENTORY_ADJUSTMENTS = "inventory_adjustments"
    STOCK_TRANSFERS = "stock_transfers"

    # HR & Payroll
    HR_EMPLOYEES = "hr_employees"
    HR_CONTRACTS = "hr_contracts"
    HR_ATTENDANCE = "hr_attendance"
    HR_TIME_OFF = "hr_time_off"
    HR_DEPARTMENTS = "hr_departments"
    HR_POSITIONS = "hr_positions"
    HR_LEAVE_TYPES = "hr_leave_types"
    HR_LEAVE_ALLOCATIONS = "hr_leave_allocations"
    PAYROLL_RUNS = "payroll_runs"

    # CRM
    CRM_LEADS = "crm_leads"
    CRM_STAGES = "crm_stages"
    CRM_ACTIVITIES = "crm_activities"

    # Expenses & Assets
    EXPENSES = "expenses"
    FIXED_ASSETS = "fixed_assets"
    MILEAGE = "mileage"

    # Projects
    PROJECTS = "projects"
    PROJECT_MILESTONES = "project_milestones"
    TASK_DEPENDENCIES = "task_dependencies"

    # POS
    POS_SESSIONS = "pos_sessions"
    POS_ORDERS = "pos_orders"

    # Manufacturing
    MANUFACTURING_ORDERS = "manufacturing_orders"

    # Marketing & CRM extras
    MARKETING_CAMPAIGNS = "marketing_campaigns"
    SUBSCRIPTIONS = "subscriptions"

    # System / Config
    NUMBERING_SEQUENCES = "numbering_sequences"
    PRICE_LISTS = "price_lists"
    EMAIL_TEMPLATES = "email_templates"
    AUTOMATION_RULES = "automation_rules"
    CUSTOM_REPORTS = "custom_reports"
    DASHBOARDS = "dashboards"
    REPORTING_TAGS = "reporting_tags"
    SAVED_FILTERS = "saved_filters"
    SCHEDULED_REPORTS = "scheduled_reports"
    CUSTOM_FIELD_VALUES = "custom_field_values"
    CHATTER = "chatter"
    COMMENTS = "comments"
    JOB_RUNS = "job_runs"

    # Global (org_id = "system")
    CURRENCIES = "currencies"


# ─────────────────────────────────────────────────────────────────────────────
# Common field definitions (shared across all documents)
# ─────────────────────────────────────────────────────────────────────────────

# Every document in the ERP system includes these base fields:
#
#   org_id      : str       — organization identifier (multi-tenancy isolation)
#   created_at  : datetime  — UTC timestamp of creation
#   updated_at  : datetime  — UTC timestamp of last update
#   created_by  : str       — user_id who created the record
#   is_active   : bool      — whether the record is active (default: True)
#   deleted_at  : datetime  — soft-delete timestamp (None = not deleted)
#                             داواکاری ٧.٧: soft delete بەکاردەهێنرێت نەک hard delete
#
# NOTE: The design doc references `is_deleted: boolean` as the soft-delete flag.
# The implementation uses `deleted_at: datetime | None` which is equivalent:
#   - is_deleted = True  ↔  deleted_at is not None
#   - is_deleted = False ↔  deleted_at is None
# The `is_deleted` property is computed in BaseRepository for API compatibility.

COMMON_FIELDS = {
    "org_id": "str — organization ID for multi-tenancy",
    "created_at": "datetime — UTC creation timestamp",
    "updated_at": "datetime — UTC last-update timestamp",
    "created_by": "str — user_id of creator",
    "is_active": "bool — record is active (default True)",
    "deleted_at": "datetime | None — soft-delete timestamp (None = not deleted)",
}


# ─────────────────────────────────────────────────────────────────────────────
# Per-collection schema definitions
# ─────────────────────────────────────────────────────────────────────────────

COLLECTION_SCHEMAS: dict[str, dict[str, Any]] = {

    Collections.ORGANIZATIONS: {
        "description": "کۆمپانیاکان — root tenant documents",
        "fields": {
            "name": "str — organization name",
            "base_currency_code": "str — e.g. IQD",
            "language": "str — ku | en",
            "industry": "str | None",
            "address": "str | None",
            "phone": "str | None",
            "email": "str | None",
            "logo_url": "str | None",
            "fiscal_year_start": "int — month number (1-12)",
            "timezone": "str — e.g. Asia/Baghdad",
            **COMMON_FIELDS,
        },
        "subcollections": [],
    },

    Collections.USERS: {
        "description": "بەکارهێنەران",
        "fields": {
            "email": "str",
            "display_name": "str",
            "role": "str — super_admin | admin | manager | accountant | sales_rep | hr | viewer",
            "permissions": "list[str] — extra permissions",
            "firebase_uid": "str",
            "mfa_enabled": "bool",
            "mfa_secret": "str | None — encrypted TOTP secret",
            "last_login": "datetime | None",
            "language": "str — ku | en",
            **COMMON_FIELDS,
        },
        "subcollections": [],
    },

    Collections.CONTACTS: {
        "description": "کەستەمەر و فرۆشیار",
        "fields": {
            "display_name": "str",
            "contact_type": "str — customer | vendor | both",
            "email": "str | None",
            "phone": "str | None",
            "currency_code": "str — default currency",
            "payment_terms": "int — days",
            "credit_limit": "float",
            "tax_number": "str | None — Iraq tax registration",
            "notes": "str | None",
            **COMMON_FIELDS,
        },
        "subcollections": ["persons", "addresses"],
    },

    Collections.ITEMS: {
        "description": "کاڵا و خزمەتگوزاری",
        "fields": {
            "name": "str",
            "sku": "str | None",
            "item_type": "str — product | service",
            "unit": "str — pcs | kg | m | hr | etc.",
            "sales_price": "float",
            "purchase_price": "float",
            "sales_account_id": "str",
            "purchase_account_id": "str",
            "inventory_account_id": "str | None",
            "tax_id": "str | None",
            "track_inventory": "bool",
            "reorder_point": "float | None",
            "description": "str | None",
            **COMMON_FIELDS,
        },
        "subcollections": [],
    },

    Collections.INVOICES: {
        "description": "فاکتۆرەکانی فرۆشتن — داواکاری ٨.١",
        "fields": {
            "number": "str — INV-00001",
            "contact_id": "str",
            "status": "str — draft | sent | partially_paid | paid | overdue | cancelled",
            "date": "datetime",
            "due_date": "datetime",
            "currency_code": "str",
            "exchange_rate": "float",
            "subtotal": "float",
            "tax_amount": "float",
            "discount_amount": "float",
            "total": "float — P1: = subtotal + tax_amount - discount_amount",
            "balance_due": "float",
            "notes": "str | None",
            "terms": "str | None",
            "reference": "str | None",
            "sales_order_id": "str | None",
            "quote_id": "str | None",
            **COMMON_FIELDS,
        },
        "subcollections": ["lines"],
    },

    Collections.QUOTES: {
        "description": "عەرزەکان",
        "fields": {
            "number": "str — QUO-00001",
            "contact_id": "str",
            "status": "str — draft | sent | accepted | declined | expired",
            "date": "datetime",
            "expiry_date": "datetime | None",
            "currency_code": "str",
            "exchange_rate": "float",
            "subtotal": "float",
            "tax_amount": "float",
            "discount_amount": "float",
            "total": "float",
            "notes": "str | None",
            **COMMON_FIELDS,
        },
        "subcollections": ["lines"],
    },

    Collections.SALES_ORDERS: {
        "description": "داواکارییەکانی فرۆشتن",
        "fields": {
            "number": "str — SO-00001",
            "contact_id": "str",
            "quote_id": "str | None",
            "status": "str — draft | confirmed | delivered | cancelled",
            "date": "datetime",
            "delivery_date": "datetime | None",
            "currency_code": "str",
            "exchange_rate": "float",
            "subtotal": "float",
            "tax_amount": "float",
            "discount_amount": "float",
            "total": "float",
            **COMMON_FIELDS,
        },
        "subcollections": ["lines"],
    },

    Collections.CREDIT_NOTES: {
        "description": "نۆتەکانی کرێدیت",
        "fields": {
            "number": "str — CN-00001",
            "contact_id": "str",
            "invoice_id": "str | None",
            "status": "str — draft | open | closed",
            "date": "datetime",
            "currency_code": "str",
            "subtotal": "float",
            "tax_amount": "float",
            "total": "float",
            "amount_applied": "float",
            "balance_remaining": "float",
            **COMMON_FIELDS,
        },
        "subcollections": ["lines", "applications"],
    },

    Collections.PURCHASE_ORDERS: {
        "description": "داواکارییەکانی کڕین — داواکاری ٩.١",
        "fields": {
            "number": "str — PO-00001",
            "contact_id": "str — vendor",
            "status": "str — draft | sent | approved | received | billed | cancelled",
            "date": "datetime",
            "expected_date": "datetime | None",
            "currency_code": "str",
            "exchange_rate": "float",
            "subtotal": "float",
            "tax_amount": "float",
            "discount_amount": "float",
            "total": "float",
            "approved_by": "str | None",
            "approved_at": "datetime | None",
            **COMMON_FIELDS,
        },
        "subcollections": ["lines"],
    },

    Collections.BILLS: {
        "description": "فاکتۆرەکانی کڕین",
        "fields": {
            "number": "str — BILL-00001",
            "contact_id": "str — vendor",
            "purchase_order_id": "str | None",
            "status": "str — draft | open | partially_paid | paid | overdue",
            "date": "datetime",
            "due_date": "datetime",
            "currency_code": "str",
            "exchange_rate": "float",
            "subtotal": "float",
            "tax_amount": "float",
            "total": "float",
            "balance_due": "float",
            **COMMON_FIELDS,
        },
        "subcollections": ["lines"],
    },

    Collections.PAYMENTS_RECEIVED: {
        "description": "پارەدانی وەرگیراو",
        "fields": {
            "number": "str — PAY-00001",
            "contact_id": "str",
            "date": "datetime",
            "amount": "float",
            "currency_code": "str",
            "exchange_rate": "float",
            "payment_method": "str — cash | bank | cheque | card",
            "bank_account_id": "str | None",
            "reference": "str | None",
            "notes": "str | None",
            **COMMON_FIELDS,
        },
        "subcollections": ["allocations"],
    },

    Collections.PAYMENTS_MADE: {
        "description": "پارەدانی کراو",
        "fields": {
            "number": "str — PMT-00001",
            "contact_id": "str — vendor",
            "date": "datetime",
            "amount": "float",
            "currency_code": "str",
            "exchange_rate": "float",
            "payment_method": "str",
            "bank_account_id": "str | None",
            "reference": "str | None",
            **COMMON_FIELDS,
        },
        "subcollections": ["allocations"],
    },

    Collections.JOURNAL_ENTRIES: {
        "description": "تۆمارەکانی ژورنال — داواکاری ١٠.٣ — P2: sum(debits)=sum(credits)",
        "fields": {
            "number": "str — JRN-00001",
            "date": "datetime",
            "reference": "str | None",
            "status": "str — draft | posted",
            "total_debit": "float — P2: must equal total_credit",
            "total_credit": "float — P2: must equal total_debit",
            "notes": "str | None",
            "source": "str | None — invoice | bill | payroll | manual",
            "source_id": "str | None",
            **COMMON_FIELDS,
        },
        "subcollections": ["lines"],
    },

    Collections.ACCOUNTS: {
        "description": "چارتی ئەکاونتەکان — داواکاری ١٠.٢",
        "fields": {
            "code": "str — e.g. 1110",
            "name": "str",
            "name_ku": "str — Kurdish name",
            "account_type": "str — asset | liability | equity | income | expense | ...",
            "parent_id": "str | None",
            "is_system": "bool — system accounts cannot be deleted",
            "balance": "float — computed balance",
            "currency_code": "str | None",
            **COMMON_FIELDS,
        },
        "subcollections": [],
    },

    Collections.TAXES: {
        "description": "نرخەکانی باج — داواکاری ١٠.٧",
        "fields": {
            "name": "str",
            "name_ku": "str",
            "rate": "float — percentage e.g. 15.0",
            "tax_type": "str — vat | sales_tax | service_tax | withholding",
            "is_default": "bool",
            **COMMON_FIELDS,
        },
        "subcollections": [],
    },

    Collections.STOCK_MOVES: {
        "description": "جووڵەی ئەستۆک — داواکاری ١١.١ — P3: balance = initial + in - out",
        "fields": {
            "product_id": "str",
            "warehouse_id": "str",
            "location_id": "str | None",
            "move_type": "str — in | out | transfer",
            "quantity": "float",
            "unit_cost": "float",
            "reference_type": "str — sale | purchase | adjustment | transfer",
            "reference_id": "str | None",
            "lot_number": "str | None",
            "serial_number": "str | None",
            **COMMON_FIELDS,
        },
        "subcollections": [],
    },

    Collections.WAREHOUSES: {
        "description": "کۆگاکان",
        "fields": {
            "name": "str",
            "code": "str",
            "address": "str | None",
            "is_default": "bool",
            **COMMON_FIELDS,
        },
        "subcollections": [],
    },

    Collections.HR_EMPLOYEES: {
        "description": "کارمەندان — داواکاری ١٢.١",
        "fields": {
            "name": "str",
            "email": "str",
            "department_id": "str | None",
            "position_id": "str | None",
            "job_title": "str | None",
            "hire_date": "datetime",
            "contract_type": "str — full_time | part_time | contract",
            "base_salary": "float",
            "currency_code": "str",
            "social_security_number": "str | None — Iraq compliance",
            "national_id": "str | None",
            "bank_account": "str | None",
            "user_id": "str | None — linked user account",
            **COMMON_FIELDS,
        },
        "subcollections": [],
    },

    Collections.PAYROLL_RUNS: {
        "description": "ڕیزکردنی مووچە — داواکاری ١٢.٦",
        "fields": {
            "period_month": "int — 1-12",
            "period_year": "int",
            "status": "str — draft | confirmed | paid",
            "total_gross": "float",
            "total_deductions": "float",
            "total_net": "float",
            "journal_entry_id": "str | None",
            **COMMON_FIELDS,
        },
        "subcollections": ["payslips"],
    },

    Collections.CRM_LEADS: {
        "description": "لیدەکانی CRM — داواکاری ١٣.١",
        "fields": {
            "name": "str",
            "contact_id": "str | None",
            "stage_id": "str",
            "stage": "str — new | qualified | proposal | negotiation | won | lost",
            "probability": "float — 0-100",
            "expected_revenue": "float",
            "assigned_to": "str — user_id",
            "score": "float — lead scoring",
            "source": "str | None",
            "notes": "str | None",
            **COMMON_FIELDS,
        },
        "subcollections": [],
    },

    Collections.AUDIT_LOGS: {
        "description": "لۆگی چالاکییەکان — داواکاری ٦.٦ — P5",
        "fields": {
            "user_id": "str",
            "action": "str — create | update | delete | login | logout | ...",
            "resource_type": "str — invoices | contacts | ...",
            "resource_id": "str | None",
            "changes": "dict | None — before/after values",
            "ip_address": "str | None",
            "user_agent": "str | None",
            "timestamp": "datetime — P5: timestamp ≤ now()",
            **COMMON_FIELDS,
        },
        "subcollections": [],
    },

    Collections.CURRENCIES: {
        "description": "دراوەکان — global collection (org_id = 'system')",
        "fields": {
            "code": "str — ISO 4217 e.g. IQD",
            "name": "str",
            "name_ku": "str",
            "symbol": "str",
            "decimal_places": "int",
            "format": "str",
            **COMMON_FIELDS,
        },
        "subcollections": [],
    },

    Collections.NUMBERING_SEQUENCES: {
        "description": "ڕیزبەندی ژمارەکان",
        "fields": {
            "entity_type": "str — invoice | quote | sales_order | ...",
            "prefix": "str — INV- | QUO- | ...",
            "next_number": "int",
            "padding": "int — zero-padding width",
            **COMMON_FIELDS,
        },
        "subcollections": [],
    },

    Collections.SETTINGS: {
        "description": "ڕێکخستنەکانی org",
        "fields": {
            "key": "str",
            "value": "Any",
            "category": "str | None",
            **COMMON_FIELDS,
        },
        "subcollections": [],
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# Soft Delete Convention
# ─────────────────────────────────────────────────────────────────────────────
#
# داواکاری ٧.٧: soft delete بەکاردەهێنرێت (is_deleted flag) نەک hard delete
#
# Implementation:
#   - `deleted_at: datetime | None` — set to UTC timestamp when soft-deleted
#   - `deleted_at is None`  ↔  is_deleted = False  (record is active)
#   - `deleted_at is not None` ↔  is_deleted = True  (record is soft-deleted)
#
# BaseRepository.delete(doc_id) sets deleted_at = utcnow() (soft delete)
# BaseRepository.delete(doc_id, hard=True) permanently removes the document
# BaseRepository.list() excludes soft-deleted records by default
# BaseRepository.list(include_deleted=True) includes soft-deleted records
# BaseRepository.restore(doc_id) clears deleted_at (un-deletes)
#
# Retention: soft-deleted records are purged after 30 days by a scheduled job
#
SOFT_DELETE_FIELD = "deleted_at"
SOFT_DELETE_ALIAS = "is_deleted"  # API-level alias: is_deleted = (deleted_at is not None)


def is_deleted(doc: dict) -> bool:
    """Return True if the document has been soft-deleted."""
    return doc.get(SOFT_DELETE_FIELD) is not None


def to_api_doc(doc: dict) -> dict:
    """Add is_deleted computed field to a Firestore document for API responses."""
    return {**doc, SOFT_DELETE_ALIAS: is_deleted(doc)}
