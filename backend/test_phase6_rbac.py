"""Smoke test for Phase 6 RBAC v2 - Field & Record Security."""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.firebase_client import init_firebase
from app.services.security_v2 import (
    evaluate_predicate, apply_field_rules, filter_visible_records,
    can_access_record, build_owner_scope_predicate, build_team_scope_predicate,
)

init_firebase()

results = []


def _assert(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((status, name, detail))
    print(f"  [{status}] {name}{(' - ' + detail) if detail else ''}")


# ===== Predicate tests =====

def t1_predicate_eq():
    print("\nT1 - predicate ==")
    user = {"id": "U1"}
    pred = {"field": "owner_id", "op": "==", "value": "$user.id"}
    _assert("matches own", evaluate_predicate(pred, {"owner_id": "U1"}, user))
    _assert("rejects other", not evaluate_predicate(pred, {"owner_id": "U2"}, user))


def t2_predicate_in():
    print("\nT2 - predicate in (team scope)")
    user = {"id": "U1", "team_ids": ["TA", "TB"]}
    pred = build_team_scope_predicate()
    _assert("in team A", evaluate_predicate(pred, {"team_id": "TA"}, user))
    _assert("not in team C", not evaluate_predicate(pred, {"team_id": "TC"}, user))


def t3_predicate_and_or():
    print("\nT3 - composite AND/OR")
    user = {"id": "U1"}
    pred = {"and": [
        {"field": "status", "op": "==", "value": "open"},
        {"or": [
            {"field": "owner_id", "op": "==", "value": "$user.id"},
            {"field": "shared", "op": "==", "value": True},
        ]},
    ]}
    _assert("open + own",
            evaluate_predicate(pred, {"status": "open", "owner_id": "U1"}, user))
    _assert("open + shared",
            evaluate_predicate(pred, {"status": "open", "shared": True, "owner_id": "X"}, user))
    _assert("closed rejected",
            not evaluate_predicate(pred, {"status": "closed", "owner_id": "U1"}, user))


def t4_predicate_starts_with():
    print("\nT4 - predicate starts_with")
    pred = {"field": "code", "op": "starts_with", "value": "INV-"}
    _assert("INV-001 ok", evaluate_predicate(pred, {"code": "INV-001"}, {}))
    _assert("PO-001 no", not evaluate_predicate(pred, {"code": "PO-001"}, {}))


# ===== Field redaction tests =====

def t5_field_redact_phone():
    print("\nT5 - viewer cannot see phone")
    contacts = [{"id": "C1", "name": "Alice", "phone": "0750-...", "balance": 500}]
    rules = [{"role": "viewer", "resource": "contacts",
              "fields_redact": ["phone"], "fields_readonly": ["balance"]}]
    out = apply_field_rules(contacts, rules, ["viewer"], "contacts")
    _assert("phone redacted", out[0]["phone"] is None)
    _assert("name preserved", out[0]["name"] == "Alice")
    _assert("readonly annotated",
            out[0].get("__readonly_fields") == ["balance"])


def t6_admin_bypasses_redaction():
    print("\nT6 - admin bypasses redaction")
    contacts = [{"id": "C1", "name": "Alice", "phone": "0750-..."}]
    rules = [{"role": "viewer", "resource": "contacts", "fields_redact": ["phone"]}]
    out = apply_field_rules(contacts, rules, ["admin"], "contacts")
    _assert("phone preserved for admin", out[0]["phone"] == "0750-...")


def t7_rule_skipped_for_other_resource():
    print("\nT7 - rule for invoices does not affect contacts")
    contacts = [{"id": "C1", "phone": "0750"}]
    rules = [{"role": "viewer", "resource": "invoices", "fields_redact": ["phone"]}]
    out = apply_field_rules(contacts, rules, ["viewer"], "contacts")
    _assert("phone preserved", out[0]["phone"] == "0750")


# ===== Record-level filter tests =====

def t8_filter_owner_scope():
    print("\nT8 - sales sees only own contacts")
    user = {"id": "U1", "role": "sales"}
    rules = [{"role": "sales", "resource": "contacts",
              "predicate": build_owner_scope_predicate()}]
    contacts = [
        {"id": "C1", "owner_id": "U1"},
        {"id": "C2", "owner_id": "U2"},
        {"id": "C3", "owner_id": "U1"},
    ]
    out = filter_visible_records(contacts, rules, user, "contacts")
    ids = sorted(c["id"] for c in out)
    _assert("only own returned", ids == ["C1", "C3"], str(ids))


def t9_admin_sees_all():
    print("\nT9 - admin bypass record rules")
    user = {"id": "ADMIN", "role": "admin"}
    rules = [{"role": "sales", "resource": "contacts",
              "predicate": build_owner_scope_predicate()}]
    contacts = [{"id": "C1", "owner_id": "X"}, {"id": "C2", "owner_id": "Y"}]
    out = filter_visible_records(contacts, rules, user, "contacts")
    _assert("all visible", len(out) == 2)


def t10_no_rules_default_allow():
    print("\nT10 - no rules => all visible")
    user = {"id": "U1", "role": "sales"}
    out = filter_visible_records(
        [{"id": "C1"}, {"id": "C2"}], [], user, "contacts",
    )
    _assert("default allow", len(out) == 2)


def t11_rules_for_other_role_ignored():
    print("\nT11 - rule for accountant does not constrain sales user")
    user = {"id": "U1", "role": "sales"}
    rules = [{"role": "accountant", "resource": "contacts",
              "predicate": build_owner_scope_predicate()}]
    out = filter_visible_records(
        [{"id": "C1", "owner_id": "X"}], rules, user, "contacts",
    )
    _assert("not filtered (rule not applicable)", len(out) == 1)


def t12_can_access_record_single():
    print("\nT12 - can_access_record gate")
    user = {"id": "U1", "role": "sales"}
    rules = [{"role": "sales", "resource": "contacts",
              "predicate": build_owner_scope_predicate()}]
    own = {"id": "C1", "owner_id": "U1"}
    other = {"id": "C2", "owner_id": "U2"}
    _assert("can access own",
            can_access_record(own, rules, user, "contacts"))
    _assert("cannot access other",
            not can_access_record(other, rules, user, "contacts"))


def t13_team_scope_with_extra_roles():
    print("\nT13 - extra roles list contributes to applicable rules")
    user = {"id": "U1", "role": "viewer", "roles": ["project_manager"],
            "team_ids": ["T1"]}
    rules = [{"role": "project_manager", "resource": "projects",
              "predicate": build_team_scope_predicate()}]
    projects = [
        {"id": "P1", "team_id": "T1"},
        {"id": "P2", "team_id": "T2"},
    ]
    out = filter_visible_records(projects, rules, user, "projects")
    _assert("only T1 visible", [p["id"] for p in out] == ["P1"])


def t14_default_deny_when_no_rule_matches():
    """If rules exist for the user's role+resource but predicate doesn't
    match any record, return empty (default-deny within applied rules)."""
    print("\nT14 - applicable rules + no match => empty")
    user = {"id": "U1", "role": "sales"}
    rules = [{"role": "sales", "resource": "contacts",
              "predicate": build_owner_scope_predicate()}]
    out = filter_visible_records(
        [{"id": "C1", "owner_id": "OTHER"}], rules, user, "contacts",
    )
    _assert("0 results", len(out) == 0)


def main():
    print("=" * 70)
    print("PHASE 6 SMOKE TEST - RBAC v2 (Field + Record Security)")
    print("=" * 70)
    t1_predicate_eq()
    t2_predicate_in()
    t3_predicate_and_or()
    t4_predicate_starts_with()
    t5_field_redact_phone()
    t6_admin_bypasses_redaction()
    t7_rule_skipped_for_other_resource()
    t8_filter_owner_scope()
    t9_admin_sees_all()
    t10_no_rules_default_allow()
    t11_rules_for_other_role_ignored()
    t12_can_access_record_single()
    t13_team_scope_with_extra_roles()
    t14_default_deny_when_no_rule_matches()

    print("\n" + "=" * 70)
    p = sum(1 for r in results if r[0] == "PASS")
    f = sum(1 for r in results if r[0] == "FAIL")
    print(f"RESULT: {p} PASS, {f} FAIL")
    print("=" * 70)
    if f:
        for s, n, d in results:
            if s == "FAIL":
                print(f"  FAIL: {n} - {d}")
    return 0 if f == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
