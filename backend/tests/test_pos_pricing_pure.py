"""Pure-logic unit tests for the POS pricelist resolver.

Targets ``app.services.pos_pricing.apply_pricelist`` — a pure function over a
pricelist dict (``datetime``/``typing`` only, no Firestore/network). Covers rule
specificity ordering (product > category > all), min_qty gating, date-range
validity, and the three ``compute`` modes (fixed / discount / formula).
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.pos_pricing import apply_pricelist


def _iso(dt: datetime) -> str:
    return dt.isoformat()


# ─────────────────────────────────────────────────────────────────────────
# Empty / no-match fall-through to base price
# ─────────────────────────────────────────────────────────────────────────


def test_no_rules_returns_base_price():
    assert apply_pricelist({}, "item-1", 1, 100.0) == 100.0


def test_empty_rules_list_returns_base_price():
    assert apply_pricelist({"rules": []}, "item-1", 1, 100.0) == 100.0


def test_no_matching_rule_returns_base_price():
    pl = {"rules": [{"applies_on": "product", "product_id": "other", "compute": "fixed", "fixed_price": 5}]}
    assert apply_pricelist(pl, "item-1", 1, 100.0) == 100.0


# ─────────────────────────────────────────────────────────────────────────
# compute == "fixed"
# ─────────────────────────────────────────────────────────────────────────


def test_fixed_price_for_matching_product():
    pl = {"rules": [{"applies_on": "product", "product_id": "item-1", "compute": "fixed", "fixed_price": 80}]}
    assert apply_pricelist(pl, "item-1", 1, 100.0) == 80.0


def test_fixed_price_returns_float():
    pl = {"rules": [{"applies_on": "product", "product_id": "item-1", "compute": "fixed", "fixed_price": 80}]}
    assert isinstance(apply_pricelist(pl, "item-1", 1, 100.0), float)


def test_fixed_price_none_is_skipped_falls_through():
    # fixed_price missing → rule does not produce a price → base returned.
    pl = {"rules": [{"applies_on": "product", "product_id": "item-1", "compute": "fixed"}]}
    assert apply_pricelist(pl, "item-1", 1, 100.0) == 100.0


# ─────────────────────────────────────────────────────────────────────────
# compute == "discount"
# ─────────────────────────────────────────────────────────────────────────


def test_discount_percent_applied():
    pl = {"rules": [{"applies_on": "all", "compute": "discount", "percent": 10}]}
    # 100 * (1 - 10/100) = 90
    assert apply_pricelist(pl, "item-1", 1, 100.0) == 90.0


def test_discount_zero_percent_is_base():
    pl = {"rules": [{"applies_on": "all", "compute": "discount", "percent": 0}]}
    assert apply_pricelist(pl, "item-1", 1, 100.0) == 100.0


def test_discount_hundred_percent_is_free():
    pl = {"rules": [{"applies_on": "all", "compute": "discount", "percent": 100}]}
    assert apply_pricelist(pl, "item-1", 1, 100.0) == 0.0


# ─────────────────────────────────────────────────────────────────────────
# compute == "formula": (base * base_multiplier) - discount_amount
# ─────────────────────────────────────────────────────────────────────────


def test_formula_multiplier_and_discount():
    pl = {"rules": [{"applies_on": "all", "compute": "formula", "base": 2.0, "price_discount": 30}]}
    # (100 * 2.0) - 30 = 170
    assert apply_pricelist(pl, "item-1", 1, 100.0) == 170.0


def test_formula_defaults_multiplier_one_discount_zero():
    pl = {"rules": [{"applies_on": "all", "compute": "formula"}]}
    # (100 * 1.0) - 0 = 100
    assert apply_pricelist(pl, "item-1", 1, 100.0) == 100.0


# ─────────────────────────────────────────────────────────────────────────
# min_qty gating
# ─────────────────────────────────────────────────────────────────────────


def test_min_qty_not_met_skips_rule():
    pl = {"rules": [{"applies_on": "all", "compute": "fixed", "fixed_price": 50, "min_qty": 10}]}
    # qty 3 < 10 → skip → base
    assert apply_pricelist(pl, "item-1", 3, 100.0) == 100.0


def test_min_qty_met_applies_rule():
    pl = {"rules": [{"applies_on": "all", "compute": "fixed", "fixed_price": 50, "min_qty": 10}]}
    assert apply_pricelist(pl, "item-1", 10, 100.0) == 50.0


# ─────────────────────────────────────────────────────────────────────────
# Specificity ordering: product > category > all
# ─────────────────────────────────────────────────────────────────────────


def test_product_rule_wins_over_category_and_all():
    pl = {
        "rules": [
            {"applies_on": "all", "compute": "fixed", "fixed_price": 10},
            {"applies_on": "category", "category_id": "cat-1", "compute": "fixed", "fixed_price": 20},
            {"applies_on": "product", "product_id": "item-1", "compute": "fixed", "fixed_price": 30},
        ]
    }
    assert apply_pricelist(pl, "item-1", 1, 100.0, category_id="cat-1") == 30.0


def test_category_rule_wins_over_all_when_no_product_rule():
    pl = {
        "rules": [
            {"applies_on": "all", "compute": "fixed", "fixed_price": 10},
            {"applies_on": "category", "category_id": "cat-1", "compute": "fixed", "fixed_price": 20},
        ]
    }
    assert apply_pricelist(pl, "item-1", 1, 100.0, category_id="cat-1") == 20.0


def test_category_rule_ignored_when_no_category_id_passed():
    pl = {
        "rules": [
            {"applies_on": "category", "category_id": "cat-1", "compute": "fixed", "fixed_price": 20},
            {"applies_on": "all", "compute": "fixed", "fixed_price": 10},
        ]
    }
    # No category_id → category bucket empty → falls to "all".
    assert apply_pricelist(pl, "item-1", 1, 100.0) == 10.0


# ─────────────────────────────────────────────────────────────────────────
# Date-range validity
# ─────────────────────────────────────────────────────────────────────────


def test_rule_before_date_from_is_skipped():
    future = datetime.utcnow() + timedelta(days=5)
    pl = {"rules": [{"applies_on": "all", "compute": "fixed", "fixed_price": 50, "date_from": _iso(future)}]}
    assert apply_pricelist(pl, "item-1", 1, 100.0) == 100.0


def test_rule_after_date_to_is_skipped():
    past = datetime.utcnow() - timedelta(days=5)
    pl = {"rules": [{"applies_on": "all", "compute": "fixed", "fixed_price": 50, "date_to": _iso(past)}]}
    assert apply_pricelist(pl, "item-1", 1, 100.0) == 100.0


def test_rule_within_date_range_applies():
    past = datetime.utcnow() - timedelta(days=5)
    future = datetime.utcnow() + timedelta(days=5)
    pl = {
        "rules": [
            {
                "applies_on": "all",
                "compute": "fixed",
                "fixed_price": 50,
                "date_from": _iso(past),
                "date_to": _iso(future),
            }
        ]
    }
    assert apply_pricelist(pl, "item-1", 1, 100.0) == 50.0


def test_malformed_date_is_ignored_and_rule_applies():
    # An unparsable date string is swallowed (bare except) → rule still applies.
    pl = {"rules": [{"applies_on": "all", "compute": "fixed", "fixed_price": 50, "date_from": "not-a-date"}]}
    assert apply_pricelist(pl, "item-1", 1, 100.0) == 50.0
