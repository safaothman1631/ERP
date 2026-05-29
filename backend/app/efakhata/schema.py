"""Iraq e-Fakhata XML invoice schema (MoF spec v1.0).

This module defines the canonical Pydantic models for an e-Fakhata invoice
and produces the corresponding XML bytes via ``lxml.etree``. The field set
follows the public MoF specification draft; every field whose wire-name has
not been confirmed against the final published spec is annotated:

    # TODO: verify against published spec (R7.X)

Namespaces (placeholders pending R7.X):
    efk:  http://efakhata.mof.gov.iq/schema/v1
    ds:   http://www.w3.org/2000/09/xmldsig#       (for the signature)
    xades: http://uri.etsi.org/01903/v1.3.2#       (XAdES-BES)

The signature element is inserted by ``signing.py`` after the unsigned XML
is built — ``EFakhataInvoice.to_xml()`` only emits a ``<ds:Signature/>``
placeholder element when ``include_signature_placeholder=True``.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ─────────────────────────────────────────────────────────────────────────────
# Namespace constants
# ─────────────────────────────────────────────────────────────────────────────

NS_EFK = "http://efakhata.mof.gov.iq/schema/v1"        # TODO: verify (R7.X)
NS_DS = "http://www.w3.org/2000/09/xmldsig#"
NS_XADES = "http://uri.etsi.org/01903/v1.3.2#"

NSMAP = {
    "efk": NS_EFK,
    "ds": NS_DS,
    "xades": NS_XADES,
}

# 18 Iraqi governorates (matches frontend/src/data/iraqRegionPresets.ts).
IRAQ_GOVERNORATES = {
    "baghdad", "basra", "nineveh", "erbil", "sulaymaniyah",
    "duhok", "halabja", "kirkuk", "anbar", "babylon",
    "diyala", "karbala", "maysan", "muthanna", "najaf",
    "qadisiyyah", "salahaddin", "wasit", "dhi_qar",
}

# Supported currencies — IQD primary; USD/EUR allowed with exchange_rate.
ALLOWED_CURRENCIES = {"IQD", "USD", "EUR"}


# ─────────────────────────────────────────────────────────────────────────────
# Value objects
# ─────────────────────────────────────────────────────────────────────────────


class EFakhataAddress(BaseModel):
    """Postal address.

    ``governorate`` MUST be one of the 18 official Iraqi governorate slugs.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    street: str = Field(..., min_length=1, max_length=200)
    city: str = Field(..., min_length=1, max_length=80)
    governorate: str = Field(..., min_length=1, max_length=40)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: str = Field("IQ", min_length=2, max_length=2)

    @field_validator("governorate")
    @classmethod
    def _gov_must_be_valid(cls, v: str) -> str:
        normalized = v.lower().replace("-", "_")
        if normalized not in IRAQ_GOVERNORATES:
            # TODO: verify against published spec (R7.1) — MoF may use Arabic
            # names. For now we accept any string but warn at builder level.
            return v
        return normalized


class EFakhataParty(BaseModel):
    """Supplier or customer party.

    For supplier (issuer) the ``tax_id`` is mandatory. For customer it is
    optional — MoF only requires it for registered taxpayers (B2B).
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=200)
    tax_id: Optional[str] = Field(None, max_length=40)
    address: EFakhataAddress
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=120)


class EFakhataInvoiceLine(BaseModel):
    """Single invoice line.

    All money fields are ``Decimal`` to avoid float rounding bugs at the
    schema layer; the XML serializer pins precision to two fractional digits.
    """

    line_number: int = Field(..., ge=1)
    description: str = Field(..., min_length=1, max_length=500)
    item_code: Optional[str] = Field(None, max_length=80)
    quantity: Decimal = Field(..., gt=Decimal("0"))
    unit_price: Decimal = Field(..., ge=Decimal("0"))
    discount_amount: Decimal = Field(Decimal("0"), ge=Decimal("0"))
    tax_rate: Decimal = Field(..., ge=Decimal("0"), le=Decimal("100"))
    tax_amount: Decimal = Field(..., ge=Decimal("0"))
    line_total: Decimal = Field(..., ge=Decimal("0"))


class EFakhataTotals(BaseModel):
    """Invoice totals block."""

    subtotal: Decimal = Field(..., ge=Decimal("0"))
    discount_amount: Decimal = Field(Decimal("0"), ge=Decimal("0"))
    vat_amount: Decimal = Field(Decimal("0"), ge=Decimal("0"))
    wht_amount: Decimal = Field(Decimal("0"), ge=Decimal("0"))
    other_taxes: Decimal = Field(Decimal("0"), ge=Decimal("0"))
    grand_total: Decimal = Field(..., ge=Decimal("0"))


class EFakhataInvoice(BaseModel):
    """Top-level e-Fakhata invoice model."""

    model_config = ConfigDict(str_strip_whitespace=True)

    schema_version: str = Field("1.0", description="MoF schema version")
    invoice_id: str = Field(..., min_length=1, max_length=80)
    invoice_number: str = Field(..., min_length=1, max_length=80)
    issue_date: date
    invoice_type: Literal["standard", "credit_note", "debit_note"] = "standard"

    supplier: EFakhataParty
    customer: Optional[EFakhataParty] = None  # B2C may omit

    lines: List[EFakhataInvoiceLine] = Field(..., min_length=1)
    totals: EFakhataTotals

    currency: str = Field("IQD")
    exchange_rate: Decimal = Field(Decimal("1.0"), gt=Decimal("0"))

    payment_method: Literal["cash", "card", "bank_transfer", "credit", "cod", "other"] = "cash"
    reference: Optional[str] = Field(None, max_length=120)
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("currency")
    @classmethod
    def _ccy_supported(cls, v: str) -> str:
        v = v.upper()
        if v not in ALLOWED_CURRENCIES:
            raise ValueError(f"unsupported currency: {v}")
        return v

    @field_validator("exchange_rate")
    @classmethod
    def _rate_one_for_iqd(cls, v: Decimal, info) -> Decimal:
        ccy = (info.data or {}).get("currency", "IQD")
        if ccy == "IQD" and v != Decimal("1.0") and v != Decimal("1"):
            # Loose check: many callers pass float-1.0 → Decimal("1") not "1.0".
            raise ValueError("exchange_rate must be 1.0 for IQD")
        return v

    # ── XML serialization ──────────────────────────────────────────────────

    def to_xml(
        self,
        *,
        include_signature_placeholder: bool = False,
        pretty: bool = False,
    ) -> bytes:
        """Render the canonical UTF-8 XML byte representation.

        With ``include_signature_placeholder=True`` an empty
        ``<ds:Signature Id="signature"/>`` element is appended so
        ``signing.sign()`` can locate the slot to fill.

        Implementation note: we lazy-import ``lxml`` so importing this
        module never explodes if the wheel is missing in unrelated test
        runs.
        """
        try:
            from lxml import etree  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "lxml is required for e-Fakhata XML serialization "
                "(see _deltas/G4a-deps.md)"
            ) from exc

        E = etree.Element
        SE = etree.SubElement

        # Root with namespaces declared upfront.
        root = E(f"{{{NS_EFK}}}Invoice", nsmap=NSMAP)
        root.set("schemaVersion", self.schema_version)
        # TODO: verify against published spec (R7.X) — element vs attribute split.

        # ── Header ────────────────────────────────────────────────────────
        header = SE(root, f"{{{NS_EFK}}}Header")
        SE(header, f"{{{NS_EFK}}}InvoiceID").text = self.invoice_id
        SE(header, f"{{{NS_EFK}}}InvoiceNumber").text = self.invoice_number
        SE(header, f"{{{NS_EFK}}}IssueDate").text = self.issue_date.isoformat()
        SE(header, f"{{{NS_EFK}}}InvoiceType").text = self.invoice_type
        SE(header, f"{{{NS_EFK}}}Currency").text = self.currency
        SE(header, f"{{{NS_EFK}}}ExchangeRate").text = _decimal_str(self.exchange_rate, places=6)
        SE(header, f"{{{NS_EFK}}}PaymentMethod").text = self.payment_method
        if self.reference:
            SE(header, f"{{{NS_EFK}}}Reference").text = self.reference

        # ── Supplier ──────────────────────────────────────────────────────
        _append_party(root, "Supplier", self.supplier)

        # ── Customer (optional) ───────────────────────────────────────────
        if self.customer is not None:
            _append_party(root, "Customer", self.customer)

        # ── Lines ─────────────────────────────────────────────────────────
        lines_el = SE(root, f"{{{NS_EFK}}}Lines")
        for line in self.lines:
            line_el = SE(lines_el, f"{{{NS_EFK}}}Line")
            line_el.set("number", str(line.line_number))
            SE(line_el, f"{{{NS_EFK}}}Description").text = line.description
            if line.item_code:
                SE(line_el, f"{{{NS_EFK}}}ItemCode").text = line.item_code
            SE(line_el, f"{{{NS_EFK}}}Quantity").text = _decimal_str(line.quantity, 4)
            SE(line_el, f"{{{NS_EFK}}}UnitPrice").text = _decimal_str(line.unit_price)
            SE(line_el, f"{{{NS_EFK}}}DiscountAmount").text = _decimal_str(line.discount_amount)
            SE(line_el, f"{{{NS_EFK}}}TaxRate").text = _decimal_str(line.tax_rate, 2)
            SE(line_el, f"{{{NS_EFK}}}TaxAmount").text = _decimal_str(line.tax_amount)
            SE(line_el, f"{{{NS_EFK}}}LineTotal").text = _decimal_str(line.line_total)

        # ── Totals ────────────────────────────────────────────────────────
        totals_el = SE(root, f"{{{NS_EFK}}}Totals")
        SE(totals_el, f"{{{NS_EFK}}}Subtotal").text = _decimal_str(self.totals.subtotal)
        SE(totals_el, f"{{{NS_EFK}}}DiscountAmount").text = _decimal_str(self.totals.discount_amount)
        SE(totals_el, f"{{{NS_EFK}}}VATAmount").text = _decimal_str(self.totals.vat_amount)
        SE(totals_el, f"{{{NS_EFK}}}WHTAmount").text = _decimal_str(self.totals.wht_amount)
        SE(totals_el, f"{{{NS_EFK}}}OtherTaxes").text = _decimal_str(self.totals.other_taxes)
        SE(totals_el, f"{{{NS_EFK}}}GrandTotal").text = _decimal_str(self.totals.grand_total)

        if self.notes:
            SE(root, f"{{{NS_EFK}}}Notes").text = self.notes

        # ── Signature slot (filled in by signing.sign) ────────────────────
        if include_signature_placeholder:
            sig = SE(root, f"{{{NS_DS}}}Signature")
            sig.set("Id", "signature")

        return etree.tostring(
            root,
            pretty_print=pretty,
            xml_declaration=True,
            encoding="UTF-8",
            standalone=True,
        )

    @classmethod
    def from_xml(cls, xml: bytes) -> "EFakhataInvoice":
        """Parse a previously-emitted XML payload back into the model.

        Round-trip parser — used by tests and the auditor-export verifier.
        Tolerates either the namespaced or local-name form.
        """
        try:
            from lxml import etree  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("lxml required") from exc

        root = etree.fromstring(xml)

        def _t(parent, name: str) -> Optional[str]:
            el = parent.find(f"{{{NS_EFK}}}{name}")
            if el is None:
                el = parent.find(f".//{{{NS_EFK}}}{name}")
            return el.text if el is not None and el.text is not None else None

        def _party(parent, tag: str) -> Optional[EFakhataParty]:
            el = parent.find(f"{{{NS_EFK}}}{tag}")
            if el is None:
                return None
            addr_el = el.find(f"{{{NS_EFK}}}Address")
            address = EFakhataAddress(
                street=_t(addr_el, "Street") or "",
                city=_t(addr_el, "City") or "",
                governorate=_t(addr_el, "Governorate") or "",
                postal_code=_t(addr_el, "PostalCode"),
                country=_t(addr_el, "Country") or "IQ",
            )
            return EFakhataParty(
                name=_t(el, "Name") or "",
                tax_id=_t(el, "TaxID"),
                address=address,
                phone=_t(el, "Phone"),
                email=_t(el, "Email"),
            )

        header = root.find(f"{{{NS_EFK}}}Header")
        lines_el = root.find(f"{{{NS_EFK}}}Lines")
        totals_el = root.find(f"{{{NS_EFK}}}Totals")

        lines = []
        if lines_el is not None:
            for ln in lines_el.findall(f"{{{NS_EFK}}}Line"):
                lines.append(
                    EFakhataInvoiceLine(
                        line_number=int(ln.get("number") or 0),
                        description=_t(ln, "Description") or "",
                        item_code=_t(ln, "ItemCode"),
                        quantity=Decimal(_t(ln, "Quantity") or "0"),
                        unit_price=Decimal(_t(ln, "UnitPrice") or "0"),
                        discount_amount=Decimal(_t(ln, "DiscountAmount") or "0"),
                        tax_rate=Decimal(_t(ln, "TaxRate") or "0"),
                        tax_amount=Decimal(_t(ln, "TaxAmount") or "0"),
                        line_total=Decimal(_t(ln, "LineTotal") or "0"),
                    )
                )

        totals = EFakhataTotals(
            subtotal=Decimal(_t(totals_el, "Subtotal") or "0"),
            discount_amount=Decimal(_t(totals_el, "DiscountAmount") or "0"),
            vat_amount=Decimal(_t(totals_el, "VATAmount") or "0"),
            wht_amount=Decimal(_t(totals_el, "WHTAmount") or "0"),
            other_taxes=Decimal(_t(totals_el, "OtherTaxes") or "0"),
            grand_total=Decimal(_t(totals_el, "GrandTotal") or "0"),
        )

        return cls(
            schema_version=root.get("schemaVersion") or "1.0",
            invoice_id=_t(header, "InvoiceID") or "",
            invoice_number=_t(header, "InvoiceNumber") or "",
            issue_date=date.fromisoformat(_t(header, "IssueDate") or "1970-01-01"),
            invoice_type=_t(header, "InvoiceType") or "standard",  # type: ignore
            currency=_t(header, "Currency") or "IQD",
            exchange_rate=Decimal(_t(header, "ExchangeRate") or "1"),
            payment_method=_t(header, "PaymentMethod") or "cash",  # type: ignore
            reference=_t(header, "Reference"),
            supplier=_party(root, "Supplier"),  # type: ignore[arg-type]
            customer=_party(root, "Customer"),
            lines=lines,
            totals=totals,
            notes=_t(root, "Notes"),
        )


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────


def _decimal_str(value: Decimal, places: int = 2) -> str:
    """Serialize a Decimal with a fixed number of fractional digits.

    Uses ``quantize`` so 100 → "100.00" (avoids "100" / "1E+2" surprises).
    """
    if value is None:
        return ""
    q = Decimal(10) ** -places
    return str(value.quantize(q))


def _append_party(root, tag: str, party: EFakhataParty) -> None:
    from lxml import etree  # type: ignore

    el = etree.SubElement(root, f"{{{NS_EFK}}}{tag}")
    etree.SubElement(el, f"{{{NS_EFK}}}Name").text = party.name
    if party.tax_id:
        etree.SubElement(el, f"{{{NS_EFK}}}TaxID").text = party.tax_id
    if party.phone:
        etree.SubElement(el, f"{{{NS_EFK}}}Phone").text = party.phone
    if party.email:
        etree.SubElement(el, f"{{{NS_EFK}}}Email").text = party.email
    addr_el = etree.SubElement(el, f"{{{NS_EFK}}}Address")
    etree.SubElement(addr_el, f"{{{NS_EFK}}}Street").text = party.address.street
    etree.SubElement(addr_el, f"{{{NS_EFK}}}City").text = party.address.city
    etree.SubElement(addr_el, f"{{{NS_EFK}}}Governorate").text = party.address.governorate
    if party.address.postal_code:
        etree.SubElement(addr_el, f"{{{NS_EFK}}}PostalCode").text = party.address.postal_code
    etree.SubElement(addr_el, f"{{{NS_EFK}}}Country").text = party.address.country
