"""BPMN-lite workflow engine (Pool 3.6) — pure state machine.

A definition is ``{"states": [...], "start": s, "end": [...], "transitions":
[{"from", "to", "on", "guard"?}]}``. ``guard`` is an optional callable
``(context) -> bool``. Pure (no I/O), fully unit-tested.
"""
from __future__ import annotations

from collections import deque
from typing import Any


class WorkflowError(Exception):
    pass


def validate_definition(definition: dict) -> list[str]:
    """Return a list of structural errors ([] = valid)."""
    errors: list[str] = []
    states = set(definition.get("states") or [])
    if not states:
        errors.append("no states defined")
    if definition.get("start") and definition["start"] not in states:
        errors.append(f"start state '{definition['start']}' not in states")
    for t in definition.get("transitions") or []:
        if t.get("from") not in states:
            errors.append(f"transition from unknown state '{t.get('from')}'")
        if t.get("to") not in states:
            errors.append(f"transition to unknown state '{t.get('to')}'")
        if not t.get("on"):
            errors.append(f"transition {t.get('from')}->{t.get('to')} missing 'on' event")
    return errors


def advance(definition: dict, current_state: str, event: str, context: dict | None = None) -> str:
    """Apply ``event`` from ``current_state``. Returns the next state, or raises
    WorkflowError if no (guard-satisfying) transition matches."""
    context = context or {}
    matched_without_guard = False
    for t in definition.get("transitions") or []:
        if t.get("from") == current_state and t.get("on") == event:
            guard = t.get("guard")
            if guard is not None and not guard(context):
                matched_without_guard = True
                continue
            return t["to"]
    if matched_without_guard:
        raise WorkflowError(f"transition {current_state} --{event}--> blocked by guard")
    raise WorkflowError(f"no transition from '{current_state}' on '{event}'")


def is_end(definition: dict, state: str) -> bool:
    return state in set(definition.get("end") or [])


def reachable_states(definition: dict, start: str | None = None) -> set[str]:
    """BFS of states reachable from ``start`` (or the definition's start)."""
    start = start or definition.get("start")
    if not start:
        return set()
    adj: dict[str, list[str]] = {}
    for t in definition.get("transitions") or []:
        adj.setdefault(t.get("from"), []).append(t.get("to"))
    seen = {start}
    q: deque[str] = deque([start])
    while q:
        cur = q.popleft()
        for nxt in adj.get(cur, []):
            if nxt not in seen:
                seen.add(nxt)
                q.append(nxt)
    return seen


def unreachable_states(definition: dict) -> set[str]:
    """States that can never be reached from start (dead states)."""
    return set(definition.get("states") or []) - reachable_states(definition)
