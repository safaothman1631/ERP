# Tasks: Data Integrity Wave

**Spec:** [requirements.md](./requirements.md) · [design.md](./design.md)

---

## Wave A — Prevent (P0)

- [x] A1 `BaseRepository.get()` org_id guard + quota list warning
- [x] A2 `services/bank_transactions.py` atomic create
- [x] A3 `services/invoice_payments.py` atomic payment apply
- [x] A4 `services/pos_checkout.py` atomic pay + inventory
- [x] A5 Wire APIs: banking, invoices payments, pos pay

---

## Wave B — Detect (P0)

- [x] B1 `services/reconciliation.py` drift helpers
- [x] B2 `scripts/reconcile_org.py` CLI (--org-id, --fix, --json)
- [x] B3 `tests/test_repository_org_guard.py`
- [x] B4 `tests/test_reconcile_org.py`

---

## Wave C — Ops & docs (P1)

- [x] C1 `OPERATIONS_RUNBOOK.md` — PITR + reconcile schedule
- [x] C2 `LAUNCH_DECISION.md` — integrity wave gate
- [x] C3 `MASTER_AUDIT_REPORTS/data-integrity-wave-2026-05.md`

---

## Wave D — Verify (P0)

- [x] D1 `tests/test_atomic_money_paths.py`
- [x] D2 Full pytest suite green (688 passed)
- [x] D3 Run reconcile on demo org (`064a4a1a-487b-4835-a42a-4806ba8add72`) — 1 stock drift fixed, exit 0

---

## Execution order

1. A1 → A2 → A3 → A4 → A5 ✅
2. B1 → B2 → B3 → B4 ✅
3. C1 → C2 → C3 ✅
4. D1 → D2 → D3 (run locally)
