"""Company-profile schemas with Iraqi-specific fields (growth-to-100 § R4.14).

Adds two first-class fields to the company record:

  * ``commercial_registration_no`` (CRN) — Iraqi Ministry of Trade business
    registration number. Validated against a documented format (``XX-YYYYYY``
    where ``XX`` is a 2-letter governorate code, ``YYYYYY`` is a 6-12-digit
    serial). The format is the **documented common pattern** — real-world
    CRNs vary and R7.1 verification is pending.

  * ``tax_id`` (TIN) — kept as-is; no format validation since MoF and KRG MoF
    issue with different patterns and a full validator needs accountant
    sign-off (R7.1).

The ``CompanyProfile`` here is a **request / response** model. Persistence is
the existing ``app.firestore.companies.CompanyRepository``.
"""
from __future__ import annotations

import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# Iraqi CRN format — placeholder pattern. R7.1 will confirm the canonical
# shape. We accept ``XX-NNNNNN`` to ``XX-NNNNNNNNNNNN`` (case-insensitive)
# and bare digits 6-15 long for legacy entries.
_CRN_RE = re.compile(r"^(?:[A-Za-z]{2}-)?\d{6,15}$")


def _normalize_crn(value: str) -> str:
    """Uppercase the governorate prefix and trim whitespace."""
    v = value.strip()
    if "-" in v:
        head, tail = v.split("-", 1)
        return f"{head.upper()}-{tail}"
    return v


def validate_commercial_registration_no(value: str) -> str:
    """Validate Iraqi commercial-registration format. Raises ``ValueError``."""
    v = _normalize_crn(value)
    if not _CRN_RE.match(v):
        raise ValueError(
            "Invalid commercial-registration format. Expected XX-NNNNNN or 6-15 digits."
        )
    return v


class CompanyProfileBase(BaseModel):
    """Common company fields — shared by create / update / response."""

    name: str = Field(..., min_length=1, max_length=200)
    legal_name: Optional[str] = Field(None, max_length=200)
    commercial_registration_no: Optional[str] = Field(
        None,
        max_length=32,
        description=(
            "Iraqi commercial registration number (CRN). Format XX-NNNNNN "
            "or bare digits — final format pending R7.1 verification."
        ),
    )
    tax_id: Optional[str] = Field(None, max_length=40, description="TIN / VAT ID")
    industry: Optional[str] = Field(None, max_length=80)
    governorate_code: Optional[str] = Field(
        None, max_length=8, description="IQ-XX preset code from iraqi_tax_presets"
    )
    phone: Optional[str] = Field(None, max_length=32)
    email: Optional[str] = Field(None, max_length=160)
    address_line1: Optional[str] = Field(None, max_length=200)
    address_line2: Optional[str] = Field(None, max_length=200)
    city: Optional[str] = Field(None, max_length=80)
    country: str = Field("IQ", min_length=2, max_length=2)
    base_currency: str = Field("IQD", min_length=3, max_length=3)

    @field_validator("commercial_registration_no")
    @classmethod
    def _check_crn(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        return validate_commercial_registration_no(value)


class CompanyProfileCreate(CompanyProfileBase):
    pass


class CompanyProfileUpdate(BaseModel):
    """All fields optional — partial PATCH-style update."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    legal_name: Optional[str] = Field(None, max_length=200)
    commercial_registration_no: Optional[str] = Field(None, max_length=32)
    tax_id: Optional[str] = Field(None, max_length=40)
    industry: Optional[str] = Field(None, max_length=80)
    governorate_code: Optional[str] = Field(None, max_length=8)
    phone: Optional[str] = Field(None, max_length=32)
    email: Optional[str] = Field(None, max_length=160)
    address_line1: Optional[str] = Field(None, max_length=200)
    address_line2: Optional[str] = Field(None, max_length=200)
    city: Optional[str] = Field(None, max_length=80)
    country: Optional[str] = Field(None, min_length=2, max_length=2)
    base_currency: Optional[str] = Field(None, min_length=3, max_length=3)

    @field_validator("commercial_registration_no")
    @classmethod
    def _check_crn(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        return validate_commercial_registration_no(value)


class CompanyProfileResponse(CompanyProfileBase):
    id: str
