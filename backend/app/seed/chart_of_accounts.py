"""Standard Chart of Accounts for Iraqi businesses (Kurdish + English)"""

CHART_OF_ACCOUNTS = [
    # ===== ASSETS (سامان) =====
    {"code": "1000", "name": "Assets", "name_ku": "سامان", "account_type": "asset", "children": [
        {"code": "1100", "name": "Current Assets", "name_ku": "سامانی ئێستا", "account_type": "asset", "children": [
            {"code": "1110", "name": "Cash", "name_ku": "پارەی نەقد", "account_type": "cash"},
            {"code": "1111", "name": "Petty Cash", "name_ku": "پارەی بچووکی نەقد", "account_type": "cash"},
            {"code": "1120", "name": "Bank Accounts", "name_ku": "حسابی بانک", "account_type": "bank"},
            {"code": "1130", "name": "Accounts Receivable", "name_ku": "حسابی وەرگرتن", "account_type": "accounts_receivable"},
            {"code": "1140", "name": "Inventory", "name_ku": "مەخزەن", "account_type": "inventory"},
            {"code": "1150", "name": "Prepaid Expenses", "name_ku": "خەرجی پێشدراو", "account_type": "other_current_asset"},
            {"code": "1160", "name": "Advance Tax", "name_ku": "باجی پێشدراو", "account_type": "other_current_asset"},
            {"code": "1170", "name": "Employee Advances", "name_ku": "پێشاکی کارمەند", "account_type": "other_current_asset"},
            {"code": "1180", "name": "Notes Receivable", "name_ku": "چەکی وەرگرتنی", "account_type": "other_current_asset"},
        ]},
        {"code": "1200", "name": "Non-Current Assets", "name_ku": "سامانی نائێستا", "account_type": "asset", "children": [
            {"code": "1210", "name": "Furniture & Equipment", "name_ku": "کەلوپەل و ئامێر", "account_type": "fixed_asset"},
            {"code": "1220", "name": "Vehicles", "name_ku": "ئۆتۆمبێل", "account_type": "fixed_asset"},
            {"code": "1230", "name": "Buildings", "name_ku": "بینا", "account_type": "fixed_asset"},
            {"code": "1240", "name": "Land", "name_ku": "زەوی", "account_type": "fixed_asset"},
            {"code": "1250", "name": "Computer Equipment", "name_ku": "ئامێری کۆمپیوتەر", "account_type": "fixed_asset"},
            {"code": "1290", "name": "Accumulated Depreciation", "name_ku": "کۆی خوارەبوون", "account_type": "fixed_asset"},
        ]},
    ]},

    # ===== LIABILITIES (قەرزەکان) =====
    {"code": "2000", "name": "Liabilities", "name_ku": "قەرزەکان", "account_type": "liability", "children": [
        {"code": "2100", "name": "Current Liabilities", "name_ku": "قەرزی ئێستا", "account_type": "liability", "children": [
            {"code": "2110", "name": "Accounts Payable", "name_ku": "حسابی دانەوە", "account_type": "accounts_payable"},
            {"code": "2120", "name": "Accrued Expenses", "name_ku": "خەرجی کۆبوونەوە", "account_type": "other_current_liability"},
            {"code": "2130", "name": "Unearned Revenue", "name_ku": "داهاتی نەبەدەستهاتوو", "account_type": "other_current_liability"},
            {"code": "2140", "name": "Sales Tax Payable", "name_ku": "باجی فرۆشتنی دانەوە", "account_type": "other_current_liability"},
            {"code": "2150", "name": "VAT Payable", "name_ku": "باجی بەرزکراوە", "account_type": "other_current_liability"},
            {"code": "2155", "name": "WHT Payable", "name_ku": "باجی گرتنەوەی دانەوە", "account_type": "other_current_liability"},
            {"code": "2160", "name": "Wages Payable", "name_ku": "مووچەی دانەوە", "account_type": "other_current_liability"},
            {"code": "2170", "name": "Employee Benefits Payable", "name_ku": "سوودی کارمەندان", "account_type": "other_current_liability"},
            {"code": "2180", "name": "Notes Payable", "name_ku": "چەکی دانەوە", "account_type": "other_current_liability"},
            {"code": "2190", "name": "Credit Card", "name_ku": "کارتی کرێدیت", "account_type": "other_current_liability"},
        ]},
        {"code": "2200", "name": "Long-Term Liabilities", "name_ku": "قەرزی درێژخایەن", "account_type": "liability", "children": [
            {"code": "2210", "name": "Bank Loans", "name_ku": "قەرزی بانک", "account_type": "long_term_liability"},
            {"code": "2220", "name": "Mortgage Payable", "name_ku": "قەرزی بەرهەنان", "account_type": "long_term_liability"},
        ]},
    ]},

    # ===== EQUITY (سەرمایە) =====
    {"code": "3000", "name": "Equity", "name_ku": "سەرمایە", "account_type": "equity", "children": [
        {"code": "3100", "name": "Owner's Equity", "name_ku": "سەرمایەی خاوەنکار", "account_type": "owner_equity"},
        {"code": "3200", "name": "Retained Earnings", "name_ku": "قازانجی پاشەکەوتکراو", "account_type": "retained_earnings"},
        {"code": "3300", "name": "Owner's Drawings", "name_ku": "بردنەوەی خاوەنکار", "account_type": "owner_equity"},
        {"code": "3400", "name": "Opening Balance Equity", "name_ku": "سەرمایەی سەرەتا", "account_type": "owner_equity"},
    ]},

    # ===== INCOME (داهات) =====
    {"code": "4000", "name": "Income", "name_ku": "داهات", "account_type": "income", "children": [
        {"code": "4100", "name": "Sales Revenue", "name_ku": "داهاتی فرۆشتن", "account_type": "sales"},
        {"code": "4200", "name": "Service Revenue", "name_ku": "داهاتی خزمەتگوزاری", "account_type": "sales"},
        {"code": "4300", "name": "Discount Received", "name_ku": "داشکانی وەرگیراو", "account_type": "other_income"},
        {"code": "4400", "name": "Interest Income", "name_ku": "داهاتی خێز", "account_type": "other_income"},
        {"code": "4500", "name": "Other Income", "name_ku": "داهاتی تر", "account_type": "other_income"},
        {"code": "4600", "name": "Gain on Exchange", "name_ku": "قازانجی نرخی دراو", "account_type": "other_income"},
    ]},

    # ===== EXPENSES (خەرجی) =====
    {"code": "5000", "name": "Cost of Goods Sold", "name_ku": "نرخی کاڵای فرۆشراو", "account_type": "cost_of_goods_sold", "children": [
        {"code": "5100", "name": "Purchases", "name_ku": "کڕین", "account_type": "cost_of_goods_sold"},
        {"code": "5200", "name": "Freight & Shipping", "name_ku": "بارگوزاری", "account_type": "cost_of_goods_sold"},
        {"code": "5300", "name": "Purchase Discounts", "name_ku": "داشکانی کڕین", "account_type": "cost_of_goods_sold"},
    ]},
    {"code": "6000", "name": "Operating Expenses", "name_ku": "خەرجی کارکردن", "account_type": "expense", "children": [
        {"code": "6100", "name": "Salaries & Wages", "name_ku": "مووچە", "account_type": "operating_expense"},
        {"code": "6110", "name": "Employee Benefits", "name_ku": "سوودی کارمەندان", "account_type": "operating_expense"},
        {"code": "6200", "name": "Rent", "name_ku": "کرێ", "account_type": "operating_expense"},
        {"code": "6300", "name": "Utilities", "name_ku": "کارەبا و ئاو", "account_type": "operating_expense"},
        {"code": "6310", "name": "Internet & Phone", "name_ku": "ئینتەرنێت و تەلەفۆن", "account_type": "operating_expense"},
        {"code": "6400", "name": "Office Supplies", "name_ku": "پێداویستی ئۆفیس", "account_type": "operating_expense"},
        {"code": "6500", "name": "Marketing & Advertising", "name_ku": "بازاڕکاری و ڕیکلام", "account_type": "operating_expense"},
        {"code": "6600", "name": "Travel & Transportation", "name_ku": "گەشت و گوازراوە", "account_type": "operating_expense"},
        {"code": "6700", "name": "Insurance", "name_ku": "بیمە", "account_type": "operating_expense"},
        {"code": "6800", "name": "Repairs & Maintenance", "name_ku": "چاککردنەوە و چاودێری", "account_type": "operating_expense"},
        {"code": "6900", "name": "Depreciation", "name_ku": "خوارەبوون", "account_type": "operating_expense"},
        {"code": "6910", "name": "Meals & Entertainment", "name_ku": "خوارن و پەسەندکردن", "account_type": "operating_expense"},
        {"code": "6920", "name": "Professional Fees", "name_ku": "کرێی پسپۆڕان", "account_type": "operating_expense"},
        {"code": "6930", "name": "Bank Fees", "name_ku": "کرێی بانک", "account_type": "operating_expense"},
        {"code": "6940", "name": "Taxes & Licenses", "name_ku": "باج و مۆڵەت", "account_type": "operating_expense"},
        {"code": "6950", "name": "Bad Debts", "name_ku": "قەرزی نەگەڕاوە", "account_type": "operating_expense"},
        {"code": "6960", "name": "Discount Given", "name_ku": "داشکانی دراو", "account_type": "operating_expense"},
        {"code": "6970", "name": "Loss on Exchange", "name_ku": "زیانی نرخی دراو", "account_type": "other_expense"},
        {"code": "6999", "name": "Miscellaneous Expenses", "name_ku": "خەرجی جیاجیا", "account_type": "other_expense"},
    ]},
]
