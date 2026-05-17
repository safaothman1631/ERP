"""
Seed Data Package
==================
ئەم پاکێجە داتای سەرەتایی بۆ org ی نوێ دابین دەکات.

Exports:
    CHART_OF_ACCOUNTS  — ستاندارد chart of accounts بۆ کارگێڕییەکانی عێراق
    CURRENCIES         — دراوە پشتگیریکراوەکان لەگەڵ نرخی گۆڕینی سەرەتایی
    TAX_RATES          — نرخەکانی باجی سەرەتایی
    SEQUENCES          — ڕیزبەندی ژمارەکانی سەرەتایی

    seed_org()         — دروستکردنی org و seed کردنی داتای سەرەتایی
"""

from .chart_of_accounts import CHART_OF_ACCOUNTS
from .currencies import CURRENCIES, DEFAULT_EXCHANGE_RATES
from .tax_rates import TAX_RATES, SEQUENCES

import uuid
import copy
from datetime import datetime


def seed_org(
    org_id: str,
    org_name: str,
    currency_code: str = "IQD",
    language: str = "ku",
) -> None:
    """
    دروستکردنی org و seed کردنی داتای سەرەتایی.

    جێبەجێ دەکات:
      - دروستکردنی ڕێکۆردی organization
      - seed کردنی دراوەکان (global)
      - seed کردنی chart of accounts (org-specific)
      - seed کردنی نرخەکانی باج (org-specific)
      - seed کردنی ڕیزبەندی ژمارەکان (org-specific)

    داواکاری: ٧.١، ٧.٧
    """
    from app.firestore.organizations import OrganizationRepository
    from app.firestore.accounts import AccountRepository
    from app.firestore.taxes import TaxRateRepository
    from app.firestore.numbering import SequenceRepository
    from app.firestore.banking import CurrencyRepository

    # 1. دروستکردنی organization
    org_repo = OrganizationRepository()
    org_repo.create({
        "id": org_id,
        "name": org_name,
        "base_currency_code": currency_code,
        "language": language,
        "fiscal_year_start": 1,
        "timezone": "Asia/Baghdad",
        "created_at": datetime.utcnow(),
    })

    # 2. seed کردنی دراوەکان (global — org_id = "system")
    curr_repo = CurrencyRepository("system")
    for curr_data in CURRENCIES:
        existing = curr_repo.collection.where("code", "==", curr_data["code"]).limit(1).get()
        if not any(existing):
            curr_repo.create({
                "id": str(uuid.uuid4()),
                **curr_data,
                "org_id": "system",
            })

    # 3. seed کردنی chart of accounts (org-specific)
    account_repo = AccountRepository(org_id)
    _seed_accounts(account_repo, CHART_OF_ACCOUNTS, parent_id=None)

    # 4. seed کردنی نرخەکانی باج (org-specific)
    tax_repo = TaxRateRepository(org_id)
    for tax_data in TAX_RATES:
        tax_repo.create({"id": str(uuid.uuid4()), **tax_data})

    # 5. seed کردنی ڕیزبەندی ژمارەکان (org-specific)
    seq_repo = SequenceRepository(org_id)
    for seq_data in SEQUENCES:
        seq_repo.create({
            "id": f"{org_id}_{seq_data['entity_type']}",
            **seq_data,
        })


def _seed_accounts(account_repo, accounts: list, parent_id: str | None) -> None:
    """
    بە ڕیکۆرسیڤی chart of accounts دروست دەکات.

    هەر ئەکاونتێک لەگەڵ parent_id ی خۆی دروست دەکرێت،
    ئەگەر children هەبوو، ئەوانیش بە ڕیکۆرسیڤی دروست دەکرێن.
    """
    for acc_data in accounts:
        data = copy.deepcopy(acc_data)
        children = data.pop("children", [])
        account = account_repo.create({
            "id": str(uuid.uuid4()),
            "parent_id": parent_id,
            "is_system": True,
            **data,
        })
        if children:
            _seed_accounts(account_repo, children, account["id"])


__all__ = [
    "CHART_OF_ACCOUNTS",
    "CURRENCIES",
    "DEFAULT_EXCHANGE_RATES",
    "TAX_RATES",
    "SEQUENCES",
    "seed_org",
]
