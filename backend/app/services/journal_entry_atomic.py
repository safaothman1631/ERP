"""Atomic journal entry creation with account balance updates."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from google.cloud import firestore as fs

from app.cache import cache
from app.firebase_client import get_db

DEBIT_NORMAL_ACCOUNT_TYPES = {
    "asset",
    "cash",
    "bank",
    "accounts_receivable",
    "inventory",
    "fixed_asset",
    "other_current_asset",
    "expense",
    "operating_expense",
    "other_expense",
    "cost_of_goods_sold",
}


def _account_balance_delta(account_type: str, debit: float, credit: float) -> float:
    if account_type in DEBIT_NORMAL_ACCOUNT_TYPES:
        return debit - credit
    return credit - debit


def _normalize_je_date(date_val: "datetime | str") -> datetime:
    """Normalize a JE date (datetime or 'YYYY-MM-DD'[T...]) to a tz-naive datetime.

    Denormalized onto each line doc as ``je_date`` so reports can answer with a
    single ``collection_group('lines')`` range query instead of an N+1 scan
    (one subcollection read per journal entry). Mirrors
    ``report_queries.parse_report_date`` so the line-based range filter matches
    the legacy header-based filter exactly.
    """
    if isinstance(date_val, datetime):
        return date_val.replace(tzinfo=None) if date_val.tzinfo else date_val
    if isinstance(date_val, str):
        try:
            s = date_val.replace(" ", "T").rstrip("Z")
            if len(s) == 10:
                s += "T00:00:00"
            parsed = datetime.fromisoformat(s)
            return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        except Exception:
            pass
    return datetime.utcnow()


def _allocate_sequence_number(
    transaction: fs.Transaction,
    db: Any,
    org_id: str,
    entity_type: str,
) -> str:
    seq_doc_id = f"{org_id}_{entity_type}"
    seq_ref = db.collection("sequences").document(seq_doc_id)
    seq_snap = seq_ref.get(transaction=transaction)
    if seq_snap.exists:
        seq_data = seq_snap.to_dict() or {}
        next_num = int(seq_data.get("next_number", 1))
        prefix = seq_data.get("prefix", entity_type.upper()[:3] + "-")
        padding = int(seq_data.get("padding", 6))
        transaction.update(seq_ref, {"next_number": next_num + 1})
    else:
        next_num = 1
        prefix = entity_type.upper()[:3] + "-"
        padding = 6
        transaction.set(
            seq_ref,
            {
                "org_id": org_id,
                "entity_type": entity_type,
                "prefix": prefix,
                "next_number": 2,
                "padding": padding,
            },
        )
    return f"{prefix}{str(next_num).zfill(padding)}"


def create_journal_entry_in_transaction(
    transaction: fs.Transaction,
    db: Any,
    org_id: str,
    *,
    date: datetime | str,
    lines: list[dict],
    description: str = "",
    reference: str = "",
    source_type: str = "manual",
    source_id: str | None = None,
    currency_code: str = "IQD",
    exchange_rate: float = 1.0,
    created_by: str | None = None,
    company_id: str | None = None,
    entry_id: str | None = None,
    entry_number: str | None = None,
    status: str = "posted",
    extra_header: dict[str, Any] | None = None,
    emit_event: dict[str, Any] | None = None,
) -> tuple[dict, list[str]]:
    now = datetime.utcnow()
    journal_id = entry_id or str(uuid.uuid4())
    # Consolidation: each JE belongs to a legal entity (company) within the org.
    # Defaults to org_id so single-entity orgs are unchanged (primary entity).
    entity_id = company_id or org_id
    journal_ref = db.collection("journal_entries").document(journal_id)

    # Build account refs + line entries (pure — no transaction ops yet).
    account_ids: list[str] = []
    account_refs: dict[str, Any] = {}
    line_entries: list[dict[str, Any]] = []
    for idx, raw_line in enumerate(lines):
        line = dict(raw_line or {})
        account_id = line.get("account_id")
        if not account_id:
            continue
        account_ids.append(account_id)
        if account_id not in account_refs:
            account_refs[account_id] = db.collection("accounts").document(account_id)
        debit = float(line.get("debit", 0) or 0)
        credit = float(line.get("credit", 0) or 0)
        line_id = line.pop("id", None) or str(uuid.uuid4())
        line_entries.append(
            {
                "line_id": line_id,
                "sort_order": idx,
                "account_id": account_id,
                "debit": debit,
                "credit": credit,
                "line_payload": line,
            }
        )

    # === ALL READS FIRST — Firestore transactions forbid read-after-write. ===
    # The account snapshots AND the sequence read must precede every
    # transaction.set below. The mocked unit tests never enforced this ordering,
    # so this read-after-write went unnoticed — and NO journal entry had ever
    # actually posted to live Firestore (every org showed JEs=0). Reordered so
    # all reads happen before the first write.
    account_snaps = {
        aid: account_refs[aid].get(transaction=transaction) for aid in account_refs.keys()
    }
    number = entry_number or _allocate_sequence_number(transaction, db, org_id, "journal")

    total_debit = round(sum(float(line.get("debit", 0) or 0) for line in lines), 2)
    total_credit = round(sum(float(line.get("credit", 0) or 0) for line in lines), 2)

    header = {
        "org_id": org_id,
        "company_id": entity_id,
        "entry_number": number,
        "date": date,
        "description": description,
        "reference": reference,
        "source_type": source_type,
        "source_id": source_id,
        "currency_code": currency_code,
        "exchange_rate": float(exchange_rate or 1.0),
        "total_debit": total_debit,
        "total_credit": total_credit,
        "status": status,
        "is_auto": source_type != "manual",
        "created_by": created_by,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "_version": 1,
        "schema_version": 1,
    }
    if extra_header:
        header.update(extra_header)

    # === WRITES (only after every read above) ===
    transaction.set(journal_ref, header)

    # Denormalized onto each line so accounting reports can aggregate with ONE
    # collection_group('lines') range query (org_id + je_date) instead of an
    # N+1 scan. Void entries are excluded report-side via the header status.
    je_date_norm = _normalize_je_date(date)
    for line in line_entries:
        payload = dict(line["line_payload"])
        payload["sort_order"] = line["sort_order"]
        payload["account_id"] = line["account_id"]
        payload["debit"] = line["debit"]
        payload["credit"] = line["credit"]
        payload["org_id"] = org_id
        payload["company_id"] = entity_id
        payload["je_date"] = je_date_norm
        transaction.set(journal_ref.collection("lines").document(line["line_id"]), payload)

    per_account_delta: dict[str, float] = {}
    for line in line_entries:
        aid = line["account_id"]
        snap = account_snaps.get(aid)
        if not snap or not snap.exists:
            continue
        account = snap.to_dict() or {}
        if account.get("org_id") != org_id:
            continue
        delta = _account_balance_delta(
            str(account.get("account_type", "")),
            float(line["debit"]),
            float(line["credit"]),
        )
        per_account_delta[aid] = per_account_delta.get(aid, 0.0) + delta

    for aid, delta in per_account_delta.items():
        if abs(delta) < 1e-9:
            continue
        transaction.update(
            account_refs[aid],
            {"balance": fs.Increment(delta), "updated_at": now},
        )

    try:
        from app.services.gl_materialisation import apply_je_lines_to_gl

        apply_je_lines_to_gl(transaction, db, org_id, date, lines)
    except Exception as exc:
        import logging

        from app.config import settings

        if getattr(settings, "GL_MATERIALISATION_ENABLED", False):
            logging.getLogger(__name__).error(
                "gl_materialisation_failed",
                extra={"org_id": org_id, "journal_id": journal_id, "error": str(exc)},
            )
            raise

    # Pool 3.3: optionally couple an outbox event to this JE write so a downstream
    # handler fires exactly-once iff the JE commits. LAST write in the transaction
    # (after gl_materialisation's own reads) to preserve Firestore's reads-first
    # rule. Flag-gated: off => emit_event is ignored (zero behavior change).
    if emit_event and emit_event.get("event_type"):
        from app.config import settings as _settings

        if getattr(_settings, "OUTBOX_HOTPATH_ENABLED", False):
            from app.firestore.outbox import enqueue_in_transaction

            enqueue_in_transaction(
                transaction,
                db,
                org_id,
                emit_event["event_type"],
                emit_event.get("payload") or {},
                idempotency_key=emit_event.get("idempotency_key"),
            )

    return {"id": journal_id, **header}, list(account_refs.keys())


def create_journal_entry_atomic(
    org_id: str,
    *,
    date: datetime | str,
    lines: list[dict],
    description: str = "",
    reference: str = "",
    source_type: str = "manual",
    source_id: str | None = None,
    currency_code: str = "IQD",
    exchange_rate: float = 1.0,
    created_by: str | None = None,
    company_id: str | None = None,
    entry_id: str | None = None,
    entry_number: str | None = None,
    status: str = "posted",
    extra_header: dict[str, Any] | None = None,
    emit_event: dict[str, Any] | None = None,
) -> dict:
    db = get_db()

    @fs.transactional
    def _create(transaction: fs.Transaction) -> tuple[dict, list[str]]:
        return create_journal_entry_in_transaction(
            transaction,
            db,
            org_id,
            date=date,
            lines=lines,
            description=description,
            reference=reference,
            source_type=source_type,
            source_id=source_id,
            currency_code=currency_code,
            exchange_rate=exchange_rate,
            created_by=created_by,
            company_id=company_id,
            entry_id=entry_id,
            entry_number=entry_number,
            status=status,
            extra_header=extra_header,
            emit_event=emit_event,
        )

    journal, touched_accounts = _create(db.transaction())
    cache.delete(f"journal_entries:{journal['id']}")
    for account_id in touched_accounts:
        cache.delete(f"accounts:{account_id}")
    return journal
