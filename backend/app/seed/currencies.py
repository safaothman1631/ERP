"""Seed currencies for multi-currency support"""

CURRENCIES = [
    {"code": "IQD", "name": "Iraqi Dinar", "name_ku": "دینار", "symbol": "د.ع", "decimal_places": 0, "format": "###,###"},
    {"code": "USD", "name": "US Dollar", "name_ku": "دۆلار", "symbol": "$", "decimal_places": 2, "format": "###,##0.00"},
    {"code": "EUR", "name": "Euro", "name_ku": "یۆرۆ", "symbol": "€", "decimal_places": 2, "format": "###,##0.00"},
    {"code": "GBP", "name": "British Pound", "name_ku": "پاوەند", "symbol": "£", "decimal_places": 2, "format": "###,##0.00"},
    {"code": "TRY", "name": "Turkish Lira", "name_ku": "لیرەی تورکی", "symbol": "₺", "decimal_places": 2, "format": "###,##0.00"},
    {"code": "IRR", "name": "Iranian Rial", "name_ku": "ریاڵی ئێرانی", "symbol": "﷼", "decimal_places": 0, "format": "###,###"},
    {"code": "SAR", "name": "Saudi Riyal", "name_ku": "ریاڵی سعوودی", "symbol": "ر.س", "decimal_places": 2, "format": "###,##0.00"},
    {"code": "AED", "name": "UAE Dirham", "name_ku": "دیرهەمی ئیمارات", "symbol": "د.إ", "decimal_places": 2, "format": "###,##0.00"},
    {"code": "KWD", "name": "Kuwaiti Dinar", "name_ku": "دیناری کوەیت", "symbol": "د.ك", "decimal_places": 3, "format": "###,##0.000"},
    {"code": "JOD", "name": "Jordanian Dinar", "name_ku": "دیناری ئوردون", "symbol": "د.أ", "decimal_places": 3, "format": "###,##0.000"},
    {"code": "SYP", "name": "Syrian Pound", "name_ku": "لیرەی سووری", "symbol": "ل.س", "decimal_places": 0, "format": "###,###"},
    {"code": "CNY", "name": "Chinese Yuan", "name_ku": "یوانی چین", "symbol": "¥", "decimal_places": 2, "format": "###,##0.00"},
    {"code": "INR", "name": "Indian Rupee", "name_ku": "ڕوپی هیندی", "symbol": "₹", "decimal_places": 2, "format": "###,##0.00"},
    {"code": "JPY", "name": "Japanese Yen", "name_ku": "یەنی ژاپۆنی", "symbol": "¥", "decimal_places": 0, "format": "###,###"},
    {"code": "CAD", "name": "Canadian Dollar", "name_ku": "دۆلاری کەنەدی", "symbol": "CA$", "decimal_places": 2, "format": "###,##0.00"},
    {"code": "AUD", "name": "Australian Dollar", "name_ku": "دۆلاری ئوسترالی", "symbol": "A$", "decimal_places": 2, "format": "###,##0.00"},
]

DEFAULT_EXCHANGE_RATES = [
    {"from_currency": "IQD", "to_currency": "USD", "rate": 0.000763},
    {"from_currency": "USD", "to_currency": "IQD", "rate": 1310.0},
    {"from_currency": "IQD", "to_currency": "EUR", "rate": 0.000700},
    {"from_currency": "EUR", "to_currency": "IQD", "rate": 1428.0},
    {"from_currency": "IQD", "to_currency": "TRY", "rate": 0.0245},
    {"from_currency": "TRY", "to_currency": "IQD", "rate": 40.8},
]
