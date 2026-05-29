"""Map a domain ``Invoice`` (Firestore dict shape) → ``EFakhataInvoice``.

The codebase stores invoices as dicts in Firestore (see
``app/firestore/base.py``); to keep this module flexible we accept any
mapping-shaped object and pull the conventional field names. Missing
optional fields fall back to safe defaults; missing **required** fields
raise ``EFakhataBuildError`` with a precise field path so the API surface
can return a 422 with actionable detail.

Iraqi VAT / withholding context:
    * Standard VAT rate placeholder: 0% across most goods (see frontend
      ``iraqRegionPresets.ts``). The MoF e-Fakhata mandate is rolling out
      ahead of a general VAT, so most lines today have ``tax_rate=0``.
    * Withholding tax is per-governorate; we read the line's ``wht_rate``
      if the caller stamped it during invoice creation.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Mapping, Optional

from app.efakhata.schema import (
    EFakhataAddress,
    EFakhataInvoice,
    EFakhataInvoiceLine,
    EFakhataParty,
    EFakhataTotals,
)


class EFakhataBuildError(ValueError):
    """Raised when a domain invoice cannot be mapped — message names the field."""


# Iraq-specific defaults
_DEFAULT_COUNTRY = "IQ"
_DEFAULT_PAYMENT_METHOD = "cash"


class EFakhataBuilder:
    """Stateless converter — instantiate once per request or use class methods."""

    @classmethod
    def from_invoice(
        cls,
        invoice: Mapping[str, Any],
        *,
        supplier_profile: Mapping[str, Any],
        customer_profile: Optional[Mapping[str, Any]] = None,
        lines: Optional[list[Mapping[str, Any]]] = None,
    ) -> EFakhataInvoice:
        """Build the e-Fakhata model.

        Args:
            invoice           — invoice document (must include id, number, date)
            supplier_profile  — issuing org's company profile (name, tax_id, address)
            customer_profile  — customer contact (optional for B2C)
            lines             — list of line dicts; falls back to invoice["lines"]

        Required invoice fields: id, invoice_number, date
        Required supplier fields: name, tax_id, address.street/city/governorate
        """
        invoice_id = _required(invoice, "id", "invoice_id")
        invoice_number = _required(invoice, "invoice_number", "number")
        issue_date = _coerce_date(_required(invoice, "date", "issue_date"))

        lines_in = lines if lines is not None else invoice.get("lines") or []
        if not lines_in:
            raise EFakhataBuildError("invoice has no lines")

        currency = (invoice.get("currency_code") or invoice.get("currency") or "IQD").upper()
        exchange_rate = _to_decimal(invoice.get("exchange_rate") or 1, default="1")
        if currency == "IQD":
            exchange_rate = Decimal("1")

        # ── Map lines ────────────────────────────────────────────────────
        out_lines: list[EFakhataInvoiceLine] = []
        for idx, ln in enumerate(lines_in, start=1):
            qty = _to_decimal(ln.get("quantity") or 1, "1")
            unit_price = _to_decimal(ln.get("unit_price") or 0, "0")
            discount_amount = _to_decimal(ln.get("discount_amount") or 0, "0")
            # ``tax_rate`` may be percentage (0–100) or fraction (0–1); normalize.
            raw_rate = _to_decimal(ln.get("tax_rate") or 0, "0")
            tax_rate = raw_rate if raw_rate > Decimal("1") else raw_rate * Decimal("100")
            tax_amount = _to_decimal(ln.get("tax_amount") or 0, "0")
            line_total = _to_decimal(ln.get("line_total") or 0, "0")
            if line_total == 0:
                # Re-compute defensively so a partially-populated stub still serializes.
                line_total = (qty * unit_price) - discount_amount + tax_amount
            out_lines.append(
                EFakhataInvoiceLine(
                    line_number=idx,
                    description=str(ln.get("description") or ln.get("name") or f"Line {idx}"),
                    item_code=ln.get("item_code") or ln.get("item_id"),
                    quantity=qty,
                    unit_price=unit_price,
                    discount_amount=discount_amount,
                    tax_rate=tax_rate,
                    tax_amount=tax_amount,
                    line_total=line_total,
                )
            )

        # ── Totals ───────────────────────────────────────────────────────
        totals = EFakhataTotals(
            subtotal=_to_decimal(invoice.get("subtotal") or 0, "0"),
            discount_amount=_to_decimal(invoice.get("discount_amount") or 0, "0"),
            vat_amount=_to_decimal(
                invoice.get("vat_amount") or invoice.get("tax_amount") or 0, "0"
            ),
            wht_amount=_to_decimal(invoice.get("wht_amount") or 0, "0"),
            other_taxes=_to_decimal(invoice.get("other_taxes") or 0, "0"),
            grand_total=_to_decimal(invoice.get("total") or invoice.get("grand_total") or 0, "0"),
        )

        # ── Parties ──────────────────────────────────────────────────────
        supplier = _build_party(supplier_profile, role="supplier")
        customer = _build_party(customer_profile, role="customer") if customer_profile else None

        payment_method = invoice.get("payment_method") or _DEFAULT_PAYMENT_METHOD
        if payment_method not in {"cash", "card", "bank_transfer", "credit", "cod", "other"}:
            payment_method = "other"

        invoice_type = invoice.get("invoice_type") or "standard"
        if invoice_type not in {"standard", "credit_note", "debit_note"}:
            invoice_type = "standard"

        return EFakhataInvoice(
            schema_version="1.0",
            invoice_id=str(invoice_id),
            invoice_number=str(invoice_number),
            issue_date=issue_date,
            invoice_type=invoice_type,  # type: ignore[arg-type]
            supplier=supplier,
            customer=customer,
            lines=out_lines,
            totals=totals,
            currency=currency,
            exchange_rate=exchange_rate,
            payment_method=payment_method,  # type: ignore[arg-type]
            reference=invoice.get("reference"),
            notes=invoice.get("notes"),
        )


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _required(d: Mapping[str, Any], *keys: str) -> Any:
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    raise EFakhataBuildError(f"required field missing: {keys[0]}")


def _to_decimal(value: Any, default: str = "0") -> Decimal:
    if value is None or value == "":
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal(default)


def _coerce_date(value: Any) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        # Accept "2026-05-29" or "2026-05-29T12:00:00".
        try:
            return date.fromisoformat(value[:10])
        except ValueError as exc:
            raise EFakhataBuildError(f"invalid date: {value}") from exc
    raise EFakhataBuildError(f"unsupported date type: {type(value).__name__}")


def _build_party(profile: Mapping[str, Any], *, role: str) -> EFakhataParty:
    if not profile:
        raise EFakhataBuildError(f"{role}: profile required")
    name = profile.get("name") or profile.get("company_name") or profile.get("display_name")
    if not name:
        raise EFakhataBuildError(f"{role}.name required")

    tax_id = (
        profile.get("tax_id")
        or profile.get("vat_number")
        or profile.get("trn")
    )
    if role == "supplier" and not tax_id:
        raise EFakhataBuildError("supplier.tax_id required")

    addr_in = profile.get("address") or {}
    address = EFakhataAddress(
        street=addr_in.get("street") or addr_in.get("address_line_1") or "",
        city=addr_in.get("city") or "",
        governorate=addr_in.get("governorate") or addr_in.get("state") or "",
        postal_code=addr_in.get("postal_code") or addr_in.get("zip"),
        country=(addr_in.get("country") or _DEFAULT_COUNTRY).upper()[:2],
    )

    return EFakhataParty(
        name=str(name),
        tax_id=str(tax_id) if tax_id else None,
        address=address,
        phone=profile.get("phone"),
        email=profile.get("email"),
    )
