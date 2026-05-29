"""Per-governorate Iraqi tax presets (growth-to-100 § R4 + launch-readiness R3).

This is the **backend** mirror of the frontend ``iraqRegionPresets.ts`` so the
COA seeder, the WHT engine, and the auditor export can resolve regional
defaults without round-tripping through the browser.

**All rates are placeholders pending R7.1 verification by a Kurdish/Iraqi
tax accountant.** Every entry carries ``placeholder: True``; the verifier
walks the registry, replaces rates, and flips the flag.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class TaxRow:
    name_en: str
    name_ku: str
    name_ar: str
    rate_percent: float
    applies_to: str          # "sales" | "purchases" | "withholding"
    sector: Optional[str] = None
    placeholder: bool = True


@dataclass(frozen=True)
class WithholdingDefaults:
    services_percent: float = 3.0
    rent_percent: float = 5.0
    materials_percent: float = 2.0
    other_percent: float = 0.0
    placeholder: bool = True


@dataclass(frozen=True)
class GovernoratePreset:
    code: str                # ISO-style code we use internally
    governorate_code: str    # Iraqi 2-letter code (BG, ER, ...)
    name_en: str
    name_ku: str
    name_ar: str
    capital: str
    krg_region: bool
    vat_rate_percent: float  # Iraq has no broad VAT today → typically 0
    sector_taxes: tuple[TaxRow, ...]
    withholding: WithholdingDefaults
    currency: str = "IQD"
    timezone: str = "Asia/Baghdad"
    placeholder: bool = True


# ─────────────────────────────────────────────────────────────────────────
# Shared sector rows (referenced by multiple governorates)
# ─────────────────────────────────────────────────────────────────────────

HOSPITALITY = TaxRow(
    name_en="Sales Tax — Hospitality",
    name_ku="باجی فرۆشتن — کەرتی میوانداری",
    name_ar="ضريبة المبيعات — الضيافة",
    rate_percent=10.0,
    applies_to="sales",
    sector="hospitality",
)
TELECOM = TaxRow(
    name_en="Sales Tax — Telecom",
    name_ku="باجی فرۆشتن — پەیوەندی",
    name_ar="ضريبة المبيعات — الاتصالات",
    rate_percent=20.0,
    applies_to="sales",
    sector="telecom",
)
TOBACCO = TaxRow(
    name_en="Excise — Tobacco",
    name_ku="باج — جگەرە",
    name_ar="ضريبة — التبغ",
    rate_percent=300.0,
    applies_to="sales",
    sector="tobacco",
)

_DEFAULT_SECTORS = (HOSPITALITY, TELECOM, TOBACCO)
_DEFAULT_WITHHOLDING = WithholdingDefaults()


# ─────────────────────────────────────────────────────────────────────────
# 18 governorate registry
# ─────────────────────────────────────────────────────────────────────────


def _make(code, gov_code, name_en, name_ku, name_ar, capital, krg=False):
    return GovernoratePreset(
        code=code,
        governorate_code=gov_code,
        name_en=name_en,
        name_ku=name_ku,
        name_ar=name_ar,
        capital=capital,
        krg_region=krg,
        vat_rate_percent=0.0,  # no broad VAT in Iraq today
        sector_taxes=_DEFAULT_SECTORS,
        withholding=_DEFAULT_WITHHOLDING,
    )


GOVERNORATES: tuple[GovernoratePreset, ...] = (
    # KRG region (3)
    _make("IQ-AR", "AR", "Erbil", "هەولێر", "أربيل", "Erbil", krg=True),
    _make("IQ-SU", "SU", "Sulaymaniyah", "سلێمانی", "السليمانية", "Sulaymaniyah", krg=True),
    _make("IQ-DA", "DA", "Duhok", "دهۆک", "دهوك", "Duhok", krg=True),
    # Federal Iraq (15)
    _make("IQ-BG", "BG", "Baghdad", "بەغدا", "بغداد", "Baghdad"),
    _make("IQ-NI", "NI", "Nineveh", "نەینەوا", "نينوى", "Mosul"),
    _make("IQ-KI", "KI", "Kirkuk", "کەرکوک", "كركوك", "Kirkuk"),
    _make("IQ-SD", "SD", "Salah ad-Din", "سەلاحەدین", "صلاح الدين", "Tikrit"),
    _make("IQ-AN", "AN", "Anbar", "ئەنبار", "الأنبار", "Ramadi"),
    _make("IQ-DI", "DI", "Diyala", "دیالە", "ديالى", "Baqubah"),
    _make("IQ-BB", "BB", "Babil", "بابل", "بابل", "Hillah"),
    _make("IQ-KA", "KA", "Karbala", "کەربەلا", "كربلاء", "Karbala"),
    _make("IQ-NA", "NA", "Najaf", "نەجەف", "النجف", "Najaf"),
    _make("IQ-QA", "QA", "Qadisiyyah", "قادسیە", "القادسية", "Diwaniyah"),
    _make("IQ-MU", "MU", "Muthanna", "مووسەننا", "المثنى", "Samawah"),
    _make("IQ-DQ", "DQ", "Dhi Qar", "زی قار", "ذي قار", "Nasiriyah"),
    _make("IQ-WA", "WA", "Wasit", "واسیت", "واسط", "Kut"),
    _make("IQ-MA", "MA", "Maysan", "مەیسان", "ميسان", "Amarah"),
    _make("IQ-BA", "BA", "Basra", "بەسرە", "البصرة", "Basra"),
)


def get_preset(code: str) -> Optional[GovernoratePreset]:
    """Look up a preset by either ``IQ-XX`` or bare ``XX`` code."""
    if not code:
        return None
    code = code.upper()
    for g in GOVERNORATES:
        if g.code.upper() == code or g.governorate_code.upper() == code:
            return g
    return None


def all_governorates() -> list[dict]:
    """Serialisable list for the API."""
    return [
        {
            "code": g.code,
            "governorate_code": g.governorate_code,
            "name_en": g.name_en,
            "name_ku": g.name_ku,
            "name_ar": g.name_ar,
            "capital": g.capital,
            "krg_region": g.krg_region,
            "vat_rate_percent": g.vat_rate_percent,
            "withholding": {
                "services_percent": g.withholding.services_percent,
                "rent_percent": g.withholding.rent_percent,
                "materials_percent": g.withholding.materials_percent,
                "other_percent": g.withholding.other_percent,
                "placeholder": g.withholding.placeholder,
            },
            "sector_taxes": [
                {
                    "name_en": s.name_en,
                    "name_ku": s.name_ku,
                    "name_ar": s.name_ar,
                    "rate_percent": s.rate_percent,
                    "applies_to": s.applies_to,
                    "sector": s.sector,
                    "placeholder": s.placeholder,
                }
                for s in g.sector_taxes
            ],
            "currency": g.currency,
            "timezone": g.timezone,
            "placeholder": g.placeholder,
        }
        for g in GOVERNORATES
    ]


def placeholder_count() -> int:
    """Count every placeholder flag across the registry — used by R7.1 audit."""
    total = 0
    for g in GOVERNORATES:
        if g.placeholder:
            total += 1
        if g.withholding.placeholder:
            total += 1
        for s in g.sector_taxes:
            if s.placeholder:
                total += 1
    return total
