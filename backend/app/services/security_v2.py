"""RBAC v2 - Field-level and Record-level security.

Adds two layers on top of the existing permission codes:

1. **Field-level security**: redact or read-only specific fields per role.
   - Example: `accountant` can read invoices but cannot see `internal_notes`.
   - Example: `viewer` cannot see customer phone numbers.

2. **Record-level rules** (ABAC style): predicates that filter which
   records a user is allowed to see/edit.
   - Example: salesperson sees only contacts where `owner_id == user.id`.
   - Example: project manager sees only projects where `team_id in user.teams`.

Configuration is data-driven, stored as Firestore docs in collections:
  - field_rules/{org_id}/{rule_id}: {role, resource, fields_redact, fields_readonly}
  - record_rules/{org_id}/{rule_id}: {role, resource, predicate}
A predicate is a dict like {"field": "owner_id", "op": "==", "value": "$user.id"}
where `$user.<x>` is resolved from the calling user's dict.

Phase 6 ships the in-process engine + test coverage. API CRUD for managing
the rules is left for the API layer (out of this skill's scope).
"""
from typing import Any, Optional


# ===== Predicate evaluation =====

def _resolve_value(token: Any, user: dict) -> Any:
    """If token is '$user.<key>', look it up in user dict; else return as-is."""
    if isinstance(token, str) and token.startswith("$user."):
        key = token[len("$user."):]
        return user.get(key)
    return token


def evaluate_predicate(predicate: dict, record: dict, user: dict) -> bool:
    """Evaluate a single predicate against a record + user context.

    Supported ops: ==, !=, in, not_in, contains, starts_with
    AND / OR composition via {"and": [pred, pred, ...]} or {"or": [...]}.
    """
    if "and" in predicate:
        return all(evaluate_predicate(p, record, user) for p in predicate["and"])
    if "or" in predicate:
        return any(evaluate_predicate(p, record, user) for p in predicate["or"])

    field = predicate.get("field")
    op = predicate.get("op", "==")
    expected = _resolve_value(predicate.get("value"), user)
    actual = record.get(field) if field else None

    if op == "==":
        return actual == expected
    if op == "!=":
        return actual != expected
    if op == "in":
        return actual in (expected or [])
    if op == "not_in":
        return actual not in (expected or [])
    if op == "contains":
        if isinstance(actual, (list, tuple, set, str)):
            return expected in actual
        return False
    if op == "starts_with":
        if isinstance(actual, str) and isinstance(expected, str):
            return actual.startswith(expected)
        return False
    raise ValueError(f"Unknown predicate op: {op}")


# ===== Field-level security =====

def apply_field_rules(
    records: list[dict],
    rules: list[dict],
    user_roles: list[str],
    resource: str,
) -> list[dict]:
    """Strip / mask redacted fields for the given user roles + resource.

    `rules` shape:
      [{"role": "viewer", "resource": "contacts",
        "fields_redact": ["phone","email"], "fields_readonly": ["balance"]}]

    Admin (`*` in user_roles) bypasses redaction.
    Returns deep-copied records with `__readonly_fields` annotation
    (the API layer can use it to set form fields read-only on the client).
    """
    if "*" in user_roles or "admin" in user_roles:
        return [dict(r) for r in records]

    redact_fields: set[str] = set()
    readonly_fields: set[str] = set()
    for r in rules or []:
        if r.get("resource") != resource:
            continue
        if r.get("role") not in user_roles:
            continue
        for f in r.get("fields_redact", []) or []:
            redact_fields.add(f)
        for f in r.get("fields_readonly", []) or []:
            readonly_fields.add(f)

    out = []
    for rec in records:
        copy = dict(rec)
        for f in redact_fields:
            if f in copy:
                copy[f] = None  # redact
        if readonly_fields:
            copy["__readonly_fields"] = sorted(readonly_fields)
        out.append(copy)
    return out


# ===== Record-level security =====

def filter_visible_records(
    records: list[dict],
    rules: list[dict],
    user: dict,
    resource: str,
) -> list[dict]:
    """Return only records the user is allowed to see.

    Admin (`role == admin`) bypasses all record rules.
    If no record rules apply to the user's roles for this resource, all records
    are visible (default-allow). If rules exist, the user must match at least
    one to see a record (default-deny within applied rules).
    """
    if user.get("role") == "admin":
        return list(records)

    user_roles = _user_role_codes(user)

    applicable = [
        r for r in (rules or [])
        if r.get("resource") == resource and r.get("role") in user_roles
    ]
    if not applicable:
        # No restrictions configured — default allow
        return list(records)

    out = []
    for rec in records:
        # Record visible if matches ANY applicable rule's predicate
        for r in applicable:
            try:
                if evaluate_predicate(r["predicate"], rec, user):
                    out.append(rec)
                    break
            except Exception:
                continue
    return out


def can_access_record(
    record: dict,
    rules: list[dict],
    user: dict,
    resource: str,
) -> bool:
    """Single-record gate (e.g., GET /resource/{id}). Same logic as filter."""
    visible = filter_visible_records([record], rules, user, resource)
    return len(visible) == 1


def _user_role_codes(user: dict) -> list[str]:
    """Extract list of role codes for a user (legacy + RBAC assignments)."""
    roles: list[str] = []
    legacy = user.get("role")
    if legacy:
        roles.append(legacy)
    # Allow tests / future code to inject roles directly
    extra = user.get("roles") or []
    for r in extra:
        if r and r not in roles:
            roles.append(r)
    return roles


# ===== Owner-scoping helper =====

def build_owner_scope_predicate(
    field_name: str = "owner_id",
    user_field: str = "id",
) -> dict:
    """Convenience: returns a predicate that limits records to those owned
    by the calling user."""
    return {"field": field_name, "op": "==", "value": f"$user.{user_field}"}


def build_team_scope_predicate(
    field_name: str = "team_id",
    user_field: str = "team_ids",
) -> dict:
    """Records whose team_id is in the user's team list."""
    return {"field": field_name, "op": "in", "value": f"$user.{user_field}"}
