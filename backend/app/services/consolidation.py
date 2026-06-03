"""Multi-company consolidation engine (Pool 3.2).

GL-based: every journal entry is tagged with ``company_id`` (defaults to
``org_id`` = the head entity). Consolidation = the sum of each entity's trial
balance, with intercompany account balances eliminated so the group never
reports balances / revenue with itself.

Wholly-owned (ownership_pct == 100) groups need no minority interest; for
partially-owned subsidiaries the minority share of equity is surfaced as a
separate figure (``minority_interest``) rather than silently folded in.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from app.services.report_queries import build_account_map, collect_journal_entries

# Statement classification by account_type (lower-cased).
_INCOME_TYPES = {"income", "revenue", "other_income", "sales", "operating_revenue"}
_EXPENSE_TYPES = {
    "expense", "operating_expense", "other_expense", "cost_of_goods_sold", "cogs",
}
_ASSET_TYPES = {
    "asset", "cash", "bank", "accounts_receivable", "inventory", "fixed_asset",
    "other_current_asset", "other_asset", "current_asset",
}
_LIABILITY_TYPES = {
    "liability", "accounts_payable", "current_liability", "long_term_liability",
    "other_current_liability", "other_liability", "credit_card",
}
_EQUITY_TYPES = {"equity", "retained_earnings", "owner_equity", "capital"}


def _is_intercompany(account: dict) -> bool:
    """An account whose balances must be eliminated on consolidation."""
    if account.get("is_intercompany"):
        return True
    name = (account.get("name") or "").lower()
    code = str(account.get("code") or "").lower()
    return ("intercompany" in name) or ("inter-company" in name) or code.startswith("ic-")


def _intercompany_journals(
    org_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[dict]:
    """Posted, non-voided, non-eliminated intercompany journals in ``[start, end]``.

    Each record carries ``from_company_id`` / ``to_company_id`` / ``amount`` (the
    actual transaction between two entities). Records explicitly marked
    ``eliminated`` (already reversed) or ``status`` void/draft/cancelled are
    skipped. Date filtering reuses the report-query parser so str/datetime
    ``date`` values compare consistently."""
    from app.firestore.companies import IntercompanyJournalRepository
    from app.services.report_queries import in_date_range

    repo = IntercompanyJournalRepository(org_id)
    items, _ = repo.list(order_by="date", order_dir="ASCENDING", limit=5000)
    out: list[dict] = []
    for rec in items:
        if rec.get("eliminated"):
            continue
        status = (rec.get("status") or "posted").lower()
        if status in ("void", "draft", "cancelled", "canceled"):
            continue
        if not rec.get("from_company_id") or not rec.get("to_company_id"):
            continue
        if rec["from_company_id"] == rec["to_company_id"]:
            continue
        if not in_date_range(rec, "date", start, end):
            continue
        out.append(rec)
    return out


def transaction_elimination_entries(
    org_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
) -> dict:
    """Intercompany **transaction-driven** elimination, derived from the actual
    intercompany journals (``app/firestore/companies.IntercompanyJournalRepository``)
    rather than from account names/flags.

    For every unordered pair of entities ``{A, B}`` the directional IC activity is
    summed (``A→B`` and ``B→A``). The *reciprocal* (matched) portion —
    ``min(Σ A→B, Σ B→A)`` — is the amount that genuinely nets to zero on
    consolidation (what one entity booked as a claim, the other booked as the
    mirror obligation). Any difference is an unmatched imbalance (a reconciling
    item, surfaced but **not** eliminated, so the group books never silently
    drop a real third-party exposure).

    Pure/deterministic over the journal list. Returns::

        {
          "pairs": [ {company_a, company_b, a_to_b, b_to_a,
                      eliminated, imbalance}, ... ],   # sorted, deterministic
          "total_eliminated": float,   # Σ reciprocal matched (per direction)
          "total_imbalance": float,
        }
    """
    journals = _intercompany_journals(org_id, start, end)

    # Directional sums keyed by ordered (from, to). Self-guard against records
    # the fetcher might not have screened (already-eliminated, void/draft, self,
    # or missing counterparties) so the aggregator can never double-count or
    # invent a same-entity pair regardless of how it is fed.
    directional: dict[tuple[str, str], float] = defaultdict(float)
    for rec in journals:
        if rec.get("eliminated"):
            continue
        if (rec.get("status") or "posted").lower() in (
            "void", "draft", "cancelled", "canceled"
        ):
            continue
        frm = rec.get("from_company_id")
        to = rec.get("to_company_id")
        if not frm or not to or frm == to:
            continue
        directional[(frm, to)] += float(rec.get("amount") or 0)

    # Collapse to unordered pairs (sorted so the pair key is deterministic).
    pairs_seen: set[frozenset[str]] = set()
    pairs: list[dict] = []
    total_eliminated = 0.0
    total_imbalance = 0.0
    for (frm, to) in directional:
        key = frozenset((frm, to))
        if key in pairs_seen:
            continue
        pairs_seen.add(key)
        a, b = sorted((frm, to))
        a_to_b = round(directional.get((a, b), 0.0), 2)
        b_to_a = round(directional.get((b, a), 0.0), 2)
        # Matched reciprocal amount eliminated on each side; the imbalance is the
        # unmatched remainder (a genuine net intercompany position, not removed).
        matched = round(min(a_to_b, b_to_a), 2)
        imbalance = round(abs(a_to_b - b_to_a), 2)
        # ``eliminated`` here counts BOTH reciprocal directions removed from the
        # combined books (Σ over the pair), so it is comparable to account-based
        # elimination totals which also sum debit+credit legs.
        eliminated = round(matched * 2, 2)
        pairs.append({
            "company_a": a,
            "company_b": b,
            "a_to_b": a_to_b,
            "b_to_a": b_to_a,
            "eliminated": eliminated,
            "imbalance": imbalance,
        })
        total_eliminated = round(total_eliminated + eliminated, 2)
        total_imbalance = round(total_imbalance + imbalance, 2)

    pairs.sort(key=lambda p: (p["company_a"], p["company_b"]))
    return {
        "pairs": pairs,
        "total_eliminated": round(total_eliminated, 2),
        "total_imbalance": round(total_imbalance, 2),
    }


def list_entities(org_id: str) -> list[dict]:
    """Every legal entity in the org + the synthetic head company (id == org_id).

    ``ownership_pct`` defaults to 100 (wholly owned) when unset."""
    from app.firestore.companies import CompanyRepository

    repo = CompanyRepository(org_id)
    items, _ = repo.list(order_by="name", order_dir="ASCENDING", limit=500)
    if not any(c.get("is_primary") for c in items):
        items.insert(0, {
            "id": org_id, "name": "Head Company", "code": "HQ",
            "is_primary": True, "is_active": True,
        })
    for c in items:
        c["ownership_pct"] = float(c.get("ownership_pct") or 100)
    return items


def entity_trial_balance(
    org_id: str,
    company_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
) -> dict[str, dict[str, float]]:
    """Per-entity account debit/credit totals from that entity's posted JEs.

    A JE belongs to the entity whose ``company_id`` it carries; entries written
    before multi-company (no company_id) belong to the head entity (org_id)."""
    from app.firestore.journals import JournalEntryRepository

    repo = JournalEntryRepository(org_id)
    balances: dict[str, dict[str, float]] = defaultdict(
        lambda: {"debit": 0.0, "credit": 0.0}
    )
    for entry in collect_journal_entries(org_id, start, end):
        if (entry.get("company_id") or org_id) != company_id:
            continue
        for line in repo.get_lines(entry["id"]):
            aid = line.get("account_id", "")
            balances[aid]["debit"] += float(line.get("debit", 0) or 0)
            balances[aid]["credit"] += float(line.get("credit", 0) or 0)
    return dict(balances)


def consolidated_trial_balance(
    org_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
    *,
    eliminate_intercompany: bool = True,
) -> dict:
    """Sum of every entity's trial balance, with intercompany accounts eliminated.

    Returns the per-entity breakdown, the combined accounts (post-elimination),
    the eliminated balances, and consolidated debit/credit totals."""
    entities = list_entities(org_id)
    account_map = build_account_map(org_id)

    combined: dict[str, dict[str, float]] = defaultdict(
        lambda: {"debit": 0.0, "credit": 0.0}
    )
    per_entity: dict[str, dict] = {}
    for ent in entities:
        tb = entity_trial_balance(org_id, ent["id"], start, end)
        per_entity[ent["id"]] = {
            "name": ent.get("name"),
            "ownership_pct": ent["ownership_pct"],
            "debit": round(sum(v["debit"] for v in tb.values()), 2),
            "credit": round(sum(v["credit"] for v in tb.values()), 2),
            "accounts": tb,
        }
        for aid, v in tb.items():
            combined[aid]["debit"] += v["debit"]
            combined[aid]["credit"] += v["credit"]

    eliminations: dict[str, dict[str, float]] = {}
    txn_elim: dict = {"pairs": [], "total_eliminated": 0.0, "total_imbalance": 0.0}
    if eliminate_intercompany:
        # (1) Account-based elimination: zero out accounts flagged/named/coded as
        #     intercompany (the original behaviour — preserved).
        for aid in list(combined.keys()):
            acct = account_map.get(aid) or {}
            if _is_intercompany(acct):
                eliminations[aid] = {**combined[aid], "source": "account"}
                combined[aid] = {"debit": 0.0, "credit": 0.0}

        # (2) Transaction-driven elimination: an ADDITIONAL source derived from
        #     the actual intercompany journals (reciprocal from↔to amounts that
        #     net to zero). Surfaced in ``eliminations`` (tagged source) +
        #     ``transaction_eliminations``. Degrades to empty if the journals
        #     can't be read — never breaks the account-based result.
        try:
            txn_elim = transaction_elimination_entries(org_id, start, end)
            for i, pair in enumerate(txn_elim["pairs"]):
                if pair["eliminated"] <= 0:
                    continue
                key = f"txn:{pair['company_a']}|{pair['company_b']}"
                # The matched reciprocal amount appears once as a debit-side and
                # once as a credit-side removal, so the elimination stays balanced.
                matched_one_side = round(pair["eliminated"] / 2, 2)
                eliminations[key] = {
                    "debit": matched_one_side,
                    "credit": matched_one_side,
                    "source": "transaction",
                    "company_a": pair["company_a"],
                    "company_b": pair["company_b"],
                    "imbalance": pair["imbalance"],
                }
        except Exception:
            import logging

            logging.getLogger(__name__).warning(
                "transaction_elimination_entries failed; account-based only",
                exc_info=True,
            )

    accounts = {}
    for aid, v in combined.items():
        if abs(v["debit"]) < 0.005 and abs(v["credit"]) < 0.005:
            continue
        acct = account_map.get(aid) or {}
        accounts[aid] = {
            "account_id": aid,
            "account_name": acct.get("name", aid),
            "account_type": acct.get("account_type", ""),
            "debit": round(v["debit"], 2),
            "credit": round(v["credit"], 2),
        }

    total_debit = round(sum(a["debit"] for a in accounts.values()), 2)
    total_credit = round(sum(a["credit"] for a in accounts.values()), 2)
    return {
        "entities": [
            {"id": e["id"], "name": e.get("name"), "ownership_pct": e["ownership_pct"]}
            for e in entities
        ],
        "per_entity": per_entity,
        "accounts": accounts,
        "eliminations": {
            aid: {
                "debit": round(v["debit"], 2),
                "credit": round(v["credit"], 2),
                # ADDITIVE: tag the elimination source ('account' or 'transaction')
                # so callers can distinguish; defaults to 'account' for any legacy
                # entry that lacked the tag.
                **{k: v[k] for k in ("source", "company_a", "company_b", "imbalance") if k in v},
                "source": v.get("source", "account"),
            }
            for aid, v in eliminations.items()
        },
        # ADDITIVE: structured transaction-driven elimination detail (reciprocal
        # intercompany pairs + matched/eliminated/imbalance totals).
        "transaction_eliminations": txn_elim,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "balanced": abs(total_debit - total_credit) < 0.01,
    }


def _entity_net_income(entity_accounts: dict, account_map: dict) -> float:
    """Net income (income − expense) for one entity's trial balance."""
    income = expense = 0.0
    for aid, v in entity_accounts.items():
        atype = ((account_map.get(aid) or {}).get("account_type") or "").lower()
        if atype in _INCOME_TYPES:
            income += float(v.get("credit", 0) or 0) - float(v.get("debit", 0) or 0)
        elif atype in _EXPENSE_TYPES:
            expense += float(v.get("debit", 0) or 0) - float(v.get("credit", 0) or 0)
    return round(income - expense, 2)


def consolidated_financials(
    org_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
) -> dict:
    """GL-based consolidated income statement + balance sheet derived from the
    consolidated trial balance, with minority interest allocated for
    partially-owned subsidiaries (ownership_pct < 100)."""
    cons = consolidated_trial_balance(org_id, start, end)
    account_map = build_account_map(org_id)

    income = expense = assets = liabilities = equity = 0.0
    pl_lines: list[dict] = []
    bs_lines: list[dict] = []
    for aid, a in cons["accounts"].items():
        atype = (a.get("account_type") or "").lower()
        debit, credit = a["debit"], a["credit"]
        line = {"account_id": aid, "account_name": a["account_name"], "account_type": atype}
        if atype in _INCOME_TYPES:
            bal = round(credit - debit, 2); income += bal
            pl_lines.append({**line, "section": "income", "amount": bal})
        elif atype in _EXPENSE_TYPES:
            bal = round(debit - credit, 2); expense += bal
            pl_lines.append({**line, "section": "expense", "amount": bal})
        elif atype in _ASSET_TYPES:
            bal = round(debit - credit, 2); assets += bal
            bs_lines.append({**line, "section": "asset", "amount": bal})
        elif atype in _LIABILITY_TYPES:
            bal = round(credit - debit, 2); liabilities += bal
            bs_lines.append({**line, "section": "liability", "amount": bal})
        elif atype in _EQUITY_TYPES:
            bal = round(credit - debit, 2); equity += bal
            bs_lines.append({**line, "section": "equity", "amount": bal})

    income = round(income, 2)
    expense = round(expense, 2)
    net_income = round(income - expense, 2)

    # Minority interest: the non-controlling share of each subsidiary's net income.
    minority_ni = 0.0
    for ent in cons["entities"]:
        pct = float(ent.get("ownership_pct") or 100)
        if ent["id"] == org_id or pct >= 100:
            continue
        ent_tb = cons["per_entity"].get(ent["id"], {}).get("accounts", {})
        minority_ni += (1.0 - pct / 100.0) * _entity_net_income(ent_tb, account_map)
    minority_ni = round(minority_ni, 2)

    assets = round(assets, 2)
    liabilities = round(liabilities, 2)
    equity = round(equity, 2)
    return {
        "period": {
            "start": start.isoformat() if start else None,
            "end": end.isoformat() if end else None,
        },
        "income_statement": {
            "revenue": income,
            "expenses": expense,
            "net_income": net_income,
            "net_income_to_parent": round(net_income - minority_ni, 2),
            "minority_interest": minority_ni,
            "lines": pl_lines,
        },
        "balance_sheet": {
            "assets": assets,
            "liabilities": liabilities,
            "equity": equity,
            "retained_earnings_current": net_income,
            "minority_interest": minority_ni,
            "total_liabilities_and_equity": round(liabilities + equity + net_income, 2),
            "balanced": abs(assets - (liabilities + equity + net_income)) < 0.01,
            "lines": bs_lines,
        },
        "entities": cons["entities"],
        "eliminations": cons["eliminations"],
        # ADDITIVE: pass through the structured transaction-driven elimination
        # detail (reciprocal intercompany pairs) so the financials endpoint can
        # show what was eliminated from actual intercompany transactions.
        "transaction_eliminations": cons.get(
            "transaction_eliminations",
            {"pairs": [], "total_eliminated": 0.0, "total_imbalance": 0.0},
        ),
    }
