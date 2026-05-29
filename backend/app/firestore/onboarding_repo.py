"""Repository for onboarding wizard state + COA-template application.

Two responsibilities:

  1. ``OnboardingRepository`` — persists the wizard's ``OnboardingState`` blob
     under ``onboarding_state/{tenant_id}`` (one document per tenant). The
     ``expires_at`` field is server-set to ``started_at + 30d``; the TTL
     middleware (``app.services.ttl_fields``) cleans up abandoned drafts.
  2. ``apply_coa(tenant_id, template_name, overrides)`` — reads
     ``backend/app/data/coa_templates/{name}.yaml``, materialises the accounts
     into ``tenants/{tid}/accounts`` via the existing ``AccountRepository``
     (so write models, audit, and cascade behaviour stay consistent), and
     returns the new doc IDs plus the resolved ``is_default_for`` mapping.

Both functions are idempotent enough for HTTP ``Idempotency-Key`` replay:
``put_state`` overwrites the single tenant document, and ``apply_coa`` skips
accounts whose ``code`` already exists for the tenant (an audit-friendly
"re-apply" semantics rather than "wipe + recreate").
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from app.firestore.accounts import AccountRepository
from app.firestore.base import BaseRepository

logger = logging.getLogger(__name__)


# Where the YAML templates live. Resolved relative to the app package so it
# works under both ``pytest`` (cwd=backend/) and ``uvicorn app.main`` deploys.
_TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "data" / "coa_templates"

# Wizard drafts expire 30 days after `started_at` (R3.4 — abandoned-state TTL).
_DRAFT_TTL_DAYS = 30


# ── State repository ────────────────────────────────────────────────────

class OnboardingRepository(BaseRepository):
    """Single-document-per-tenant store for the wizard's state envelope.

    We reuse ``BaseRepository`` to inherit caching, soft-delete, and the
    ``org_id`` scope enforcement; the document id is the ``tenant_id`` so
    GETs are an O(1) lookup.
    """

    collection_name = "onboarding_state"

    def get_state(self, tenant_id: str) -> Optional[dict]:
        """Returns the raw persisted state dict or ``None`` if no draft yet."""
        doc = self.get(tenant_id)
        if not doc:
            return None
        # Strip BaseRepository-injected metadata that the schema doesn't model.
        doc.pop("is_deleted", None)
        return doc

    def put_state(self, tenant_id: str, state: dict) -> dict:
        """Idempotent upsert; replaces the whole envelope.

        Sets ``started_at`` on first write and computes ``expires_at`` if not
        already completed. Honors caller-supplied ``completed_at`` (the
        ``/complete`` endpoint sets it).
        """
        existing = self.get(tenant_id)
        now = datetime.utcnow()
        payload: dict[str, Any] = dict(state)
        # First-write timestamps.
        if existing:
            payload.setdefault("started_at", existing.get("started_at") or now)
        else:
            payload.setdefault("started_at", now)
        if not payload.get("completed_at"):
            started = payload["started_at"]
            if isinstance(started, str):
                try:
                    started = datetime.fromisoformat(started.replace("Z", ""))
                except Exception:
                    started = now
            payload["expires_at"] = started + timedelta(days=_DRAFT_TTL_DAYS)
        else:
            payload["expires_at"] = None

        if existing:
            return self.update(tenant_id, payload)
        return self.create({"id": tenant_id, **payload})

    def complete(self, tenant_id: str) -> dict:
        """Stamp ``completed_at`` on the existing state (creating it if absent)."""
        now = datetime.utcnow()
        existing = self.get(tenant_id) or {}
        existing["completed_at"] = now
        existing["current_step"] = "completed"
        existing["expires_at"] = None
        return self.put_state(tenant_id, existing)


# ── COA template loader + applier ───────────────────────────────────────

_TEMPLATE_CACHE: dict[str, dict] = {}


def _load_template(name: str) -> dict:
    """Reads + parses a COA template YAML. Cached in-process after first load."""
    if name in _TEMPLATE_CACHE:
        return _TEMPLATE_CACHE[name]
    path = _TEMPLATES_DIR / f"{name}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"coa_template_not_found:{name}")
    try:
        import yaml  # type: ignore
    except ImportError as exc:  # pragma: no cover - pyyaml is in requirements
        raise RuntimeError(
            "pyyaml is required to load COA templates; install via "
            "`pip install pyyaml` (see backend/requirements.txt)."
        ) from exc
    with path.open("r", encoding="utf-8") as fp:
        data = yaml.safe_load(fp) or {}
    if not isinstance(data, dict) or "accounts" not in data:
        raise ValueError(f"coa_template_malformed:{name}")
    _TEMPLATE_CACHE[name] = data
    return data


def list_template_names() -> list[str]:
    """Returns the slug of every YAML template present on disk."""
    if not _TEMPLATES_DIR.exists():
        return []
    return sorted(p.stem for p in _TEMPLATES_DIR.glob("*.yaml"))


def get_template(name: str) -> dict:
    """Public accessor for the loaded template dict (used by tests + future UI preview)."""
    return _load_template(name)


def apply_coa(
    org_id: str,
    template_name: str,
    overrides: Optional[list[dict]] = None,
) -> dict:
    """Materialise a COA template into ``tenants/{org_id}/accounts``.

    Idempotent: accounts whose ``code`` already exists for the tenant are
    skipped (their existing id is returned in ``ids``). The first pass
    creates parent rows (parent=null) so a second pass can resolve
    ``parent_code → parent_id`` links.

    Returns ``{accounts_created, ids, default_account_map}`` where
    ``default_account_map`` maps each ``is_default_for`` key (e.g.
    ``default_cash``) to the resulting account id — used by the wizard to
    populate ``tenants/{tid}/profile.default_accounts``.
    """
    template = _load_template(template_name)
    raw_accounts: list[dict] = template.get("accounts") or []
    override_by_code: dict[str, dict] = {o.get("code"): o for o in (overrides or []) if o.get("code")}

    repo = AccountRepository(org_id)

    # Pre-flight: existing codes for this tenant, to keep this idempotent.
    existing_items, _ = repo.list(limit=500)
    existing_by_code: dict[str, str] = {
        (it.get("code") or ""): it["id"] for it in existing_items if it.get("code")
    }

    code_to_id: dict[str, str] = dict(existing_by_code)
    created_ids: list[str] = []
    default_account_map: dict[str, str] = {}

    # Two-pass: first roots (parent=null), then children. The YAML is already
    # in dependency order but we don't rely on it.
    def _pass(filter_fn) -> None:
        for row in raw_accounts:
            if not filter_fn(row):
                continue
            code = str(row.get("code") or "").strip()
            if not code:
                continue
            ov = override_by_code.get(code) or {}
            final_code = ov.get("new_code") or code
            display_name = ov.get("name") or row.get("name_en") or row.get("name") or code

            # Idempotency: skip if a row with this code already exists.
            if final_code in code_to_id:
                if row.get("is_default_for"):
                    default_account_map[row["is_default_for"]] = code_to_id[final_code]
                continue

            parent_code = row.get("parent") or row.get("parent_code")
            parent_id = code_to_id.get(str(parent_code)) if parent_code else None

            payload = {
                "code": final_code,
                "name": display_name,
                "name_ku": row.get("name_ku"),
                "name_ar": row.get("name_ar"),
                "account_type": row.get("type") or row.get("account_type") or "asset",
                "parent_id": parent_id,
                "is_active": True,
                "currency_code": row.get("currency_code", "IQD"),
                # Carry through template flags so downstream features
                # (POS cash drawer, bank rec, etc.) can find their seats.
                "is_cash": bool(row.get("is_cash")),
                "is_bank": bool(row.get("is_bank")),
                "is_header": bool(row.get("is_header")),
            }
            try:
                created = repo.create(payload)
            except Exception as exc:
                # Schema validation may strip unknown fields — fall back to
                # the minimum required payload.
                logger.warning(
                    "coa_account_create_failed code=%s err=%s — retrying minimal",
                    final_code, exc,
                )
                created = repo.create({
                    "code": final_code,
                    "name": display_name,
                    "account_type": payload["account_type"],
                    "parent_id": parent_id,
                })
            new_id = created["id"]
            code_to_id[final_code] = new_id
            created_ids.append(new_id)
            if row.get("is_default_for"):
                default_account_map[row["is_default_for"]] = new_id

    # Pass 1 — roots
    _pass(lambda r: not (r.get("parent") or r.get("parent_code")))
    # Pass 2 — children (may chain through several levels; loop until stable)
    for _ in range(10):
        before = len(created_ids)
        _pass(lambda r: bool(r.get("parent") or r.get("parent_code")))
        if len(created_ids) == before:
            break

    return {
        "accounts_created": len(created_ids),
        "ids": created_ids,
        "default_account_map": default_account_map,
        "template": template_name,
    }
