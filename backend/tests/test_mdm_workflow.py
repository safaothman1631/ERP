"""Pool 3.6 MDM golden-record + BPMN-lite workflow engine (pure)."""
import pytest

from app.services import mdm_golden as M
from app.services import workflow_engine as WF


# ── MDM ───────────────────────────────────────────────────────────
def test_match_score_full_partial_empty():
    a = {"name": "Acme", "tax_id": "123"}
    assert M.match_score(a, {"name": "acme", "tax_id": "123"}, ["name", "tax_id"]) == 1.0
    assert M.match_score(a, {"name": "Acme", "tax_id": "999"}, ["name", "tax_id"]) == 0.5
    # empty values never count as a match
    assert M.match_score({"name": ""}, {"name": ""}, ["name"]) == 0.0


def test_find_duplicate_groups():
    recs = [
        {"id": 1, "name": "Acme", "tax_id": "123"},
        {"id": 2, "name": "Other", "tax_id": "999"},
        {"id": 3, "name": "ACME", "tax_id": "123"},
    ]
    groups = M.find_duplicate_groups(recs, ["name", "tax_id"], threshold=1.0)
    dup = [g for g in groups if len(g) > 1]
    assert len(dup) == 1 and {r["id"] for r in dup[0]} == {1, 3}


def test_merge_golden_recency_wins_and_fills_gaps():
    recs = [
        {"id": 1, "name": "Acme", "phone": "111", "email": "", "updated_at": "2026-01-01"},
        {"id": 2, "name": "Acme Inc", "phone": "", "email": "a@x.io", "updated_at": "2026-03-01"},
    ]
    g = M.merge_golden(recs)
    assert g["name"] == "Acme Inc"      # most recent non-empty
    assert g["phone"] == "111"          # filled from older (newer was empty)
    assert g["email"] == "a@x.io"
    assert set(g["_merged_from"]) == {1, 2}


# ── Workflow ──────────────────────────────────────────────────────
def _defn():
    return {
        "states": ["draft", "sent", "paid"],
        "start": "draft",
        "end": ["paid"],
        "transitions": [
            {"from": "draft", "to": "sent", "on": "send"},
            {"from": "sent", "to": "paid", "on": "pay", "guard": lambda c: c.get("amount", 0) > 0},
        ],
    }


def test_validate_definition_ok_and_errors():
    assert WF.validate_definition(_defn()) == []
    bad = {"states": ["a"], "start": "z", "transitions": [{"from": "a", "to": "b", "on": "x"}]}
    errs = WF.validate_definition(bad)
    assert any("start" in e for e in errs) and any("unknown state 'b'" in e for e in errs)


def test_advance_transitions_and_guard():
    d = _defn()
    assert WF.advance(d, "draft", "send") == "sent"
    assert WF.advance(d, "sent", "pay", {"amount": 100}) == "paid"
    with pytest.raises(WF.WorkflowError):
        WF.advance(d, "sent", "pay", {"amount": 0})       # guard blocks
    with pytest.raises(WF.WorkflowError):
        WF.advance(d, "draft", "pay")                      # no transition


def test_is_end_and_reachability():
    d = _defn()
    assert WF.is_end(d, "paid") and not WF.is_end(d, "draft")
    assert WF.reachable_states(d) == {"draft", "sent", "paid"}
    assert WF.unreachable_states(d) == set()
    # add a dead state
    d2 = {**d, "states": d["states"] + ["orphan"]}
    assert WF.unreachable_states(d2) == {"orphan"}
