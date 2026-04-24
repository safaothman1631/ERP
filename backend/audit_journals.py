"""
Journal Audit Script — P0 Accounting Integrity Check

Read-only audit (هیچ write نییە):
1. Balance validation: Σdebit == Σcredit
2. Sequence gap detection
3. Header total mismatch (header total_debit/credit vs sum of lines)
"""
import sys
import os
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))

from app.firebase_client import get_db, init_firebase
from app.firestore.journals import JournalEntryRepository

init_firebase()


def detect_sequence_gaps(numbers):
    """Find missing numbers in sequence (e.g., JE-001, JE-003 → gap at JE-002)."""
    if not numbers:
        return []
    gaps = []
    parsed = []
    for n in numbers:
        try:
            prefix, num = n.rsplit("-", 1)
            parsed.append((prefix, int(num), len(num), n))
        except (ValueError, AttributeError):
            continue
    parsed.sort(key=lambda x: (x[0], x[1]))
    for i in range(len(parsed) - 1):
        p1, n1, pad, raw1 = parsed[i]
        p2, n2, _, raw2 = parsed[i + 1]
        if p1 == p2 and n2 > n1 + 1:
            missing = [f"{p1}-{str(k).zfill(pad)}" for k in range(n1 + 1, n2)]
            gaps.append({"prev": raw1, "next": raw2, "missing": missing})
    return gaps


def audit():
    db = get_db()
    print("=" * 70)
    print("JOURNAL AUDIT REPORT - P0 Accounting Integrity Check")
    print("=" * 70)

    orgs = [{"id": d.id, **d.to_dict()} for d in db.collection("organizations").stream()]
    print(f"\nOrganizations found: {len(orgs)}\n")

    grand = {"entries": 0, "balanced": 0, "unbalanced": 0,
             "header_mismatch": 0, "duplicates": 0}
    unbalanced_list = []
    header_mismatch_list = []
    gaps_by_org = {}
    duplicate_numbers = defaultdict(list)

    for org in orgs:
        org_id = org["id"]
        org_name = org.get("name", "(unnamed)")
        print(f"[ORG] {org_name} ({org_id})")
        print("-" * 70)

        je_repo = JournalEntryRepository(org_id)
        entries, total = je_repo.list(limit=10000)
        print(f"  Entries: {len(entries)} (total reported: {total})")

        if not entries:
            print("  (none)\n")
            continue

        seen_numbers = {}
        for e in entries:
            grand["entries"] += 1
            eid = e["id"]
            num = e.get("entry_number", "(no-number)")

            # Duplicate check
            if num in seen_numbers:
                grand["duplicates"] += 1
                duplicate_numbers[(org_id, num)].extend([seen_numbers[num], eid])
            else:
                seen_numbers[num] = eid

            lines = je_repo.get_lines(eid)
            line_debit = sum(float(ln.get("debit", 0) or 0) for ln in lines)
            line_credit = sum(float(ln.get("credit", 0) or 0) for ln in lines)

            # Balance check
            if abs(line_debit - line_credit) <= 0.01:
                grand["balanced"] += 1
            else:
                grand["unbalanced"] += 1
                unbalanced_list.append({
                    "org": org_name, "entry_number": num, "id": eid,
                    "debit": line_debit, "credit": line_credit,
                    "diff": line_debit - line_credit,
                })

            # Header vs lines mismatch
            hdr_debit = float(e.get("total_debit", 0) or 0)
            hdr_credit = float(e.get("total_credit", 0) or 0)
            if abs(hdr_debit - line_debit) > 0.01 or abs(hdr_credit - line_credit) > 0.01:
                grand["header_mismatch"] += 1
                header_mismatch_list.append({
                    "org": org_name, "entry_number": num, "id": eid,
                    "header_debit": hdr_debit, "line_debit": line_debit,
                    "header_credit": hdr_credit, "line_credit": line_credit,
                })

        # Sequence gaps
        nums = [e.get("entry_number") for e in entries if e.get("entry_number")]
        gaps = detect_sequence_gaps(nums)
        if gaps:
            gaps_by_org[org_name] = gaps
            print(f"  Sequence gaps: {len(gaps)}")
        else:
            print("  Sequence: OK")
        print()

    # Summary
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    pct = lambda n: (100.0 * n / grand["entries"]) if grand["entries"] else 0
    print(f"  Total entries:      {grand['entries']}")
    print(f"  Balanced:           {grand['balanced']:6d} ({pct(grand['balanced']):.1f}%)")
    print(f"  Unbalanced:         {grand['unbalanced']:6d} ({pct(grand['unbalanced']):.1f}%)")
    print(f"  Header mismatch:    {grand['header_mismatch']:6d}")
    print(f"  Duplicate numbers:  {grand['duplicates']:6d}")
    print(f"  Orgs with gaps:     {len(gaps_by_org):6d}")
    print()

    if unbalanced_list:
        print("UNBALANCED ENTRIES")
        print("-" * 70)
        for u in unbalanced_list[:20]:
            print(f"  [{u['org']}] {u['entry_number']} ({u['id'][:8]})  "
                  f"D={u['debit']:.2f} C={u['credit']:.2f} diff={u['diff']:.2f}")
        if len(unbalanced_list) > 20:
            print(f"  ... and {len(unbalanced_list) - 20} more")
        print()

    if header_mismatch_list:
        print("HEADER vs LINES MISMATCH")
        print("-" * 70)
        for m in header_mismatch_list[:20]:
            print(f"  [{m['org']}] {m['entry_number']} ({m['id'][:8]})  "
                  f"hdr_D={m['header_debit']:.2f} line_D={m['line_debit']:.2f}  "
                  f"hdr_C={m['header_credit']:.2f} line_C={m['line_credit']:.2f}")
        if len(header_mismatch_list) > 20:
            print(f"  ... and {len(header_mismatch_list) - 20} more")
        print()

    if duplicate_numbers:
        print("DUPLICATE ENTRY NUMBERS")
        print("-" * 70)
        for (org_id, num), ids in duplicate_numbers.items():
            print(f"  org={org_id[:8]} number={num} ids={ids}")
        print()

    if gaps_by_org:
        print("SEQUENCE GAPS")
        print("-" * 70)
        for org_name, gaps in gaps_by_org.items():
            print(f"  [{org_name}]")
            for g in gaps[:10]:
                missing_str = ", ".join(g["missing"][:5])
                if len(g["missing"]) > 5:
                    missing_str += f" ... (+{len(g['missing']) - 5})"
                print(f"    {g['prev']} -> {g['next']}  missing: {missing_str}")
            if len(gaps) > 10:
                print(f"    ... and {len(gaps) - 10} more gaps")
        print()

    # Exit code
    has_issues = (grand["unbalanced"] > 0 or grand["header_mismatch"] > 0
                  or grand["duplicates"] > 0 or len(gaps_by_org) > 0)
    print("=" * 70)
    if has_issues:
        print("RESULT: ISSUES FOUND")
        return 1
    print("RESULT: ALL CLEAN")
    return 0


if __name__ == "__main__":
    sys.exit(audit())
