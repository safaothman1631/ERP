"""Default tax rates for Iraqi businesses"""

TAX_RATES = [
    {"name": "No Tax", "name_ku": "بێ باج", "rate": 0.0, "tax_type": "vat", "is_default": True, "is_active": True},
    {"name": "VAT 15%", "name_ku": "باج ١٥٪", "rate": 15.0, "tax_type": "vat", "is_active": True},
    {"name": "VAT 5%", "name_ku": "باج ٥٪", "rate": 5.0, "tax_type": "vat", "is_active": True},
    {"name": "VAT 10%", "name_ku": "باج ١٠٪", "rate": 10.0, "tax_type": "vat", "is_active": True},
    {"name": "Service Tax 3%", "name_ku": "باجی خزمەتگوزاری ٣٪", "rate": 3.0, "tax_type": "service_tax", "is_active": True},
    {"name": "Withholding Tax 5%", "name_ku": "باجی گرتنەوە ٥٪", "rate": 5.0, "tax_type": "sales_tax", "is_active": True},
]

SEQUENCES = [
    {"entity_type": "invoice", "prefix": "INV-", "next_number": 1, "padding": 5},
    {"entity_type": "quote", "prefix": "QUO-", "next_number": 1, "padding": 5},
    {"entity_type": "sales_order", "prefix": "SO-", "next_number": 1, "padding": 5},
    {"entity_type": "credit_note", "prefix": "CN-", "next_number": 1, "padding": 5},
    {"entity_type": "bill", "prefix": "BILL-", "next_number": 1, "padding": 5},
    {"entity_type": "purchase_order", "prefix": "PO-", "next_number": 1, "padding": 5},
    {"entity_type": "expense", "prefix": "EXP-", "next_number": 1, "padding": 5},
    {"entity_type": "payment_received", "prefix": "PAY-", "next_number": 1, "padding": 5},
    {"entity_type": "payment_made", "prefix": "PMT-", "next_number": 1, "padding": 5},
    {"entity_type": "journal", "prefix": "JRN-", "next_number": 1, "padding": 5},
    {"entity_type": "vendor_credit", "prefix": "VC-", "next_number": 1, "padding": 5},
    {"entity_type": "inventory_adjustment", "prefix": "ADJ-", "next_number": 1, "padding": 5},
]
