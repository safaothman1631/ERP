"""Tests for the trial-enforcement module (launch-readiness § R5.8)."""
from datetime import datetime, timedelta

from app.billing import trial as t


def test_compute_trial_end_default_90_days():
    signup = datetime(2026, 1, 1)
    end = t.compute_trial_end(signup_at=signup)
    assert (end - signup).days == 90


def test_days_left_positive_during_trial():
    signup = datetime(2026, 1, 1)
    end = t.compute_trial_end(signup_at=signup)
    now = signup + timedelta(days=10)
    assert t.days_left(trial_ends_at=end, now=now) == 80


def test_days_left_negative_after_expiry():
    signup = datetime(2026, 1, 1)
    end = t.compute_trial_end(signup_at=signup)
    now = signup + timedelta(days=120)
    assert t.days_left(trial_ends_at=end, now=now) < 0


def test_is_trialing_only_true_when_status_matches():
    signup = datetime(2026, 1, 1)
    end = t.compute_trial_end(signup_at=signup)
    assert t.is_trialing(
        trial_ends_at=end, billing_status="trialing", now=signup,
    ) is True
    assert t.is_trialing(
        trial_ends_at=end, billing_status="active", now=signup,
    ) is False


def test_is_expired_after_window():
    signup = datetime(2026, 1, 1)
    end = t.compute_trial_end(signup_at=signup)
    assert t.is_expired(trial_ends_at=end, now=signup + timedelta(days=91)) is True
    assert t.is_expired(trial_ends_at=end, now=signup + timedelta(days=10)) is False


def test_banner_severity_ramps_to_red_near_expiry():
    signup = datetime(2026, 1, 1)
    end = t.compute_trial_end(signup_at=signup)
    info_now = signup + timedelta(days=10)
    amber_now = signup + timedelta(days=80)
    red_now = signup + timedelta(days=88)
    assert t.banner_state(trial_ends_at=end, now=info_now)["severity"] == "info"
    assert t.banner_state(trial_ends_at=end, now=amber_now)["severity"] == "amber"
    assert t.banner_state(trial_ends_at=end, now=red_now)["severity"] == "red"


def test_banner_does_not_show_without_trial_end():
    assert t.banner_state(trial_ends_at=None) == {"show": False}


def test_banner_dismiss_re_appears_after_24h():
    now = datetime(2026, 2, 1, 12, 0, 0)
    dismissed = now - timedelta(hours=25)
    assert t.should_show_banner_after_dismiss(dismissed_at=dismissed, now=now) is True
    dismissed_recent = now - timedelta(hours=12)
    assert t.should_show_banner_after_dismiss(
        dismissed_at=dismissed_recent, now=now,
    ) is False


def test_trial_expiry_triggers_dunning_day_0():
    signup = datetime(2026, 1, 1)
    end = t.compute_trial_end(signup_at=signup)
    action = t.trial_expiry_action(
        trial_ends_at=end, billing_status="trialing",
        now=signup + timedelta(days=91),
    )
    assert action == "start_dunning_day_0"


def test_trial_expiry_action_none_when_not_yet_expired():
    signup = datetime(2026, 1, 1)
    end = t.compute_trial_end(signup_at=signup)
    action = t.trial_expiry_action(
        trial_ends_at=end, billing_status="trialing",
        now=signup + timedelta(days=30),
    )
    assert action is None
