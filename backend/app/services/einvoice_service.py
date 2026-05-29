import base64
import hashlib
import io
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Any, Optional

import httpx
import qrcode

try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False


SENSITIVE_CONFIG_KEYS = {
    "api_key",
    "auth_token",
    "private_key_password",
    "private_key_pem",
}

DEFAULT_EINVOICE_CONFIG = {
    "enabled": False,
    "preview_mode": True,
    "environment": "sandbox",
    "portal_url": "",
    "status_url_template": "",
    "cancel_url": "",
    "seller_tax_id": "",
    "branch_code": "",
    "auto_submit_on_send": False,
}


def _iso_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _date_only(value: Any) -> str:
    return _iso_value(value)[:10]


def _money(value: Any) -> str:
    try:
        return f"{float(value or 0):.2f}"
    except (TypeError, ValueError):
        return "0.00"


def merge_einvoice_config(raw_config: Optional[dict]) -> dict:
    merged = {**DEFAULT_EINVOICE_CONFIG}
    if raw_config:
        merged.update(raw_config)
    return merged


def is_einvoice_production_ready(config: Optional[dict]) -> bool:
    """True when e-invoice can submit to a live ITA portal (not preview)."""
    merged = merge_einvoice_config(config)
    return bool(
        merged.get("enabled")
        and not merged.get("preview_mode", True)
        and str(merged.get("portal_url") or "").strip()
    )


def mask_einvoice_config(raw_config: Optional[dict]) -> dict:
    config = merge_einvoice_config(raw_config)
    masked = {**config}
    for key in SENSITIVE_CONFIG_KEYS:
        if masked.get(key):
            masked[key] = "********"
    masked["has_private_key"] = bool(config.get("private_key_pem"))
    return masked


def generate_fiscal_id(invoice: dict, existing_fiscal_id: Optional[str] = None) -> str:
    if existing_fiscal_id:
        return existing_fiscal_id
    invoice_number = str(invoice.get("invoice_number") or invoice.get("id") or "INV")
    return f"IQ-{invoice_number}-{uuid.uuid4().hex[:8].upper()}"


def generate_qr_payload(invoice: dict, seller_tax_id: str, fiscal_id: str) -> str:
    invoice_number = str(invoice.get("invoice_number") or invoice.get("id") or "")
    return "|".join(
        [
            "IQ",
            seller_tax_id or "UNKNOWN",
            invoice_number,
            _money(invoice.get("total")),
            _date_only(invoice.get("date")),
            fiscal_id,
        ]
    )


def generate_qr_png_bytes(payload: str) -> bytes:
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(payload)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def generate_qr_base64(payload: str) -> str:
    return base64.b64encode(generate_qr_png_bytes(payload)).decode()


def generate_xml(
    invoice: dict,
    organization: dict,
    contact: Optional[dict],
    lines: list[dict],
    seller_tax_id: str,
    fiscal_id: str,
) -> str:
    root = ET.Element("IraqEInvoice", attrib={"version": "1.0"})

    header = ET.SubElement(root, "Header")
    ET.SubElement(header, "FiscalId").text = fiscal_id
    ET.SubElement(header, "InvoiceNumber").text = str(invoice.get("invoice_number") or invoice.get("id") or "")
    ET.SubElement(header, "InvoiceDate").text = _date_only(invoice.get("date"))
    ET.SubElement(header, "CurrencyCode").text = str(invoice.get("currency_code") or "IQD")
    ET.SubElement(header, "Status").text = str(invoice.get("status") or "draft")

    seller = ET.SubElement(root, "Seller")
    ET.SubElement(seller, "Name").text = str(organization.get("name") or "")
    ET.SubElement(seller, "TaxId").text = seller_tax_id or ""
    ET.SubElement(seller, "BranchCode").text = str(organization.get("branch_code") or "")

    buyer = ET.SubElement(root, "Buyer")
    ET.SubElement(buyer, "Name").text = str((contact or {}).get("display_name") or (contact or {}).get("company_name") or "")
    ET.SubElement(buyer, "Email").text = str((contact or {}).get("email") or "")
    ET.SubElement(buyer, "Phone").text = str((contact or {}).get("phone") or (contact or {}).get("mobile") or "")
    ET.SubElement(buyer, "TaxNumber").text = str((contact or {}).get("tax_number") or "")

    totals = ET.SubElement(root, "Totals")
    ET.SubElement(totals, "Subtotal").text = _money(invoice.get("subtotal"))
    ET.SubElement(totals, "TaxAmount").text = _money(invoice.get("tax_amount"))
    ET.SubElement(totals, "DiscountAmount").text = _money(invoice.get("discount_amount"))
    ET.SubElement(totals, "ShippingCharge").text = _money(invoice.get("shipping_charge"))
    ET.SubElement(totals, "Adjustment").text = _money(invoice.get("adjustment"))
    ET.SubElement(totals, "Total").text = _money(invoice.get("total"))
    ET.SubElement(totals, "BalanceDue").text = _money(invoice.get("balance_due"))

    lines_node = ET.SubElement(root, "Lines")
    for index, line in enumerate(lines, start=1):
        line_node = ET.SubElement(lines_node, "Line", attrib={"number": str(index)})
        ET.SubElement(line_node, "Description").text = str(line.get("description") or "")
        ET.SubElement(line_node, "ItemId").text = str(line.get("item_id") or "")
        ET.SubElement(line_node, "Quantity").text = _money(line.get("quantity"))
        ET.SubElement(line_node, "UnitPrice").text = _money(line.get("unit_price"))
        ET.SubElement(line_node, "DiscountAmount").text = _money(line.get("discount_amount"))
        ET.SubElement(line_node, "TaxAmount").text = _money(line.get("tax_amount"))
        ET.SubElement(line_node, "LineTotal").text = _money(line.get("line_total"))

    xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return xml_bytes.decode("utf-8")


def sign_xml(
    xml_content: str,
    private_key_pem: str = "",
    private_key_password: str = "",
) -> dict:
    xml_bytes = xml_content.encode("utf-8")
    if private_key_pem and CRYPTO_AVAILABLE:
        password_bytes = private_key_password.encode("utf-8") if private_key_password else None
        private_key = serialization.load_pem_private_key(private_key_pem.encode("utf-8"), password=password_bytes)
        signature = private_key.sign(xml_bytes, padding.PKCS1v15(), hashes.SHA256())
        return {
            "signature": base64.b64encode(signature).decode(),
            "algorithm": "RSA-SHA256",
            "preview_signature": False,
        }

    digest = hashlib.sha256(xml_bytes).digest()
    return {
        "signature": base64.b64encode(digest).decode(),
        "algorithm": "SHA256-DIGEST",
        "preview_signature": True,
    }


def verify_provider_response(status_code: int, payload: Any) -> dict:
    payload_dict = payload if isinstance(payload, dict) else {"raw": payload}
    provider_uuid = (
        payload_dict.get("uuid")
        or payload_dict.get("id")
        or payload_dict.get("reference")
        or f"ITA-{uuid.uuid4().hex[:12].upper()}"
    )
    provider_status = str(payload_dict.get("status") or ("submitted" if 200 <= status_code < 300 else "rejected"))
    error_message = None
    if status_code >= 400:
        error_message = str(payload_dict.get("error") or payload_dict.get("message") or payload_dict)
    return {
        "provider_uuid": provider_uuid,
        "provider_status": provider_status,
        "error_message": error_message,
        "provider_payload": payload_dict,
    }


def submit_to_ita(config: dict, xml_content: str, signature_result: dict, invoice: dict, fiscal_id: str) -> dict:
    merged_config = merge_einvoice_config(config)
    if merged_config.get("preview_mode", True) or not merged_config.get("portal_url"):
        preview_uuid = f"PREVIEW-{uuid.uuid4().hex[:12].upper()}"
        return {
            "provider_uuid": preview_uuid,
            "provider_status": "submitted",
            "provider_payload": {
                "preview_mode": True,
                "invoice_number": invoice.get("invoice_number"),
                "fiscal_id": fiscal_id,
                "submitted_at": datetime.utcnow().isoformat(),
            },
            "error_message": None,
        }

    headers = {"Content-Type": "application/json"}
    if merged_config.get("api_key"):
        headers["X-API-Key"] = merged_config["api_key"]
    if merged_config.get("auth_token"):
        headers["Authorization"] = f"Bearer {merged_config['auth_token']}"

    payload = {
        "invoice_number": invoice.get("invoice_number"),
        "fiscal_id": fiscal_id,
        "xml": xml_content,
        "signature": signature_result.get("signature"),
        "signature_algorithm": signature_result.get("algorithm"),
    }

    response = httpx.post(merged_config["portal_url"], json=payload, headers=headers, timeout=30.0)
    try:
        body = response.json()
    except ValueError:
        body = {"raw": response.text}
    return verify_provider_response(response.status_code, body)


def submit_to_portal_stub(org_id: str, invoice_id: str, submission: dict) -> dict:
    """Scheduler-safe stub submit for pending queue items."""
    preview_uuid = f"PREVIEW-{uuid.uuid4().hex[:12].upper()}"
    return {
        "status": "submitted",
        "provider_uuid": preview_uuid,
        "org_id": org_id,
        "invoice_id": invoice_id,
        "submission_id": submission.get("id"),
    }


def fetch_submission_status(config: dict, provider_uuid: str, fallback_status: str) -> dict:
    merged_config = merge_einvoice_config(config)
    template = merged_config.get("status_url_template") or ""
    if not template or merged_config.get("preview_mode", True):
        return {
            "provider_uuid": provider_uuid,
            "provider_status": fallback_status,
            "provider_payload": {"preview_mode": merged_config.get("preview_mode", True)},
            "error_message": None,
        }

    response = httpx.get(template.format(uuid=provider_uuid), timeout=20.0)
    try:
        body = response.json()
    except ValueError:
        body = {"raw": response.text}
    return verify_provider_response(response.status_code, body)


def cancel_submission(config: dict, provider_uuid: str, reason: str = "") -> dict:
    merged_config = merge_einvoice_config(config)
    cancel_url = merged_config.get("cancel_url") or ""
    if not cancel_url or merged_config.get("preview_mode", True):
        return {
            "provider_uuid": provider_uuid,
            "provider_status": "cancelled",
            "provider_payload": {
                "preview_mode": merged_config.get("preview_mode", True),
                "reason": reason,
            },
            "error_message": None,
        }

    headers = {"Content-Type": "application/json"}
    if merged_config.get("api_key"):
        headers["X-API-Key"] = merged_config["api_key"]
    if merged_config.get("auth_token"):
        headers["Authorization"] = f"Bearer {merged_config['auth_token']}"

    response = httpx.post(
        cancel_url,
        json={"uuid": provider_uuid, "reason": reason},
        headers=headers,
        timeout=20.0,
    )
    try:
        body = response.json()
    except ValueError:
        body = {"raw": response.text}
    return verify_provider_response(response.status_code, body)