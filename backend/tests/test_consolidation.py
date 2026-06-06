"""Pool 3.2 consolidation engine: intercompany detection + combine/eliminate logic.

The per-entity Firestore reads are validated on real demo data in the runbook;
here we lock down the pure aggregation: summing entity trial balances and
eliminating intercompany account balances.
"""
from unittest.mock import patch

from app.services import consolidation as C


def test_is_intercompany_flag_name_code():
    assert C._is_intercompany({"is_intercompany": True})
    assert C._is_intercompany({"name": "Intercompany Receivable"})
    assert C._is_intercompany({"name": "Inter-Company Payable"})
    assert C._is_intercompany({"code": "IC-100"})
    assert not C._is_intercompany({"name": "Cash", "code": "1000"})
    assert not C._is_intercompany({})


_ENTITIES = [
    {"id": "org", "name": "Head", "ownership_pct": 100.0},
    {"id": "sub", "name": "Sub", "ownership_pct": 100.0},
]
_TBS = {
    "org": {"cash": {"debit": 1000, "credit": 0}, "ic-ar": {"debit": 300, "credit": 0}},
    "sub": {"rev": {"debit": 0, "credit": 800}, "ic-ap": {"debit": 0, "credit": 300}},
}
_AMAP = {
    "cash": {"name": "Cash", "account_type": "cash"},
    "rev": {"name": "Revenue", "account_type": "income"},
    "ic-ar": {"name": "Intercompany AR", "account_type": "accounts_receivable", "is_intercompany": True},
    "ic-ap": {"name": "Intercompany AP", "account_type": "accounts_payable", "is_intercompany": True},
}


def _run(**kw):
    with patch.object(C, "list_entities", return_value=_ENTITIES), \
         patch.object(C, "entity_trial_balance", side_effect=lambda *a, **k: _TBS[a[1]]), \
         patch.object(C, "build_account_map", return_value=_AMAP):
        return C.consolidated_trial_balance("org", **kw)


def test_consolidated_sums_entities_and_eliminates_ic():
    out = _run()
    # intercompany accounts eliminated from the consolidated view
    assert "ic-ar" not in out["accounts"] and "ic-ap" not in out["accounts"]
    assert set(out["eliminations"].keys()) == {"ic-ar", "ic-ap"}
    # remaining real accounts summed across entities
    assert out["accounts"]["cash"]["debit"] == 1000
    assert out["accounts"]["rev"]["credit"] == 800
    assert out["total_debit"] == 1000 and out["total_credit"] == 800
    assert len(out["entities"]) == 2
    # per-entity breakdown preserved (head = cash 1000 + ic-ar 300)
    assert out["per_entity"]["org"]["debit"] == 1300
    assert out["per_entity"]["sub"]["credit"] == 1100


def test_no_elimination_when_flag_off():
    out = _run(eliminate_intercompany=False)
    assert "ic-ar" in out["accounts"] and "ic-ap" in out["accounts"]
    assert out["eliminations"] == {}
    # now intercompany balances are included
    assert out["total_debit"] == 1300 and out["total_credit"] == 1100


def test_consolidated_financials_pl_bs_minority():
    cons_tb = {
        "accounts": {
            "cash": {"account_id": "cash", "account_name": "Cash", "account_type": "cash", "debit": 2000, "credit": 0},
            "ap": {"account_id": "ap", "account_name": "AP", "account_type": "accounts_payable", "debit": 0, "credit": 500},
            "rev": {"account_id": "rev", "account_name": "Rev", "account_type": "income", "debit": 0, "credit": 2000},
            "exp": {"account_id": "exp", "account_name": "Exp", "account_type": "expense", "debit": 500, "credit": 0},
        },
        "entities": [{"id": "org", "name": "Head", "ownership_pct": 100},
                     {"id": "sub", "name": "Sub", "ownership_pct": 80}],
        "per_entity": {
            "org": {"accounts": {}},
            "sub": {"accounts": {"rev": {"debit": 0, "credit": 1000}, "exp": {"debit": 0, "credit": 0}}},
        },
        "eliminations": {},
    }
    amap = {"rev": {"account_type": "income"}, "exp": {"account_type": "expense"}}
    with patch.object(C, "consolidated_trial_balance", return_value=cons_tb), \
         patch.object(C, "build_account_map", return_value=amap):
        fin = C.consolidated_financials("org")
    inc = fin["income_statement"]
    assert inc["revenue"] == 2000 and inc["expenses"] == 500 and inc["net_income"] == 1500
    # sub net income 1000 -> 20% minority = 200; parent = 1300
    assert inc["minority_interest"] == 200.0
    assert inc["net_income_to_parent"] == 1300.0
    bs = fin["balance_sheet"]
    assert bs["assets"] == 2000 and bs["liabilities"] == 500
    assert bs["balanced"]  # 2000 == 500 liab + 0 equity + 1500 NI


# ─────────── transaction-driven elimination (Pool 3.2 refinement) ───────────

_IC_JOURNALS = [
    # A→B 1000 matched by B→A 600  ->  matched 600 (each side), imbalance 400.
    {"from_company_id": "A", "to_company_id": "B", "amount": 1000, "status": "posted"},
    {"from_company_id": "B", "to_company_id": "A", "amount": 600, "status": "posted"},
    # C→D 500 with no reciprocal -> nothing matched, imbalance 500.
    {"from_company_id": "C", "to_company_id": "D", "amount": 500, "status": "posted"},
    # ignored: eliminated / void / self / blank.
    {"from_company_id": "A", "to_company_id": "B", "amount": 999, "eliminated": True},
    {"from_company_id": "A", "to_company_id": "B", "amount": 999, "status": "void"},
    {"from_company_id": "X", "to_company_id": "X", "amount": 50, "status": "posted"},
    {"from_company_id": "", "to_company_id": "B", "amount": 50, "status": "posted"},
]


def test_transaction_elimination_reciprocal_netting():
    with patch.object(C, "_intercompany_journals", return_value=_IC_JOURNALS):
        out = C.transaction_elimination_entries("org")
    pairs = {(p["company_a"], p["company_b"]): p for p in out["pairs"]}
    # A↔B: directional 1000 / 600 -> matched 600/side, eliminated 1200, imbalance 400
    ab = pairs[("A", "B")]
    assert ab["a_to_b"] == 1000 and ab["b_to_a"] == 600
    assert ab["eliminated"] == 1200 and ab["imbalance"] == 400
    # C↔D: one-directional 500 -> nothing reciprocal eliminated, full imbalance
    cd = pairs[("C", "D")]
    assert cd["eliminated"] == 0 and cd["imbalance"] == 500
    # excluded records (eliminated/void/self/blank) never create a pair
    assert set(pairs.keys()) == {("A", "B"), ("C", "D")}
    assert out["total_eliminated"] == 1200 and out["total_imbalance"] == 900
    # deterministic ordering
    assert [(p["company_a"], p["company_b"]) for p in out["pairs"]] == [("A", "B"), ("C", "D")]


def test_consolidated_trial_balance_integrates_both_elimination_sources():
    # Account-based (_run mocks) + transaction-driven (IC journals) combine
    # additively; each elimination is tagged with its source.
    with patch.object(C, "list_entities", return_value=_ENTITIES), \
         patch.object(C, "entity_trial_balance", side_effect=lambda *a, **k: _TBS[a[1]]), \
         patch.object(C, "build_account_map", return_value=_AMAP), \
         patch.object(C, "_intercompany_journals", return_value=_IC_JOURNALS):
        out = C.consolidated_trial_balance("org")

    elim = out["eliminations"]
    # account-based ones keep their account-id keys and are tagged 'account'
    assert elim["ic-ar"]["source"] == "account" and elim["ic-ar"]["debit"] == 300
    assert elim["ic-ap"]["source"] == "account"
    # transaction-driven ones appear under txn:* keys tagged 'transaction'
    txn_keys = {k for k, v in elim.items() if v.get("source") == "transaction"}
    assert txn_keys == {"txn:A|B"}  # C↔D had no reciprocal match -> not eliminated
    ab = elim["txn:A|B"]
    assert ab["debit"] == 600 and ab["credit"] == 600  # matched amount, balanced
    assert ab["imbalance"] == 400 and ab["company_a"] == "A" and ab["company_b"] == "B"
    # structured detail passed through; real accounts untouched by txn elimination
    assert out["transaction_eliminations"]["total_eliminated"] == 1200
    assert out["accounts"]["cash"]["debit"] == 1000 and out["accounts"]["rev"]["credit"] == 800


def test_consolidated_trial_balance_txn_elim_degrades_gracefully():
    # If the IC-journal read raises, the account-based result is unaffected and
    # no transaction eliminations are produced (resilience guard).
    def _boom(*a, **k):
        raise RuntimeError("firestore down")

    with patch.object(C, "list_entities", return_value=_ENTITIES), \
         patch.object(C, "entity_trial_balance", side_effect=lambda *a, **k: _TBS[a[1]]), \
         patch.object(C, "build_account_map", return_value=_AMAP), \
         patch.object(C, "_intercompany_journals", side_effect=_boom):
        out = C.consolidated_trial_balance("org")
    # account-based elimination still works
    assert out["eliminations"]["ic-ar"]["source"] == "account"
    assert all(v.get("source") != "transaction" for v in out["eliminations"].values())
    assert out["transaction_eliminations"]["pairs"] == []
