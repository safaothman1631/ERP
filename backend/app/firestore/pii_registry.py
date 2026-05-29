"""PII field registry (Wave E)."""
from __future__ import annotations

PII_FIELDS: dict[str, list[str]] = {
    "users": ["email", "phone", "totp_secret", "backup_codes"],
    "contacts": ["phone", "email", "tax_id", "national_id"],
    "hr_employees": [
        "national_id",
        "passport_no",
        "bank_account",
        "phone",
        "emergency_phone",
        "address",
    ],
    "payroll_runs": ["bank_account"],
    "iraq_gateway_config": ["api_key", "secret"],
}
