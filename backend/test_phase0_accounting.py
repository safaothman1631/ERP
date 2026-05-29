"""
Smoke test for Phase 0 accounting hardening.

Verifies:
1. SequenceRepository.get_next() is atomic and never duplicates
2. AccountingService.create_journal_entry posts atomically with valid number
3. Header totals == sum of line debits/credits
4. Unbalanced journals are rejected
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from app.firebase_client import init_firebase, get_db
from app.firestore.system import SequenceRepository
from app.firestore.journals import JournalEntryRepository
from app.firestore.accounts import AccountRepository
from app.services.accounting import AccountingService
from app.services.report_streams import collect_stream
from fastapi import HTTPException

init_firebase()

ORG = "cb160278-d674-46ed-912a-822b0023f7ae"
results = []


def _assert(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((status, name, detail))
    print(f"  [{status}] {name}{(' - ' + detail) if detail else ''}")


def t1_sequence_atomic():
    """Sequence allocates monotonically increasing, no duplicates"""
    print("\nT1 - SequenceRepository.get_next() atomicity")
    seq = SequenceRepository(ORG)
    a = seq.get_next("phase0_test")
    b = seq.get_next("phase0_test")
    c = seq.get_next("phase0_test")
    _assert("3 distinct numbers", len({a, b, c}) == 3, f"{a} {b} {c}")
    # Numbers must be strictly increasing
    parse = lambda s: int(s.rsplit("-", 1)[1])
    _assert("monotonically increasing", parse(a) < parse(b) < parse(c), f"{a} {b} {c}")


def t2_balanced_journal_posts():
    """Balanced journal posts with proper number and matching totals"""
    print("\nT2 - balanced journal post")
    accs = collect_stream(AccountRepository(ORG), max_docs=10000)
    if len(accs) < 2:
        _assert("need 2+ accounts", False, f"only {len(accs)} accounts")
        return
    a1, a2 = accs[0]["id"], accs[1]["id"]

    journal = AccountingService.create_journal_entry(
        org_id=ORG,
        date=datetime.utcnow(),
        lines=[
            {"account_id": a1, "debit": 100.0, "credit": 0, "description": "phase0 t2"},
            {"account_id": a2, "debit": 0, "credit": 100.0, "description": "phase0 t2"},
        ],
        description="Phase 0 smoke test 2",
        source_type="manual",
    )
    _assert("entry_number present", bool(journal.get("entry_number")), str(journal.get("entry_number")))
    _assert("total_debit == 100", abs(float(journal.get("total_debit", 0)) - 100.0) < 0.01,
            str(journal.get("total_debit")))
    _assert("total_credit == 100", abs(float(journal.get("total_credit", 0)) - 100.0) < 0.01,
            str(journal.get("total_credit")))

    # Verify lines persisted (atomic batch worked)
    repo = JournalEntryRepository(ORG)
    fetched = repo.get_with_lines(journal["id"])
    _assert("header persisted", fetched is not None)
    _assert("2 lines persisted", fetched and len(fetched.get("lines", [])) == 2,
            f"got {len(fetched.get('lines', [])) if fetched else 0}")
    if fetched:
        ld = sum(float(l.get("debit", 0)) for l in fetched["lines"])
        lc = sum(float(l.get("credit", 0)) for l in fetched["lines"])
        _assert("line debit sum == header", abs(ld - 100.0) < 0.01, f"{ld}")
        _assert("line credit sum == header", abs(lc - 100.0) < 0.01, f"{lc}")

    # Cleanup
    repo.delete(journal["id"])


def t3_unbalanced_rejected():
    """Unbalanced journal raises HTTPException 400"""
    print("\nT3 - unbalanced journal rejected")
    accs = collect_stream(AccountRepository(ORG), max_docs=10000)
    if len(accs) < 2:
        _assert("need 2+ accounts", False)
        return
    try:
        AccountingService.create_journal_entry(
            org_id=ORG,
            date=datetime.utcnow(),
            lines=[
                {"account_id": accs[0]["id"], "debit": 100.0, "credit": 0},
                {"account_id": accs[1]["id"], "debit": 0, "credit": 50.0},
            ],
            description="Phase 0 smoke test 3 - should fail",
        )
        _assert("rejected unbalanced", False, "no exception raised")
    except HTTPException as e:
        _assert("rejected unbalanced", e.status_code == 400, f"status={e.status_code}")


def t4_single_line_rejected():
    """Less than 2 lines raises HTTPException 400"""
    print("\nT4 - <2 lines rejected")
    accs = collect_stream(AccountRepository(ORG), max_docs=10000)
    if not accs:
        _assert("need 1+ account", False)
        return
    try:
        AccountingService.create_journal_entry(
            org_id=ORG,
            date=datetime.utcnow(),
            lines=[{"account_id": accs[0]["id"], "debit": 100.0, "credit": 0}],
            description="Phase 0 smoke test 4 - should fail",
        )
        _assert("rejected <2 lines", False, "no exception raised")
    except HTTPException as e:
        _assert("rejected <2 lines", e.status_code == 400)


def main():
    print("=" * 70)
    print("PHASE 0 SMOKE TEST - Accounting Hardening")
    print("=" * 70)

    t1_sequence_atomic()
    t2_balanced_journal_posts()
    t3_unbalanced_rejected()
    t4_single_line_rejected()

    print("\n" + "=" * 70)
    passed = sum(1 for r in results if r[0] == "PASS")
    failed = sum(1 for r in results if r[0] == "FAIL")
    print(f"RESULT: {passed} PASS, {failed} FAIL (total {len(results)})")
    print("=" * 70)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
