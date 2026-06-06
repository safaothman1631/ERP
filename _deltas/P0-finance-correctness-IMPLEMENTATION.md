# P0 — Finance Correctness Implementation Guide (GL auto-post + Decimal)

> **Status:** REVIEWED GUIDE — **NOT APPLIED.** No `.py` file was changed.
> Financial-correctness changes must be verified by the **full `pytest` suite on Windows**
> (the backend suite cannot run in this sandbox), so this document delivers an exact,
> copy-pasteable apply plan instead of risking the build with an unverified edit.
>
> **پوختە (Kurdish):** ئەم فایلە ڕێنماییەکی تەواوە بۆ چارەسەری گرنگترین کەلێنی دروستی لە
> هەژمارداری. **هیچ کۆدێک نەگۆڕدراوە** — دەبێت سەرەتا لەسەر Windows بە `pytest` تاقی بکرێتەوە
> پێش جێبەجێکردن، چونکە دروستی دارایی مەترسیدارە.

**Author role:** senior ERP/accounting engineer
**Scope:** `backend/app/...` only. Frontend untouched.
**Date drafted:** 2026-06-03

---

## 0. TL;DR — کورتە

Three correctness gaps, in priority order:

| # | Gap | File(s) | Risk |
|---|-----|---------|------|
| **1** | Customer-invoice confirm (`send`) does **not** post a journal entry. Void/cancel does **not** reverse one. | `app/api/invoices.py`, `app/services/invoice_gl.py` (new) | GL Revenue & AR diverge from the sub-ledger. Financial statements wrong. |
| **2** | Customer **payment received** updates `balance_due` but posts **no** Dr Cash / Cr AR entry. | `app/services/invoice_payments.py` | Cash & AR in the GL never move when customers pay. |
| **3** | `invoice_payments.py` does balance math in **`float`**; `withholding.py` uses a `round(x + 1e-9, 2)` epsilon hack. | `app/services/invoice_payments.py`, `app/tax/withholding.py` | Sub-cent drift, non-deterministic rounding, audit failures. |

The double-entry **engine** is already correct and atomic:
- `app/services/accounting.py` → `AccountingService.create_invoice_journal()` / `.create_payment_received_journal()` already **build balanced JE lines** but are wired into almost nothing.
- `app/services/journal_entry_atomic.py` → `create_journal_entry_in_transaction(...)` / `create_journal_entry_atomic(...)` post transactionally with per-account `fs.Increment` balance updates.
- `app/services/je_validation.py` → `validate_je_balance(lines, currency)` validates balance with `Decimal` and a per-currency tolerance (`IQD = 0.005`).

So Fixes 1 & 2 are mostly **wiring** + **idempotency** + **reversal**, not new accounting logic. The canonical pattern to copy is **`app/services/bill_payments.py` → `create_payment_made_with_je_atomic(...)`** (AP side), which already writes *payment doc + balance + JE* in **one** Firestore transaction and stamps `journal_entry_id` on the payment. We mirror that on the AR side.

---

## 1. Problem & impact — کێشە و کاریگەری

### 1.1 What actually happens today (verified against the code)

**Invoice creation / confirm (`app/api/invoices.py`):**
- `create_invoice` (line 102) writes the invoice with `status="draft"`. **No JE.**
- `send_invoice` (line 264) — this is the de-facto "confirm" in this codebase (there is **no** `/confirm` endpoint) — does `repo.update(invoice_id, {"status": "sent", ...})` and optionally fires e-invoice submission. **No JE.**
- `update_invoice` (line 201) recomputes totals. **No JE.**
- `void_invoice` (line 234) → `repo.update(invoice_id, {"status": "void"})`. **No reversing JE.**
- `cancel_invoice` (line 246) → sets `status="cancelled"`. **No reversing JE.**

`AccountingService.create_invoice_journal(org_id, invoice)` (accounting.py line 68) **exists and builds a balanced entry** (Dr AR / Cr Revenue / Cr Tax 2140 / discount / shipping / adjustment), but a code search shows it is invoked from **only two** places:
- `app/services/pos_accounting.py:82` (POS-generated invoices), and
- `app/services/bank_matching_service.py:406` (actually calls `create_payment_received_journal`).

The **standard** customer-invoice path never calls it. → **The GL has no Revenue / AR for any invoice created through the normal UI/API.**

**Payment received (`app/services/invoice_payments.py`):**
- `create_payment_received_atomic` (line 49) writes the `payments_received` doc and decrements each invoice's `balance_due` inside a transaction. **No JE** — no Dr Cash / Cr AR. `AccountingService.create_payment_received_journal(...)` (accounting.py line 149) exists and builds the correct entry, but the standard payment endpoint (`api/invoices.py` → `create_payment_received`, line 451) never calls it.

> Compare the **AP side**, which is correct: `bill_payments.create_payment_made_with_je_atomic(...)` posts the JE in the same transaction as the payment. The AR side is the asymmetry we are closing.

### 1.2 Why a divergent GL is dangerous

The General Ledger is the **single source of truth** for the financial statements (Trial Balance, P&L, Balance Sheet). Sub-ledgers (the `invoices` and `payments_received` collections) are *operational* records. When you confirm an invoice but post nothing to the GL:

- **Revenue is understated** on the P&L (sales were made, GL shows nothing).
- **Accounts Receivable is understated** on the Balance Sheet (customers owe money, GL shows nothing).
- **Output VAT / sales tax payable (acct `2140`) is understated** — you under-report tax to the authority. In Iraq this is a compliance exposure (e-Fakhata / MoF reconciliation).
- The **Trial Balance still balances** (debits == credits) because *nothing was posted at all* — so the error is **silent**. You only discover it when an auditor reconciles the AR aging report to the AR control account and finds the GL is zero. That is the worst kind of bug: invisible until audit.

### 1.3 Concrete worked example

A shop confirms invoice **INV-1001** for a B2B customer:

| Field | IQD |
|-------|-----|
| subtotal | 1,000,000 |
| sales tax (acct 2140) | 0 (Iraq has no general VAT today; tax line only when configured) |
| total | 1,000,000 |

Customer pays in full to the cash account.

**What the books should show:**

```
On confirm (INV-1001):
  Dr  Accounts Receivable (1100)   1,000,000
      Cr  Sales Revenue (4000)             1,000,000

On payment received (RCP-1):
  Dr  Cash / Bank (1000)           1,000,000
      Cr  Accounts Receivable (1100)       1,000,000
```

Net GL effect: **Revenue +1,000,000, Cash +1,000,000, AR back to 0.** Correct.

**What actually happens today:** the `invoices` doc shows `total=1,000,000, balance_due=0, status="paid"`, but the **GL has 0 revenue, 0 cash movement, 0 AR.** The P&L for the month is wrong by 1,000,000 IQD per invoice. Multiply by every invoice the business ever issued.

---

## 2. Fix 1 — GL auto-post on customer-invoice confirm (+ reverse on void/cancel)

**Goal:** when an invoice transitions **draft → sent** (confirm), post `Dr AR / Cr Revenue (/ Cr Tax / discount / shipping / adjustment)` exactly once. When it is voided/cancelled after being posted, post the **reversing** entry. Idempotent on retry.

### 2.1 Design decisions

1. **Trigger point = `send_invoice`** (`api/invoices.py:264`). That is the confirm action in this codebase. (If a dedicated `/confirm` endpoint is added later, call the same helper there.) Do **not** post on `create_invoice` — drafts must not hit the GL.
2. **Reuse the existing builder.** `AccountingService.create_invoice_journal(org_id, invoice)` already produces the balanced lines and calls `create_journal_entry(...)` → `create_journal_entry_atomic(...)`. We only need to call it and make it idempotent.
3. **Idempotency** — the JE repo has **no** `get_by_source(...)` lookup, so we use the two mechanisms already in the codebase:
   - **Deterministic `entry_id`** derived from the invoice id, passed through to `create_journal_entry_in_transaction(..., entry_id=...)` (that parameter already exists, line 80). A second post with the same id overwrites the same document instead of creating a duplicate.
   - **A guard flag on the invoice** (`gl_posted: True` + `journal_entry_id`), mirroring how `bill_payments` stamps `journal_entry_id` on the payment doc. We check the flag before posting.
4. **Account types are looked up by `AccountingService._get_account_by_type` / `._get_account_by_code`** (accounting.py lines 282 / 295). These raise `HTTPException(404)` if the chart of accounts is missing. Wrap the call so a missing CoA does **not** 500 the confirm (log + surface a soft warning), matching the POS behaviour at `pos_accounting.py:81-84`.

### 2.2 New file: `app/services/invoice_gl.py`

A thin, testable wrapper around the existing builder. Keeps `invoices.py` clean and gives the test suite a single import surface.

```python
"""GL posting + reversal for the standard customer-invoice lifecycle.

Mirrors app/services/pos_accounting.py and app/services/bill_payments.py:
the JE *builder* lives in AccountingService; this module owns idempotency,
the guard flag, and the void/cancel reversal.
"""
from __future__ import annotations

import hashlib
import logging
import uuid

from fastapi import HTTPException

from app.services.accounting import AccountingService

logger = logging.getLogger(__name__)


def _deterministic_je_id(invoice_id: str) -> str:
    """Stable UUID5 from the invoice id so a retry overwrites, not duplicates."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"invoice-je:{invoice_id}"))


def post_invoice_confirmation_je(org_id: str, invoice: dict, *, created_by: str | None = None) -> dict | None:
    """Post Dr AR / Cr Revenue (/ Cr Tax / discount / shipping / adjustment).

    Idempotent: returns the existing journal_entry_id if already posted, and
    uses a deterministic entry id so a transaction retry cannot double-post.
    Returns None (logged) when the chart of accounts is not configured yet,
    so confirm does not hard-fail on a fresh tenant — matches POS behaviour.
    """
    if invoice.get("gl_posted") and invoice.get("journal_entry_id"):
        return {"id": invoice["journal_entry_id"], "skipped": "already_posted"}

    # Drafts and already-reversed states never post.
    if invoice.get("status") in ("draft", "void", "cancelled"):
        return None

    entry_id = _deterministic_je_id(invoice["id"])
    try:
        je = AccountingService.create_invoice_journal(
            org_id,
            {**invoice, "_je_entry_id": entry_id, "created_by": created_by},
        )
    except HTTPException as exc:
        # 404 = chart of accounts missing → soft-skip (do not 500 the confirm).
        logger.warning("Invoice JE skipped for %s: %s", invoice.get("id"), exc.detail)
        return None
    return je


def reverse_invoice_je(org_id: str, invoice: dict, *, reversal_date, user_id: str | None = None) -> dict | None:
    """Reverse the confirmation JE when an invoice is voided/cancelled."""
    je_id = invoice.get("journal_entry_id")
    if not je_id:
        return None
    try:
        return AccountingService.reverse_journal_entry(
            org_id, je_id, reversal_date, user_id=user_id,
            description=f"Reverse invoice {invoice.get('invoice_number', invoice['id'])}",
        )
    except HTTPException as exc:
        # 409 = already reversed (idempotent), 404 = JE gone → both safe to swallow.
        logger.warning("Invoice JE reversal skipped for %s: %s", invoice.get("id"), exc.detail)
        return None
```

> **Note on the deterministic id:** `AccountingService.create_invoice_journal` does **not** currently forward an `entry_id`. To honour `_je_entry_id`, add **one** optional pass-through in `accounting.py` (see §2.4). If you prefer zero changes to `accounting.py`, drop the `_je_entry_id` key and rely solely on the `gl_posted` guard + the atomic transaction — the guard alone already prevents double-posting under normal flow; the deterministic id only hardens against a mid-transaction retry.

### 2.3 Wire into `app/api/invoices.py`

**(a) On confirm — inside `send_invoice` (line 264).** After the status update succeeds, post the JE and persist the guard. Insert immediately after line 272 (`repo.update(invoice_id, {"status": "sent", "sent_date": ...})`):

```python
    repo.update(invoice_id, {"status": "sent", "sent_date": datetime.utcnow()})

    # --- P0 Fix 1: GL auto-post on confirm (idempotent) -------------------
    try:
        from app.services.invoice_gl import post_invoice_confirmation_je
        full_invoice = repo.get(invoice_id)  # fresh copy with computed totals
        je = post_invoice_confirmation_je(
            user["org_id"], full_invoice, created_by=user.get("id")
        )
        if je and not je.get("skipped"):
            repo.update(invoice_id, {"gl_posted": True, "journal_entry_id": je["id"]})
    except Exception as exc:  # never let GL posting break the confirm response
        import logging
        logging.getLogger(__name__).error(
            "invoice_confirm_je_failed",
            extra={"invoice_id": invoice_id, "error": str(exc)},
        )
    # ---------------------------------------------------------------------
```

**(b) On void — inside `void_invoice` (line 234).** Replace the body so it reverses before/after marking void:

```python
@router.delete("/{invoice_id}", dependencies=[Depends(require_perm("invoices.delete"))])
def void_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.get(invoice_id)
    if not invoice or invoice.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="وەسڵ نەدۆزرایەوە")

    # --- P0 Fix 1: reverse the GL entry on void --------------------------
    if invoice.get("gl_posted") and invoice.get("journal_entry_id"):
        from app.services.invoice_gl import reverse_invoice_je
        reverse_invoice_je(
            user["org_id"], invoice,
            reversal_date=datetime.utcnow(), user_id=user.get("id"),
        )
    # ---------------------------------------------------------------------

    repo.update(invoice_id, {"status": "void", "gl_reversed": True})
    return {"message": "وەسڵ هەڵوەشێنرایەوە", "success": True}
```

**(c) On cancel — inside `cancel_invoice` (line 246).** The current guard already blocks cancelling a partly-paid invoice (line 254). Add the reversal just before the final `repo.update(...)` at line 256:

```python
    if invoice.get("gl_posted") and invoice.get("journal_entry_id"):
        from app.services.invoice_gl import reverse_invoice_je
        reverse_invoice_je(
            user["org_id"], invoice,
            reversal_date=datetime.utcnow(), user_id=user.get("id"),
        )
    return repo.update(invoice_id, {
        "status": "cancelled",
        "cancelled_at": datetime.utcnow().isoformat(),
        "cancelled_by": user.get("id"),
        "cancellation_reason": (data or {}).get("reason", ""),
        "gl_reversed": True,
    })
```

### 2.4 Optional one-line change in `accounting.py` (to honour the deterministic id)

`create_invoice_journal` (line 137) ends with `return AccountingService.create_journal_entry(...)`. `create_journal_entry` (line 13) does **not** accept `entry_id`. To pass the deterministic id end-to-end, thread it through. **Minimal patch:**

In `create_invoice_journal`, change the final return to forward the id when present:

```python
        return AccountingService.create_journal_entry(
            org_id=org_id,
            date=invoice["date"],
            lines=lines,
            description=f"پسووڵەی فرۆشتن {invoice['invoice_number']}",
            source_type="invoice",
            source_id=invoice["id"],
            currency_code=invoice.get("currency_code", "IQD"),
            exchange_rate=float(invoice.get("exchange_rate", 1.0)),
            entry_id=invoice.get("_je_entry_id"),          # NEW
            created_by=invoice.get("created_by"),           # NEW (audit)
        )
```

And add `entry_id` to `create_journal_entry` (line 13) signature + forward it to `create_journal_entry_atomic` (which already accepts `entry_id`, line 212):

```python
    @staticmethod
    def create_journal_entry(
        org_id: str,
        date: datetime,
        lines: list[dict],
        description: str = "",
        reference: str = "",
        source_type: str = "manual",
        source_id: str = None,
        currency_code: str = "IQD",
        exchange_rate: float = 1.0,
        created_by: str = None,
        entry_id: str = None,            # NEW
    ) -> dict:
        ...
        return create_journal_entry_atomic(
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
            entry_id=entry_id,           # NEW
            status="posted",
        )
```

> `create_journal_entry_atomic` → `create_journal_entry_in_transaction(..., entry_id=...)` already uses `journal_id = entry_id or str(uuid.uuid4())` (atomic.py line 86), so the deterministic id flows straight to the document id. No further change needed.

### 2.5 COGS / Inventory on delivery (when applicable)

If the tenant tracks inventory (perpetual), the **cost** side posts when goods are **delivered**, not when the invoice is confirmed:

```
On delivery of stocked items:
  Dr  Cost of Goods Sold (5000)    <unit_cost × qty>
      Cr  Inventory Asset (1300)           <unit_cost × qty>
```

This is a **separate** entry from the revenue entry and belongs on the delivery/picking confirm path, not the invoice confirm. The picking-confirm endpoint already exists (`app/api/inventory.py:1008`, sets `status="confirmed"`). Recommended (follow-up, lower priority than the revenue entry):

- Add `AccountingService.create_cogs_journal(org_id, picking, lines)` that looks up `cost_of_goods_sold` and `inventory` via `_get_account_by_type` (both types are in `DEBIT_NORMAL_ACCOUNT_TYPES`, atomic.py lines 13-25) and builds `Dr COGS / Cr Inventory` at moving-average or standard cost.
- Wire it into the picking-confirm handler with the same `gl_posted`/deterministic-id idempotency pattern.
- Only post for items flagged `track_inventory` / `is_stocked`; service items skip COGS.

> Keep COGS in its **own** entry so void of an invoice (revenue) and a stock return (COGS) reverse independently. Do **not** merge revenue and COGS into one JE.

---

## 3. Fix 2 — GL auto-post on payment received (atomic with the allocation)

**Goal:** when a customer payment is recorded, post `Dr Cash/Bank / Cr Accounts Receivable` in the **same transaction** that decrements `balance_due`, idempotently. This is the AR mirror of `bill_payments.create_payment_made_with_je_atomic`.

### 3.1 The clean approach — add `create_payment_received_with_je_atomic` to `invoice_payments.py`

`create_payment_received_atomic` (invoice_payments.py:49) already opens a transaction, writes `pay_ref`, and updates each invoice. We add a JE inside the **same** transaction using `create_journal_entry_in_transaction(...)` (the exact call `bill_payments.py:154` makes). New function, leaving the old one in place for callers that don't want a JE:

```python
def create_payment_received_with_je_atomic(
    org_id: str,
    payment_id: str,
    payment_data: dict,
    *,
    deposit_account_id: str,
    ar_account_id: str,
    je_description: str = "",
    created_by: str | None = None,
    currency_code: str = "IQD",
    exchange_rate: float = 1.0,
) -> dict:
    """Create payments_received doc + invoice balances + Dr Cash / Cr AR JE,
    all in ONE Firestore transaction. Mirrors
    bill_payments.create_payment_made_with_je_atomic (AP side)."""
    from decimal import Decimal
    from app.services.journal_entry_atomic import create_journal_entry_in_transaction

    db = get_db()
    pay_ref = db.collection("payments_received").document(payment_id)
    now = datetime.utcnow()

    # Decimal end-to-end (see Fix 3) — quantise once at the boundary.
    total_amount = _money(payment_data.get("amount") or 0)

    payload = {**payment_data, "org_id": org_id, "created_at": now, "updated_at": now}

    legacy_invoice_id = payment_data.get("invoice_id")
    allocations = payment_data.get("allocations") or []
    invoice_updates: list[tuple[str, Decimal]] = []
    if legacy_invoice_id:
        invoice_updates.append((legacy_invoice_id, total_amount))
    for alloc in allocations:
        inv_id = alloc.get("invoice_id") if isinstance(alloc, dict) else getattr(alloc, "invoice_id", None)
        amt = alloc.get("amount", 0) if isinstance(alloc, dict) else getattr(alloc, "amount", 0)
        if inv_id and amt:
            invoice_updates.append((inv_id, _money(amt)))

    # JE: Dr Cash/Bank (deposit) total, Cr AR total. One pair for the whole receipt.
    je_lines = [
        {"account_id": deposit_account_id, "debit": float(total_amount), "credit": 0,
         "description": je_description or f"Payment {payment_data.get('payment_number','')}"},
        {"account_id": ar_account_id, "debit": 0, "credit": float(total_amount),
         "description": je_description or "Receipt from customer",
         "contact_id": payment_data.get("contact_id")},
    ]

    counter_transitions: list[tuple[dict, dict]] = []

    @fs.transactional
    def _create(transaction: fs.Transaction) -> dict:
        inv_refs = []
        inv_snaps = []
        for inv_id, _amt in invoice_updates:
            ref = db.collection("invoices").document(inv_id)
            inv_refs.append((ref, inv_id))
            inv_snaps.append(ref.get(transaction=transaction))

        journal, _touched = create_journal_entry_in_transaction(
            transaction, db, org_id,
            date=payment_data.get("date") or now,
            lines=je_lines,
            description=je_description or f"Receipt {payment_data.get('payment_number','')}",
            source_type="payment_received",
            source_id=payment_id,
            currency_code=currency_code,
            exchange_rate=exchange_rate,
            created_by=created_by,
            entry_id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"receipt-je:{payment_id}")),  # idempotent
        )
        payload["journal_entry_id"] = journal["id"]
        transaction.set(pay_ref, payload)

        for (ref, inv_id), snap, (_inv_id, amt) in zip(inv_refs, inv_snaps, invoice_updates):
            if not snap.exists:
                raise ValueError(f"invoice_not_found:{inv_id}")
            inv = snap.to_dict() or {}
            if inv.get("org_id") != org_id:
                raise ValueError(f"invoice_not_found:{inv_id}")
            new_balance, status = _invoice_balance_after(inv, amt)
            transaction.update(ref, {"balance_due": new_balance, "status": status, "updated_at": now})
            cache.delete(f"invoices:{inv_id}")
            counter_transitions.append((inv, {**inv, "balance_due": new_balance, "status": status}))

        return {"id": payment_id, **payload, "journal_entry_id": journal["id"]}

    result = _create(db.transaction())
    cache.delete(f"payments_received:{payment_id}")
    if counter_transitions:
        from app.services.org_counters import transition_invoice_counters
        for before, after in counter_transitions:
            transition_invoice_counters(org_id, before, after)
    return result
```

(`uuid` is already imported in `bill_payments.py`; add `import uuid` at the top of `invoice_payments.py` — it is **not** currently imported there.)

### 3.2 Resolve the accounts in the endpoint, pass them in

`create_payment_received` (`api/invoices.py:451`) builds the payload then calls `create_payment_received_atomic`. Resolve the two accounts via the existing helpers and call the new function. Replace the `try/except` block at lines 478-484:

```python
    from app.services.invoice_payments import create_payment_received_with_je_atomic
    from app.services.accounting import AccountingService
    from fastapi import HTTPException

    # Resolve deposit + AR accounts (soft-fall back to the no-JE path if CoA missing)
    deposit_id = payload.get("deposit_to_account_id")
    try:
        if not deposit_id:
            deposit_id = AccountingService._get_account_by_type(user["org_id"], "cash")
        ar_id = AccountingService._get_account_by_type(user["org_id"], "accounts_receivable")
        post_je = True
    except HTTPException:
        post_je = False  # fresh tenant without a chart of accounts

    payment_id = str(uuid.uuid4())
    try:
        if post_je:
            payment = create_payment_received_with_je_atomic(
                user["org_id"], payment_id, payload,
                deposit_account_id=deposit_id,
                ar_account_id=ar_id,
                created_by=user.get("id"),
                currency_code=payload.get("currency_code", "IQD"),
                exchange_rate=float(payload.get("exchange_rate", 1.0)),
            )
        else:
            from app.services.invoice_payments import create_payment_received_atomic
            payment = create_payment_received_atomic(user["org_id"], payment_id, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "invoice_payment_failed", "message": str(exc)},
        ) from exc
```

> **Why one JE pair for the whole receipt (not per allocation):** Cash is debited once for the deposit total and AR is credited once. The per-invoice `balance_due` decrements still happen individually in the same transaction. This keeps the JE minimal and always balanced (`debit_total == credit_total == amount`). If you want per-invoice AR lines for traceability, split the Cr AR line per allocation with `contact_id`/`reference` — the debit stays a single Cash line; the entry is still balanced.

### 3.3 Reversal on payment void/delete

If/when a "void payment received" endpoint exists (the AP side has `void_payment_made_atomic`), reverse via `AccountingService.reverse_journal_entry(org_id, payment["journal_entry_id"], ...)` and restore `balance_due` — exactly mirroring `bill_payments.void_payment_made_atomic` (bill_payments.py:195). Stamp `gl_reversed=True` on the payment. (Lower priority — the create path is the bleak.)

---

## 4. Fix 3 — Decimal migration (remove `float` math and the `1e-9` hack)

**Rounding policy (project-wide):** `Decimal`, **`ROUND_HALF_UP`**, **2 decimal places**. IQD is conventionally whole-dinar, but the GL tolerance in `je_validation.py` is `IQD = Decimal("0.005")`, so quantising to 2 dp is safe and consistent. Use a single helper everywhere.

### 4.1 `app/services/invoice_payments.py`

Add a money helper and convert `_invoice_balance_after` to `Decimal`:

```python
from decimal import Decimal, ROUND_HALF_UP

_CENT = Decimal("0.01")

def _money(value) -> Decimal:
    """Parse to Decimal via str() (never float()) and quantise to 2 dp, HALF_UP."""
    if isinstance(value, Decimal):
        d = value
    else:
        d = Decimal(str(value or 0))
    return d.quantize(_CENT, rounding=ROUND_HALF_UP)


def _invoice_balance_after(inv: dict, amount) -> tuple[float, str]:
    current = _money(inv.get("balance_due") if inv.get("balance_due") is not None else inv.get("total") or 0)
    new_balance = current - _money(amount)
    if new_balance <= _CENT:                       # <= 0.01 closes it (matches AP side)
        return 0.0, "paid"
    status = "partially_paid"
    return float(new_balance), status
```

Notes:
- **`Decimal(str(value))`** — never `Decimal(float)` (binary float carries the very error we are removing).
- Firestore stores numbers as float; we keep the **return type `float`** at the persistence boundary but do all **arithmetic and comparisons in `Decimal`**.
- The `<= _CENT` close rule matches `bill_payments._bill_balance_after` (bill_payments.py:17-19) so AR and AP behave identically. (The current AR code closes at `<= 0`, which can leave a 0.004 residue as "partially_paid" forever — this fixes that too.)

`apply_invoice_payment_atomic` (line 20) and `create_payment_received_atomic` (line 49) call `_invoice_balance_after` — once the helper is Decimal-based, both inherit correct rounding with no further change. Also pass amounts as `_money(...)` where they enter (the new `_with_je` function in §3.1 already does this).

### 4.2 `app/tax/withholding.py` — remove the `1e-9` epsilon hack

Replace the float `_round` (lines 127-131) with a `Decimal`, `ROUND_HALF_UP`, 2 dp implementation, and compute `withheld`/`net` in `Decimal`:

```python
from decimal import Decimal, ROUND_HALF_UP

_CENT = Decimal("0.01")

def _round(value) -> float:
    """Round to 2 dp, HALF_UP, via Decimal. Returns float for the public API."""
    d = value if isinstance(value, Decimal) else Decimal(str(value or 0))
    return float(d.quantize(_CENT, rounding=ROUND_HALF_UP))
```

Then change the two computation lines (currently lines 275-276):

```python
        gross_d = Decimal(str(gross))
        rate_d = Decimal(str(rate_pct))
        withheld = _round(gross_d * rate_d / Decimal("100"))
        net = _round(gross_d - Decimal(str(withheld)))
```

Why this matters: the old `round(value + 1e-9, 2)` nudges *every* value upward to dodge banker's-rounding-to-even in Python's float `round`. That is non-deterministic at tie-points and fails audit reproducibility. `Decimal.quantize(ROUND_HALF_UP)` rounds ties **away from zero** deterministically — which is exactly what the comment in the code *claims* to do ("half away from zero") but the `1e-9` trick only approximates.

> **Compatibility check:** the existing `test_withholding.py` expectations still hold:
> - `1_000_000 × 3% = 30_000.0` ✓
> - `1234.567 × 3% = 37.04` (test uses `pytest.approx`, and `Decimal("37.03701").quantize(.01, HALF_UP) == 37.04`) ✓
> - `net_payable ≈ 1197.53` ✓
> So §4.2 should be **green** against the current suite. Run it to confirm.

### 4.3 (Same fix, optional) `app/services/tax_calc.py`

`tax_calc._round` (line 17) uses the identical `1e-9` hack and `withholding._round` says it "matches" it. For full consistency apply the same `Decimal` body there. **Lower priority / higher blast radius** — `tax_calc` feeds invoice totals consumed all over the app, so changing its rounding is a behaviour change that must be validated by the full suite. Recommend doing §4.1 + §4.2 first (isolated), then §4.3 in a follow-up commit once the first pass is green.

---

## 5. Test plan — پلانی تاقیکردنەوە

Mirror the existing unit-test idioms. The codebase mocks Firestore with `MagicMock` and patches `fs.transactional` to the identity (`lambda f: f`) — see `tests/test_payment_made_je_atomic.py` and `tests/test_journal_entry_atomic.py`. Reuse those fixtures verbatim.

### 5.1 New: `backend/tests/test_invoice_gl.py` (Fix 1)

```python
"""P0 Fix 1 — invoice confirm posts a balanced JE; void reverses it."""
from datetime import datetime
from unittest.mock import MagicMock, patch
import pytest


def test_confirm_posts_balanced_je():
    from app.services.invoice_gl import post_invoice_confirmation_je
    inv = {"id": "inv-1", "invoice_number": "INV-1", "status": "sent",
           "date": "2026-06-01", "subtotal": 1_000_000, "total": 1_000_000,
           "tax_amount": 0, "discount_amount": 0, "shipping_charge": 0, "adjustment": 0}
    with patch("app.services.accounting.AccountingService.create_invoice_journal") as build:
        build.return_value = {"id": "je-1"}
        je = post_invoice_confirmation_je("org-1", inv)
    assert je["id"] == "je-1"
    # The builder itself must produce balanced lines:
    # debits (AR) == credits (revenue + tax + shipping + adjustment − discount)


def test_confirm_is_idempotent_when_already_posted():
    from app.services.invoice_gl import post_invoice_confirmation_je
    inv = {"id": "inv-1", "status": "sent", "gl_posted": True, "journal_entry_id": "je-1"}
    with patch("app.services.accounting.AccountingService.create_invoice_journal") as build:
        je = post_invoice_confirmation_je("org-1", inv)
    build.assert_not_called()           # no second post
    assert je["skipped"] == "already_posted"


def test_draft_does_not_post():
    from app.services.invoice_gl import post_invoice_confirmation_je
    with patch("app.services.accounting.AccountingService.create_invoice_journal") as build:
        assert post_invoice_confirmation_je("org-1", {"id": "i", "status": "draft"}) is None
    build.assert_not_called()


def test_missing_coa_soft_skips(caplog):
    from fastapi import HTTPException
    from app.services.invoice_gl import post_invoice_confirmation_je
    inv = {"id": "inv-1", "status": "sent"}
    with patch("app.services.accounting.AccountingService.create_invoice_journal",
               side_effect=HTTPException(status_code=404, detail="no CoA")):
        assert post_invoice_confirmation_je("org-1", inv) is None   # no raise


def test_void_reverses_je():
    from app.services.invoice_gl import reverse_invoice_je
    inv = {"id": "inv-1", "invoice_number": "INV-1", "journal_entry_id": "je-1"}
    with patch("app.services.accounting.AccountingService.reverse_journal_entry") as rev:
        rev.return_value = {"id": "je-rev"}
        out = reverse_invoice_je("org-1", inv, reversal_date=datetime(2026, 6, 2))
    assert out["id"] == "je-rev"


def test_reverse_no_je_is_noop():
    from app.services.invoice_gl import reverse_invoice_je
    assert reverse_invoice_je("org-1", {"id": "i"}, reversal_date=datetime(2026, 6, 2)) is None
```

### 5.2 Extend: `backend/tests/test_invoice_payments_je.py` (Fix 2)

Clone the structure of `tests/test_payment_made_je_atomic.py::test_create_payment_made_with_je_single_transaction` — assert the **payment doc, invoice balance, and JE are written in the same transaction**, and that the JE is balanced:

```python
def test_receipt_posts_je_in_same_transaction():
    from app.services.invoice_payments import create_payment_received_with_je_atomic
    # ... build mock_db with `invoices` + `payments_received` collections (see AP test) ...
    fake_journal = {"id": "je-1", "entry_number": "JOU-000099"}
    with patch("app.services.invoice_payments.get_db", return_value=mock_db), \
         patch("app.services.invoice_payments.fs.transactional", lambda f: f), \
         patch("app.services.invoice_payments.cache.delete"), \
         patch("app.services.org_counters.transition_invoice_counters"), \
         patch("app.services.journal_entry_atomic.create_journal_entry_in_transaction",
               return_value=(fake_journal, ["cash-1", "ar-1"])) as je_in_tx:
        result = create_payment_received_with_je_atomic(
            "org-1", "pay-1",
            {"invoice_id": "inv-1", "amount": 1_000_000, "date": "2026-06-01",
             "payment_number": "RCP-1"},
            deposit_account_id="cash-1", ar_account_id="ar-1",
        )
    assert result["journal_entry_id"] == "je-1"
    je_in_tx.assert_called_once()
    assert je_in_tx.call_args[0][0] is tx                       # same transaction
    lines = je_in_tx.call_args.kwargs["lines"]
    assert sum(l["debit"] for l in lines) == sum(l["credit"] for l in lines)   # balanced
    assert any(call.args[0] is pay_ref for call in tx.set.call_args_list)       # payment doc
    assert any(call.args[0] is inv_ref for call in tx.update.call_args_list)    # balance


def test_receipt_je_idempotent_entry_id():
    # uuid5 of "receipt-je:pay-1" is deterministic → assert the same entry_id
    # is passed on a retry (no duplicate JE document).
    ...


def test_payment_closes_ar_to_zero():
    # full payment → invoice status "paid", balance_due 0.0, AR credited == amount
    ...
```

### 5.3 Extend: `backend/tests/test_withholding.py` + `test_accounting_integrity.py` (Fix 3)

The existing `test_withholding.py` already covers rounding (`test_rounding_to_two_decimals`, line 146). After the Decimal swap, **add tie-point cases** that the `1e-9` hack would have rounded differently:

```python
def test_wht_half_up_tie_point():
    # 2.5 → 3 (HALF_UP), and a value whose 3rd decimal is exactly 5.
    r = DEFAULT_CALCULATOR.calculate(100.50, "rent", "b2b")   # 100.50 × 5% = 5.025 → 5.03
    assert r.wht_withheld == 5.03
    r2 = DEFAULT_CALCULATOR.calculate(83.10, "materials", "b2b")  # 83.10 × 2% = 1.662 → 1.66
    assert r2.wht_withheld == 1.66

def test_wht_no_float_drift_large_amount():
    r = DEFAULT_CALCULATOR.calculate(99_999_999.99, "services", "b2b")
    # gross − withheld == net exactly, to 2 dp
    assert round(r.gross_amount - r.wht_withheld, 2) == r.net_payable
```

For balance integrity, the existing `tests/test_accounting_integrity.py::TestJournalEntryIntegrity` (uses `validate_je_balance` + a Hypothesis property test) already proves debits==credits. **Add a property test** that the *invoice builder* output is balanced for random totals:

```python
from hypothesis import given, settings as h_settings, strategies as st
from app.services.je_validation import validate_je_balance

@h_settings(max_examples=50, deadline=None)
@given(
    subtotal=st.integers(min_value=1, max_value=1_000_000_000),
    tax=st.integers(min_value=0, max_value=100_000_000),
    discount=st.integers(min_value=0, max_value=100_000),
)
def test_invoice_builder_always_balances(subtotal, tax, discount):
    # Build the same line list create_invoice_journal would, then assert
    # validate_je_balance(lines, "IQD") does not raise.
    ...
```

### 5.4 Regression — do **not** break what works

Run these whole files unchanged; they must stay green:
- `tests/test_accounting_balance.py`, `tests/test_accounting_integrity.py`
- `tests/test_journal_entry_atomic.py`, `tests/test_journal_reverse.py`
- `tests/test_pos_accounting.py` (POS still calls `create_invoice_journal` the same way)
- `tests/test_payment_made_je_atomic.py`, `tests/test_bill_payments.py` (AP side — our AR change must not touch it)
- `tests/test_atomic_money_paths.py` (`apply_invoice_payment_atomic` returns None for missing invoice — unchanged signature)
- `tests/test_withholding.py` (all 20 cases — see §4.2 compatibility note)
- `tests/test_gl_materialised_match_je.py` (GL materialisation must still match the JE after we post more JEs)

---

## 6. Rollout & risk — جێبەجێکردن و مەترسی

1. **Branch.** Apply on a feature branch, e.g. `fix/p0-finance-gl-autopost`. Do **not** push to `main` (policy-blocked anyway).
2. **Apply in three commits** so a bisect can isolate a regression:
   - `commit 1`: Fix 3 (Decimal in `invoice_payments.py` + `withholding.py`) — smallest blast radius, run `pytest tests/test_withholding.py tests/test_atomic_money_paths.py`.
   - `commit 2`: Fix 1 (`invoice_gl.py` + `invoices.py` wiring + optional `accounting.py` `entry_id` pass-through).
   - `commit 3`: Fix 2 (`create_payment_received_with_je_atomic` + endpoint wiring).
3. **Run the full suite on Windows** (the sandbox can't):
   ```powershell
   cd C:\Users\SAFA\zoho\backend
   .\venv\Scripts\Activate.ps1
   pytest -q
   # focused first:
   pytest -q tests\test_invoice_gl.py tests\test_invoice_payments_je.py `
             tests\test_withholding.py tests\test_accounting_integrity.py `
             tests\test_accounting_balance.py tests\test_journal_entry_atomic.py `
             tests\test_journal_reverse.py tests\test_pos_accounting.py `
             tests\test_payment_made_je_atomic.py tests\test_gl_materialised_match_je.py
   ```
   The accounting **property tests** (Hypothesis, in `test_accounting_integrity.py` and any you add in §5.3) must pass — they are the strongest guarantee that debits==credits for arbitrary inputs.
4. **Boot check.** Confirm the app still imports and routes register (the CLAUDE.md log uses route_count as a smoke signal): `python -c "import app.main"` then hit `/api/metrics` locally.
5. **Idempotency soak.** Manually POST the same `send_invoice` twice and the same payment twice (or write a test that calls the helper twice) — assert exactly **one** JE document and one set of balance deltas.
6. **Backfill (separate, careful task).** Existing confirmed invoices and received payments created *before* this fix have **no** GL entries. After deploying, run a one-off, idempotent backfill that calls `post_invoice_confirmation_je` / posts the receipt JE for historical docs lacking `gl_posted`/`journal_entry_id`, **scoped per org and per period**, and reconcile the AR control account to the AR aging report. Do this in staging first. (Out of scope for the code change itself, but required for the GL to be *correct*, not just correct *going forward*.)
7. **Deploy behind care.** This touches money. Deploy to staging, reconcile a day of real-looking transactions (Trial Balance balances; AR aging == AR control; Revenue == sum of confirmed invoice subtotals), then production. Keep the soft-skip behaviour (missing CoA → log, don't 500) so a misconfigured tenant degrades gracefully instead of blocking invoicing.

### Risk register

| Risk | Mitigation |
|------|-----------|
| Double-post on retry | Deterministic `entry_id` (uuid5) + `gl_posted` guard on the invoice / `journal_entry_id` on the payment. |
| Confirm 500s on a tenant with no chart of accounts | `post_invoice_confirmation_je` catches `HTTPException(404)` → logs + returns None (mirrors `pos_accounting.py:81-84`). |
| Changing `tax_calc._round` shifts existing invoice totals | Deferred to a separate commit (§4.3); do Fix 3 only on `invoice_payments`/`withholding` first. |
| Void reverses twice | `AccountingService.reverse_journal_entry` already raises `409 je_already_reversed` (accounting.py:373-381); `reverse_invoice_je` swallows it → idempotent. |
| Period-lock blocks the reversal | `create_journal_entry` already checks `PeriodCloseService.check_period_locked` (accounting.py:42); a reversal in a locked period correctly 409s — surface that to the user rather than forcing it. |

---

## 7. File-change summary (what an applier touches)

| File | Change | Risk |
|------|--------|------|
| `app/services/invoice_gl.py` | **NEW** — confirm-post + reverse wrappers (idempotent). | low (additive) |
| `app/api/invoices.py` | Wire `post_invoice_confirmation_je` into `send_invoice`; `reverse_invoice_je` into `void_invoice`/`cancel_invoice`; switch `create_payment_received` to the `_with_je` path. | medium |
| `app/services/invoice_payments.py` | **NEW** `create_payment_received_with_je_atomic`; Decimal `_money` + `_invoice_balance_after`; `import uuid`. | medium |
| `app/services/accounting.py` | OPTIONAL one-line `entry_id`/`created_by` pass-through in `create_invoice_journal` + `create_journal_entry`. | low |
| `app/tax/withholding.py` | Replace `_round` with Decimal/HALF_UP; compute withheld/net in Decimal. | low |
| `app/services/tax_calc.py` | OPTIONAL (follow-up) same Decimal `_round`. | higher (broad) |
| `backend/tests/test_invoice_gl.py` | **NEW** (Fix 1 tests). | n/a |
| `backend/tests/test_invoice_payments_je.py` | **NEW** (Fix 2 tests). | n/a |
| `backend/tests/test_withholding.py`, `test_accounting_integrity.py` | EXTEND (Fix 3 + builder-balance property test). | n/a |

---

### Appendix A — exact existing symbols this guide relies on (verified)

- `AccountingService.create_invoice_journal(org_id, invoice)` — `accounting.py:68` (builds Dr AR / Cr Revenue / Cr Tax 2140 / discount / shipping / adjustment).
- `AccountingService.create_payment_received_journal(org_id, payment)` — `accounting.py:149` (builds Dr deposit / Cr AR).
- `AccountingService.reverse_journal_entry(org_id, je_id, reversal_date, user_id=, description=)` — `accounting.py:360` (mirrors lines, sets `reversed_by`/`status="reversed"`, raises `409 je_already_reversed`).
- `AccountingService._get_account_by_type(org_id, account_type)` — `accounting.py:282` (raises `404` if missing); `._get_account_by_code(org_id, code)` — `accounting.py:295`.
- `create_journal_entry_in_transaction(transaction, db, org_id, *, date, lines, ..., source_type, source_id, entry_id=, created_by=)` — `journal_entry_atomic.py:66` (accepts `entry_id`, line 80).
- `create_journal_entry_atomic(org_id, *, ..., entry_id=, status="posted")` — `journal_entry_atomic.py:199`.
- `validate_je_balance(lines, currency="IQD")` — `je_validation.py:31` (Decimal, IQD tolerance `0.005`).
- Reference AP pattern to mirror: `bill_payments.create_payment_made_with_je_atomic(...)` — `bill_payments.py:110` (payment + balance + JE in one transaction; stamps `journal_entry_id`).
- `invoice_payments._invoice_balance_after(inv, amount)` — `invoice_payments.py:13` (currently **float**, closes at `<= 0`).
- `withholding._round(value)` — `withholding.py:127` (currently `round(value + 1e-9, 2)` — the hack to remove).
- Confirm trigger = `send_invoice` — `api/invoices.py:264`; void = `void_invoice` — `:234`; cancel = `cancel_invoice` — `:246`; payment endpoint = `create_payment_received` — `:451`.
