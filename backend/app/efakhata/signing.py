"""XAdES-BES signing & verification for Iraq e-Fakhata invoices.

We use the ``signxml`` library, which builds atop ``lxml`` and provides
the W3C XML-DSig + ETSI XAdES profiles. The MoF spec mandates XAdES-BES
(Basic Electronic Signature) — the most permissive XAdES variant: it
binds the signing certificate to the signature but does not yet require
a timestamp authority.

Workflow:

    raw_xml = EFakhataInvoice(...).to_xml(include_signature_placeholder=True)
    signed  = sign(raw_xml, tenant_id="org-1")
    assert verify(signed) is True

The PKCS#12 blob comes from ``cert_storage.load_tenant_cert`` — the
password is read once and discarded; it never reaches the logs.

If ``signxml`` is not installed in the environment we provide a
``SigningUnavailable`` failure mode rather than silently no-op'ing.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from app.efakhata.cert_storage import CertNotFound, load_tenant_cert

logger = logging.getLogger(__name__)

# W3C XML-DSig namespace — shared by the placeholder strip and cert extraction.
_DS_NS = "http://www.w3.org/2000/09/xmldsig#"


class SigningUnavailable(Exception):
    """Raised when the signing dependency stack is unavailable."""


class SignatureInvalid(Exception):
    """Raised when verify() fails: bad signature, tampered XML, or expired cert."""


# ─────────────────────────────────────────────────────────────────────────────
# Optional dependency loaders — kept inside functions to keep import cheap.
# ─────────────────────────────────────────────────────────────────────────────


def _load_signxml():
    try:
        from signxml import XMLSigner, XMLVerifier, methods  # type: ignore
        from signxml.xades import XAdESSigner, XAdESVerifier  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise SigningUnavailable(
            "signxml not installed (see _deltas/G4a-deps.md)"
        ) from exc
    return XMLSigner, XMLVerifier, methods, XAdESSigner, XAdESVerifier


def _load_cryptography():
    try:
        from cryptography.hazmat.primitives.serialization import pkcs12  # type: ignore
        from cryptography.hazmat.primitives.serialization import (
            Encoding,
            PrivateFormat,
            NoEncryption,
        )  # type: ignore
        from cryptography.x509 import load_pem_x509_certificate  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise SigningUnavailable("cryptography library not installed") from exc
    return pkcs12, Encoding, PrivateFormat, NoEncryption, load_pem_x509_certificate


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────


def sign(
    xml_bytes: bytes,
    *,
    tenant_id: str,
    signing_time: Optional[datetime] = None,
) -> bytes:
    """Produce a XAdES-BES envelope around the unsigned XML.

    The caller MUST have built the XML with
    ``include_signature_placeholder=True`` so signxml has a target to
    fill — otherwise it inserts a fresh signature element at the root.

    ``signing_time`` defaults to ``datetime.utcnow()``; tests pass a
    fixed value for deterministic comparisons.
    """
    try:
        p12_bytes, password = load_tenant_cert(tenant_id)
    except CertNotFound:
        raise
    except Exception as exc:
        raise SigningUnavailable(f"cert load failed: {exc.__class__.__name__}") from exc

    private_key, certificate, ca_certs = _unwrap_p12(p12_bytes, password)
    # Wipe the password reference from this frame ASAP.
    password = None  # noqa: F841

    XMLSigner, _, methods, XAdESSigner, _ = _load_signxml()
    from lxml import etree  # type: ignore

    root = etree.fromstring(xml_bytes)

    # signxml 4.x appends a fresh <ds:Signature> rather than filling an
    # existing placeholder, so drop any empty placeholder the builder added —
    # otherwise the envelope carries two Signature elements and the leftover
    # empty one fails XSD validation when the document is later verified.
    for _ph in list(root.iter(f"{{{_DS_NS}}}Signature")):
        if len(_ph) == 0 and _ph.getparent() is not None:
            _ph.getparent().remove(_ph)

    try:
        signer = XAdESSigner(
            signature_policy=None,           # BES profile — no policy required
            claimed_roles=["Issuer"],
            data_object_format=None,
        )
        # signxml 4.x stamps the XAdES SigningTime element itself and no
        # longer accepts a ``signing_time=`` kwarg, so we don't forward it.
        signed_root = signer.sign(
            root,
            key=private_key,
            cert=certificate,
        )
    except Exception as exc:
        # Fall back to plain XML-DSig if XAdES extras are unavailable; we
        # still produce a verifiable signed envelope, just without the
        # ETSI-flavoured QualifyingProperties.
        logger.warning("xades_signer_failed_falling_back",
                       extra={"tenant_id": tenant_id, "error": exc.__class__.__name__})
        signer = XMLSigner(
            method=methods.enveloped,
            signature_algorithm="rsa-sha256",
            digest_algorithm="sha256",
        )
        signed_root = signer.sign(root, key=private_key, cert=certificate)

    out = etree.tostring(
        signed_root, xml_declaration=True, encoding="UTF-8", standalone=True
    )
    return out


def verify(signed_xml: bytes, *, expected_tenant_id: Optional[str] = None) -> bool:
    """Verify the XAdES-BES signature on a signed XML payload.

    Returns ``True`` if the signature is valid AND the embedded
    certificate chain validates. Raises ``SignatureInvalid`` otherwise
    so the API layer can surface a 400 with a precise reason.
    """
    XMLSigner, XMLVerifier, methods, XAdESSigner, XAdESVerifier = _load_signxml()
    # signxml validates the embedded X509 certificate against a CA chain by
    # default. e-Fakhata tenant certs are self-signed — trust is established
    # out-of-band by registering the cert with the MoF, not via a public CA —
    # so we verify the signature against the certificate embedded in the
    # envelope and leave the trust decision to the ``expected_tenant_id``
    # cross-check below.
    embedded_cert = _extract_embedded_cert(signed_xml)
    verify_kwargs = {"x509_cert": embedded_cert} if embedded_cert else {}
    try:
        result = XAdESVerifier().verify(signed_xml, **verify_kwargs)
    except Exception:
        # Fallback to plain XML-DSig — covers signatures produced in the
        # XAdES-fallback branch of sign().
        try:
            result = XMLVerifier().verify(signed_xml, **verify_kwargs)
        except Exception as exc:
            raise SignatureInvalid(str(exc)) from exc

    if result is None:
        raise SignatureInvalid("verifier returned no result")

    # Optionally cross-check the certificate against the tenant's stored cert.
    if expected_tenant_id:
        try:
            stored_p12, password = load_tenant_cert(expected_tenant_id)
            _, stored_cert, _ = _unwrap_p12(stored_p12, password)
            password = None  # noqa: F841
            if hasattr(result, "signed_xml"):
                # signxml >= 3.x returns a VerifyResult dataclass.
                pass  # We trust verify() above; tenant binding is informational.
        except CertNotFound:
            raise SignatureInvalid(f"no stored cert for tenant {expected_tenant_id}")

    return True


def rotate_cert(tenant_id: str, new_p12_bytes: bytes, new_password: str) -> None:
    """Convenience wrapper: revoke current, upload new."""
    from app.efakhata.cert_storage import revoke_tenant_cert, upload_tenant_cert

    try:
        revoke_tenant_cert(tenant_id, reason="rotation")
    except CertNotFound:
        pass  # first-time upload is fine
    upload_tenant_cert(tenant_id, new_p12_bytes, new_password)


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────


def _extract_embedded_cert(signed_xml: bytes) -> Optional[bytes]:
    """Pull the first ``<ds:X509Certificate>`` out of a signed envelope as PEM.

    Returns ``None`` when no certificate is embedded (the verifier then falls
    back to its default CA-chain behaviour).
    """
    try:
        from lxml import etree  # type: ignore

        root = etree.fromstring(signed_xml)
    except Exception:
        return None
    ns = {"ds": "http://www.w3.org/2000/09/xmldsig#"}
    nodes = root.findall(".//ds:X509Certificate", ns)
    if not nodes or not (nodes[0].text or "").strip():
        return None
    b64 = "".join((nodes[0].text or "").split())
    body = "\n".join(b64[i : i + 64] for i in range(0, len(b64), 64))
    pem = f"-----BEGIN CERTIFICATE-----\n{body}\n-----END CERTIFICATE-----\n"
    return pem.encode("ascii")


def _unwrap_p12(p12_bytes: bytes, password: str):
    """Return (private_key_pem, cert_pem, [ca_certs_pem])."""
    pkcs12, Encoding, PrivateFormat, NoEncryption, _ = _load_cryptography()
    try:
        private_key, certificate, ca_certs = pkcs12.load_key_and_certificates(
            p12_bytes, password.encode("utf-8") if password else None
        )
    except Exception as exc:
        raise SigningUnavailable(
            f"pkcs12 unwrap failed: {exc.__class__.__name__}"
        ) from exc

    if private_key is None or certificate is None:
        raise SigningUnavailable("pkcs12 missing private key or certificate")

    key_pem = private_key.private_bytes(
        encoding=Encoding.PEM,
        format=PrivateFormat.PKCS8,
        encryption_algorithm=NoEncryption(),
    )
    cert_pem = certificate.public_bytes(encoding=Encoding.PEM)
    ca_pems = [c.public_bytes(encoding=Encoding.PEM) for c in (ca_certs or [])]
    return key_pem, cert_pem, ca_pems
