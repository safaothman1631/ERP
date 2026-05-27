"""
Property-Based Tests for Scheduler Configuration (Properties 15, 16).

**Validates: Requirements 6.3, 6.4, 6.8**

Property 15: Scheduler cron hour and minute are configurable
    For any integer h in [0, 23] set as BACKUP_CRON_HOUR, and any integer
    m in [0, 59] set as BACKUP_CRON_MINUTE, the CronTrigger added to the
    scheduler for the daily_backup job SHALL use hour=h and minute=m.

Property 16: Scheduler continues on per-org failure
    For any list of organizations where a subset fail during backup, the
    daily backup job SHALL attempt backup for every organization in the list,
    and the number of attempted backups SHALL equal the total number of
    organizations.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest
from hypothesis import given, settings as h_settings
from hypothesis import strategies as st

from app.services.backup_service import BackupRecord, BackupService


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_backup_record(org_id: str = "test-org") -> BackupRecord:
    """Return a minimal successful BackupRecord for mocking run_backup."""
    now = datetime.now(timezone.utc)
    return BackupRecord(
        id="backup-id-1",
        org_id=org_id,
        filename="backup_20240115_020000.json.gz",
        storage_path=f"backups/{org_id}/2024-01-15/backup_20240115_020000.json.gz",
        created_at=now.isoformat(),
        status="success",
        integrity_status="verified",
        total_documents=100,
        collections_backed_up=list(BackupService.COLLECTIONS),
        file_size_bytes=1024,
        checksum_sha256="a" * 64,
        error_message=None,
    )


def _make_org_doc(org_id: str) -> MagicMock:
    """Return a mock Firestore document snapshot for an organization."""
    doc = MagicMock()
    doc.id = org_id
    doc.to_dict.return_value = {"id": org_id, "name": f"Org {org_id}"}
    return doc


def _run_start_scheduler_with_env(h: int, m: int) -> list[dict]:
    """
    Run start_scheduler with BACKUP_CRON_HOUR=h and BACKUP_CRON_MINUTE=m,
    capturing all CronTrigger instantiation kwargs.

    Returns a list of dicts, one per CronTrigger call.
    """
    import app.services.scheduler as scheduler_module

    captured_calls: list[dict] = []

    class CapturingCronTrigger:
        """Fake CronTrigger that records the kwargs it was instantiated with."""
        def __init__(self, **kwargs: Any) -> None:
            captured_calls.append(dict(kwargs))

    mock_scheduler_instance = MagicMock()
    mock_scheduler_instance.start = MagicMock()

    env_overrides = {
        "SCHEDULER_ENABLED": "true",
        "BACKUP_CRON_HOUR": str(h),
        "BACKUP_CRON_MINUTE": str(m),
    }

    # Reset module-level _scheduler to None so start_scheduler runs fresh
    original_scheduler = scheduler_module._scheduler
    scheduler_module._scheduler = None

    try:
        with (
            patch.dict(os.environ, env_overrides, clear=False),
            patch.object(scheduler_module, "AsyncIOScheduler", return_value=mock_scheduler_instance),
            patch.object(scheduler_module, "CronTrigger", side_effect=CapturingCronTrigger),
        ):
            scheduler_module.start_scheduler()
    finally:
        # Always restore the original scheduler state
        scheduler_module._scheduler = original_scheduler

    return captured_calls


# ─────────────────────────────────────────────────────────────────────────────
# Property 15: Scheduler cron hour and minute are configurable
# ─────────────────────────────────────────────────────────────────────────────

# Feature: system-health-backup, Property 15
@given(
    h=st.integers(min_value=0, max_value=23),
    m=st.integers(min_value=0, max_value=59),
)
@h_settings(max_examples=100)
def test_property15_scheduler_cron_hour_and_minute_are_configurable(h: int, m: int) -> None:
    """
    **Validates: Requirements 6.3, 6.4**

    # Feature: system-health-backup, Property 15: Scheduler cron hour and minute are configurable

    For any integer h in [0, 23] set as BACKUP_CRON_HOUR, and any integer
    m in [0, 59] set as BACKUP_CRON_MINUTE, the CronTrigger added to the
    scheduler for the daily_backup job SHALL use hour=h and minute=m.
    """
    captured_calls = _run_start_scheduler_with_env(h, m)

    # The daily_backup job uses a CronTrigger with only hour and minute
    # (no 'day' kwarg — that's used by monthly_depreciation).
    # We look for a CronTrigger call that matches our env vars exactly.
    daily_backup_triggers = [
        kwargs
        for kwargs in captured_calls
        if "day" not in kwargs
        and "day_of_week" not in kwargs
        and kwargs.get("hour") == h
        and kwargs.get("minute") == m
    ]

    assert len(daily_backup_triggers) >= 1, (
        f"Expected at least one CronTrigger with hour={h}, minute={m} "
        f"(from BACKUP_CRON_HOUR={h}, BACKUP_CRON_MINUTE={m}), "
        f"but got these CronTrigger calls: {captured_calls}"
    )

    matched = daily_backup_triggers[0]
    assert matched["hour"] == h, (
        f"CronTrigger hour={matched['hour']!r} does not match "
        f"BACKUP_CRON_HOUR={h}"
    )
    assert matched["minute"] == m, (
        f"CronTrigger minute={matched['minute']!r} does not match "
        f"BACKUP_CRON_MINUTE={m}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Property 16: Scheduler continues on per-org failure
# ─────────────────────────────────────────────────────────────────────────────

# Feature: system-health-backup, Property 16
@given(
    orgs=st.lists(
        st.text(
            min_size=1,
            max_size=20,
            alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
        ),
        min_size=2,
        max_size=10,
    )
)
@h_settings(max_examples=100)
def test_property16_scheduler_continues_on_per_org_failure(orgs: list[str]) -> None:
    """
    **Validates: Requirements 6.8**

    # Feature: system-health-backup, Property 16: Scheduler continues on per-org failure

    For any list of organizations where a subset fail during backup, the
    daily backup job SHALL attempt backup for every organization in the list,
    and the number of attempted backups SHALL equal the total number of
    organizations (i.e., failures do not abort the run).
    """
    # Deduplicate org IDs while preserving order (hypothesis may generate duplicates)
    unique_orgs = list(dict.fromkeys(orgs))
    if len(unique_orgs) < 2:
        # Need at least 2 unique orgs to test the "continues after failure" property
        return

    # Choose a subset to fail: the first half (at least 1)
    failing_orgs = set(unique_orgs[: max(1, len(unique_orgs) // 2)])

    # Track which org_ids run_backup was called for
    attempted_org_ids: list[str] = []

    async def mock_run_backup(self_: BackupService) -> BackupRecord:
        """Mock that records the call and raises for failing orgs."""
        attempted_org_ids.append(self_.org_id)
        if self_.org_id in failing_orgs:
            raise RuntimeError(f"Simulated backup failure for org {self_.org_id}")
        return _make_backup_record(self_.org_id)

    # Build fake Firestore org documents
    fake_org_docs = [_make_org_doc(org_id) for org_id in unique_orgs]

    mock_db = MagicMock()
    mock_db.collection.return_value.stream.return_value = iter(fake_org_docs)

    import app.services.scheduler as scheduler_module

    with (
        patch.object(scheduler_module, "_job_daily_backup", wraps=scheduler_module._job_daily_backup),
        patch("app.firebase_client.get_firestore_client", return_value=mock_db),
        patch.object(BackupService, "run_backup", mock_run_backup),
    ):
        scheduler_module._job_daily_backup()

    # Every org must have been attempted, regardless of failures
    assert len(attempted_org_ids) == len(unique_orgs), (
        f"Expected run_backup to be attempted for all {len(unique_orgs)} orgs, "
        f"but only {len(attempted_org_ids)} were attempted: {attempted_org_ids}. "
        f"Failing orgs were: {failing_orgs}"
    )

    # The set of attempted org IDs must match the full set of orgs
    assert set(attempted_org_ids) == set(unique_orgs), (
        f"Attempted org IDs {set(attempted_org_ids)} do not match "
        f"expected org IDs {set(unique_orgs)}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Supplementary unit tests
# ─────────────────────────────────────────────────────────────────────────────

class TestSchedulerConfigurationUnit:
    """Unit tests that complement the property-based tests above."""

    def test_default_cron_hour_is_2(self) -> None:
        """When BACKUP_CRON_HOUR is not set, the default hour must be 2."""
        import app.services.scheduler as scheduler_module

        captured_calls: list[dict] = []

        class CapturingCronTrigger:
            def __init__(self, **kwargs: Any) -> None:
                captured_calls.append(dict(kwargs))

        mock_scheduler_instance = MagicMock()
        original_scheduler = scheduler_module._scheduler
        scheduler_module._scheduler = None

        # Build env without BACKUP_CRON_HOUR and BACKUP_CRON_MINUTE
        env_clean = {k: v for k, v in os.environ.items()
                     if k not in ("BACKUP_CRON_HOUR", "BACKUP_CRON_MINUTE")}
        env_clean["SCHEDULER_ENABLED"] = "true"

        try:
            with (
                patch.dict(os.environ, env_clean, clear=True),
                patch.object(scheduler_module, "AsyncIOScheduler", return_value=mock_scheduler_instance),
                patch.object(scheduler_module, "CronTrigger", side_effect=CapturingCronTrigger),
            ):
                scheduler_module.start_scheduler()
        finally:
            scheduler_module._scheduler = original_scheduler

        # Find the daily_backup trigger (no 'day' kwarg, hour=2, minute=0)
        daily_triggers = [c for c in captured_calls if "day" not in c and c.get("hour") == 2]
        assert len(daily_triggers) >= 1, (
            f"Expected default hour=2 for daily_backup CronTrigger, "
            f"got: {captured_calls}"
        )
        assert daily_triggers[0]["minute"] == 0, (
            f"Expected default minute=0, got {daily_triggers[0]['minute']}"
        )

    def test_cron_hour_env_var_overrides_default(self) -> None:
        """BACKUP_CRON_HOUR=5 and BACKUP_CRON_MINUTE=30 must produce correct CronTrigger."""
        captured_calls = _run_start_scheduler_with_env(5, 30)
        daily_triggers = [
            c for c in captured_calls
            if "day" not in c and c.get("hour") == 5 and c.get("minute") == 30
        ]
        assert len(daily_triggers) >= 1, (
            f"Expected CronTrigger with hour=5, minute=30, got: {captured_calls}"
        )

    def test_cron_boundary_hour_0_minute_0(self) -> None:
        """Boundary: hour=0, minute=0 (midnight) must be accepted."""
        captured_calls = _run_start_scheduler_with_env(0, 0)
        daily_triggers = [
            c for c in captured_calls
            if "day" not in c and c.get("hour") == 0 and c.get("minute") == 0
        ]
        assert len(daily_triggers) >= 1, (
            f"Expected CronTrigger with hour=0, minute=0, got: {captured_calls}"
        )

    def test_cron_boundary_hour_23_minute_59(self) -> None:
        """Boundary: hour=23, minute=59 (last minute of day) must be accepted."""
        captured_calls = _run_start_scheduler_with_env(23, 59)
        daily_triggers = [
            c for c in captured_calls
            if "day" not in c and c.get("hour") == 23 and c.get("minute") == 59
        ]
        assert len(daily_triggers) >= 1, (
            f"Expected CronTrigger with hour=23, minute=59, got: {captured_calls}"
        )

    def test_all_orgs_attempted_when_none_fail(self) -> None:
        """When no org fails, all orgs must be backed up successfully."""
        import app.services.scheduler as scheduler_module

        org_ids = ["org-a", "org-b", "org-c"]
        attempted: list[str] = []

        async def mock_run_backup(self_: BackupService) -> BackupRecord:
            attempted.append(self_.org_id)
            return _make_backup_record(self_.org_id)

        fake_docs = [_make_org_doc(oid) for oid in org_ids]
        mock_db = MagicMock()
        mock_db.collection.return_value.stream.return_value = iter(fake_docs)

        with (
            patch("app.firebase_client.get_firestore_client", return_value=mock_db),
            patch.object(BackupService, "run_backup", mock_run_backup),
        ):
            scheduler_module._job_daily_backup()

        assert set(attempted) == set(org_ids), (
            f"Expected all orgs {org_ids} to be attempted, got {attempted}"
        )

    def test_all_orgs_attempted_when_first_fails(self) -> None:
        """When the first org fails, remaining orgs must still be attempted."""
        import app.services.scheduler as scheduler_module

        org_ids = ["org-fail", "org-ok-1", "org-ok-2"]
        attempted: list[str] = []

        async def mock_run_backup(self_: BackupService) -> BackupRecord:
            attempted.append(self_.org_id)
            if self_.org_id == "org-fail":
                raise RuntimeError("Simulated failure")
            return _make_backup_record(self_.org_id)

        fake_docs = [_make_org_doc(oid) for oid in org_ids]
        mock_db = MagicMock()
        mock_db.collection.return_value.stream.return_value = iter(fake_docs)

        with (
            patch("app.firebase_client.get_firestore_client", return_value=mock_db),
            patch.object(BackupService, "run_backup", mock_run_backup),
        ):
            scheduler_module._job_daily_backup()

        assert set(attempted) == set(org_ids), (
            f"Expected all orgs to be attempted even after first org failed. "
            f"Attempted: {attempted}"
        )

    def test_all_orgs_attempted_when_all_fail(self) -> None:
        """When every org fails, all must still be attempted (no early abort)."""
        import app.services.scheduler as scheduler_module

        org_ids = ["org-1", "org-2", "org-3", "org-4"]
        attempted: list[str] = []

        async def mock_run_backup(self_: BackupService) -> BackupRecord:
            attempted.append(self_.org_id)
            raise RuntimeError(f"All orgs fail: {self_.org_id}")

        fake_docs = [_make_org_doc(oid) for oid in org_ids]
        mock_db = MagicMock()
        mock_db.collection.return_value.stream.return_value = iter(fake_docs)

        with (
            patch("app.firebase_client.get_firestore_client", return_value=mock_db),
            patch.object(BackupService, "run_backup", mock_run_backup),
        ):
            scheduler_module._job_daily_backup()

        assert set(attempted) == set(org_ids), (
            f"Expected all {len(org_ids)} orgs to be attempted even when all fail. "
            f"Attempted: {attempted}"
        )

    def test_empty_org_list_runs_without_error(self) -> None:
        """When there are no organizations, the job must complete without error."""
        import app.services.scheduler as scheduler_module

        mock_db = MagicMock()
        mock_db.collection.return_value.stream.return_value = iter([])

        with patch("app.firebase_client.get_firestore_client", return_value=mock_db):
            # Should not raise
            scheduler_module._job_daily_backup()
