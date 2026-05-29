"""Tests for the staging seeder CLI (launch-readiness § R3.4)."""
from __future__ import annotations

import logging
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.tools import seed_staging  # noqa: E402


# ── CLI parsing ─────────────────────────────────────────────────────────

def test_cli_requires_tenant_id():
    import pytest

    with pytest.raises(SystemExit):
        seed_staging._parse_args([])


def test_cli_parses_all_flags():
    ns = seed_staging._parse_args([
        "--tenant-id", "acme-staging-1",
        "--reset",
        "--dry-run",
        "--seed", "7",
        "-v",
    ])
    assert ns.tenant_id == "acme-staging-1"
    assert ns.reset is True
    assert ns.dry_run is True
    assert ns.seed == 7
    assert ns.verbose is True


# ── Dry-run mode ────────────────────────────────────────────────────────

def test_dry_run_skips_all_firestore_writes(caplog):
    """In dry-run mode the seeder must not touch any repository class."""
    caplog.set_level(logging.INFO, logger="seed_staging")
    seeder = seed_staging.StagingSeeder("acme-staging", dry_run=True)
    # Spy on every import path the seeder would otherwise reach for.
    with patch("app.firestore.accounts.AccountRepository") as acc, \
         patch("app.firestore.contacts.ContactRepository") as cc, \
         patch("app.firestore.items.ItemRepository") as ic, \
         patch("app.firestore.banking.BankAccountRepository") as bc, \
         patch("app.firestore.invoices.InvoiceRepository") as iv, \
         patch("app.firestore.onboarding_repo.apply_coa") as apply_coa:
        summary = seeder.seed()
        # No repo class was constructed.
        acc.assert_not_called()
        cc.assert_not_called()
        ic.assert_not_called()
        bc.assert_not_called()
        iv.assert_not_called()
        apply_coa.assert_not_called()
    # Summary is still populated with the targets the live run would hit.
    assert summary["customers"] == seed_staging.TARGET_COUNTS["customers"]
    assert summary["items"] == seed_staging.TARGET_COUNTS["items"]
    assert summary["invoices"] == seed_staging.TARGET_COUNTS["invoices"]


def test_dry_run_reset_does_not_call_repos(caplog):
    caplog.set_level(logging.INFO, logger="seed_staging")
    seeder = seed_staging.StagingSeeder("acme-staging", dry_run=True)
    with patch("app.firestore.contacts.ContactRepository") as cc:
        seeder.reset()
        cc.assert_not_called()


# ── Idempotency: --reset followed by re-seed ───────────────────────────

def test_reset_then_seed_runs_without_error_in_dry_run():
    """``--reset`` + seed should be safe to invoke twice (Cloud Scheduler will)."""
    seeder = seed_staging.StagingSeeder("acme-staging", dry_run=True)
    seeder.reset()
    s1 = seeder.seed()
    seeder.reset()
    s2 = seeder.seed()
    # Dry-run produces deterministic counts.
    assert s1 == s2


def test_main_dry_run_returns_zero_exit_code():
    rc = seed_staging.main([
        "--tenant-id", "acme-staging-test",
        "--dry-run",
    ])
    assert rc == 0


def test_main_reset_dry_run_returns_zero_exit_code():
    rc = seed_staging.main([
        "--tenant-id", "acme-staging-test",
        "--reset",
        "--dry-run",
    ])
    assert rc == 0


# ── Sample data sanity ─────────────────────────────────────────────────

def test_iraqi_names_pool_is_nontrivial():
    assert len(seed_staging.IRAQI_FIRST_NAMES) >= 30
    assert len(seed_staging.IRAQI_LAST_NAMES) >= 10
    # Includes Kurdish names per the Kurdish-first product positioning.
    assert any(name in seed_staging.IRAQI_FIRST_NAMES for name in ("Aram", "Rebin", "Hêmin"))


def test_item_categories_cover_five_buckets():
    assert len(seed_staging.ITEM_CATEGORIES) == 5
    assert set(seed_staging.ITEM_CATEGORIES) == {
        "Electronics", "Groceries", "Apparel", "Home", "Services",
    }


def test_baghdad_tax_rates_include_required_set():
    names = {row["name"] for row in seed_staging.BAGHDAD_TAX_RATES}
    assert any("VAT" in n for n in names)
    assert any("Withholding" in n for n in names)
    assert any("Hospitality" in n for n in names)


def test_target_counts_match_spec():
    """Matches the design.md § 3.4 targets the spec calls out."""
    assert seed_staging.TARGET_COUNTS["customers"] == 50
    assert seed_staging.TARGET_COUNTS["vendors"] == 10
    assert seed_staging.TARGET_COUNTS["items"] == 100
    assert seed_staging.TARGET_COUNTS["bank_accounts"] == 5
    assert seed_staging.TARGET_COUNTS["invoices"] == 30
