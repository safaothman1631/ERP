"""
Integration tests for the feature flag system.

Validates:
  - Flag consistency across organisations (Requirement 7.3)
  - Gradual rollout percentage functionality (Requirement 7.6)
  - Organisation-scoped flag isolation (Requirement 7.3)

The tests mock Firestore at the ``app.firebase_client.get_db`` boundary so
they run without a live Firebase project while still exercising the real
service logic (hashing, caching, evaluation rules).
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path
from typing import Any, Dict, Optional
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Make the backend package importable when running from the tests directory
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


# ===========================================================================
# Firestore in-memory stub
# ===========================================================================

class _FakeDoc:
    """Minimal Firestore document snapshot stub."""

    def __init__(self, data: Optional[Dict[str, Any]] = None):
        self._data = data
        self.id = ""
        self.exists = data is not None

    def to_dict(self) -> Optional[Dict[str, Any]]:
        return dict(self._data) if self._data else None


class _FakeCollection:
    """In-memory Firestore collection stub."""

    def __init__(self):
        self._docs: Dict[str, Dict[str, Any]] = {}

    def document(self, doc_id: str) -> "_FakeDocRef":
        return _FakeDocRef(self, doc_id)

    def stream(self):
        for doc_id, data in self._docs.items():
            snap = _FakeDoc(data)
            snap.id = doc_id
            yield snap


class _FakeDocRef:
    """In-memory Firestore document reference stub."""

    def __init__(self, collection: _FakeCollection, doc_id: str):
        self._col = collection
        self._id = doc_id

    def get(self) -> _FakeDoc:
        data = self._col._docs.get(self._id)
        snap = _FakeDoc(data)
        snap.id = self._id
        return snap

    def set(self, data: Dict[str, Any]) -> None:
        self._col._docs[self._id] = dict(data)

    def update(self, data: Dict[str, Any]) -> None:
        existing = self._col._docs.get(self._id, {})
        existing.update(data)
        self._col._docs[self._id] = existing

    def delete(self) -> None:
        self._col._docs.pop(self._id, None)


class _FakeFirestore:
    """Minimal Firestore client stub that mirrors the subcollection layout used
    by FeatureFlagService:  feature_flags/{org_id}/flags/{flag_key}
    """

    def __init__(self):
        # top-level collection → org doc → "flags" subcollection
        self._orgs: Dict[str, _FakeCollection] = {}

    def collection(self, name: str) -> "_FakeTopCollection":
        return _FakeTopCollection(self, name)


class _FakeTopCollection:
    def __init__(self, db: _FakeFirestore, name: str):
        self._db = db
        self._name = name

    def document(self, org_id: str) -> "_FakeOrgDocRef":
        return _FakeOrgDocRef(self._db, org_id)


class _FakeOrgDocRef:
    def __init__(self, db: _FakeFirestore, org_id: str):
        self._db = db
        self._org_id = org_id

    def collection(self, sub_name: str) -> _FakeCollection:
        key = f"{self._org_id}::{sub_name}"
        if key not in self._db._orgs:
            self._db._orgs[key] = _FakeCollection()
        return self._db._orgs[key]


# ===========================================================================
# Fixtures
# ===========================================================================

@pytest.fixture(autouse=True)
def fake_db():
    """Replace get_db() with an in-memory Firestore stub for every test.

    The patch targets the name as it is bound inside feature_flag_service
    (``from app.firebase_client import get_db``), so we must patch the
    reference in that module's namespace rather than the source module.
    """
    db = _FakeFirestore()
    with patch("app.services.feature_flag_service.get_db", return_value=db):
        # Clear the in-process cache before each test so state doesn't leak
        import app.services.feature_flag_service as svc
        svc.invalidate_all()
        yield db
        svc.invalidate_all()


# Convenience import after patching is set up
@pytest.fixture()
def svc():
    import app.services.feature_flag_service as _svc
    return _svc


# ===========================================================================
# 1. Organisation-scoped flag isolation
# ===========================================================================

class TestOrgScopedFlagIsolation:
    """
    Requirement 7.3: When a feature flag is queried, the system SHALL return
    the flag value for the current user's organisation.

    Flags created for org A must not be visible to org B, and vice-versa.
    """

    def test_flag_created_for_org_a_not_visible_to_org_b(self, svc):
        """A flag set on org-A must not exist when queried for org-B."""
        svc.set_flag("org-a", "beta_feature", enabled=True)

        assert svc.get_flag("org-b", "beta_feature") is None

    def test_flag_created_for_org_b_not_visible_to_org_a(self, svc):
        """A flag set on org-B must not exist when queried for org-A."""
        svc.set_flag("org-b", "dark_mode", enabled=True)

        assert svc.get_flag("org-a", "dark_mode") is None

    def test_is_enabled_returns_false_for_wrong_org(self, svc):
        """is_enabled() must return False when the flag belongs to a different org."""
        svc.set_flag("org-a", "new_dashboard", enabled=True, rollout_pct=100)

        assert svc.is_enabled("org-b", "new_dashboard", user_id="user-1") is False

    def test_same_flag_key_independent_per_org(self, svc):
        """The same flag key can have different values in different orgs."""
        svc.set_flag("org-a", "feature_x", enabled=True, rollout_pct=100)
        svc.set_flag("org-b", "feature_x", enabled=False)

        assert svc.is_enabled("org-a", "feature_x", user_id="user-1") is True
        assert svc.is_enabled("org-b", "feature_x", user_id="user-1") is False

    def test_list_flags_returns_only_org_flags(self, svc):
        """list_flags() must return only the flags belonging to the requested org."""
        svc.set_flag("org-a", "flag_alpha", enabled=True)
        svc.set_flag("org-a", "flag_beta", enabled=False)
        svc.set_flag("org-b", "flag_gamma", enabled=True)

        org_a_flags = svc.list_flags("org-a")
        org_b_flags = svc.list_flags("org-b")

        org_a_keys = {f["key"] for f in org_a_flags}
        org_b_keys = {f["key"] for f in org_b_flags}

        assert org_a_keys == {"flag_alpha", "flag_beta"}
        assert org_b_keys == {"flag_gamma"}

    def test_delete_flag_in_org_a_does_not_affect_org_b(self, svc):
        """Deleting a flag in org-A must leave the same-named flag in org-B intact."""
        svc.set_flag("org-a", "shared_key", enabled=True)
        svc.set_flag("org-b", "shared_key", enabled=True)

        svc.delete_flag("org-a", "shared_key")

        assert svc.get_flag("org-a", "shared_key") is None
        assert svc.get_flag("org-b", "shared_key") is not None
        assert svc.is_enabled("org-b", "shared_key", user_id="user-1") is True

    def test_multiple_orgs_independent_flag_counts(self, svc):
        """Each org maintains its own independent set of flags."""
        for i in range(3):
            svc.set_flag("org-a", f"flag_{i}", enabled=True)
        svc.set_flag("org-b", "only_flag", enabled=True)

        assert len(svc.list_flags("org-a")) == 3
        assert len(svc.list_flags("org-b")) == 1


# ===========================================================================
# 2. Flag consistency across organisations
# ===========================================================================

class TestFlagConsistencyAcrossOrgs:
    """
    Requirement 7.3: Flags are organisation-scoped; changes in one org must
    never bleed into another org's evaluation results.
    """

    def test_enabling_flag_in_org_a_does_not_enable_in_org_b(self, svc):
        """Enabling a flag for org-A must not affect org-B's evaluation."""
        # Both orgs start with the flag disabled
        svc.set_flag("org-a", "rollout_v2", enabled=False)
        svc.set_flag("org-b", "rollout_v2", enabled=False)

        # Enable only for org-A
        svc.set_flag("org-a", "rollout_v2", enabled=True, rollout_pct=100)

        assert svc.is_enabled("org-a", "rollout_v2", user_id="user-1") is True
        assert svc.is_enabled("org-b", "rollout_v2", user_id="user-1") is False

    def test_updating_rollout_pct_in_org_a_does_not_change_org_b(self, svc):
        """Changing rollout_pct for org-A must not alter org-B's rollout_pct."""
        svc.set_flag("org-a", "gradual", enabled=True, rollout_pct=50)
        svc.set_flag("org-b", "gradual", enabled=True, rollout_pct=50)

        # Update only org-A to 100%
        svc.set_flag("org-a", "gradual", enabled=True, rollout_pct=100)

        org_a_flag = svc.get_flag("org-a", "gradual")
        org_b_flag = svc.get_flag("org-b", "gradual")

        assert org_a_flag["rollout_pct"] == 100
        assert org_b_flag["rollout_pct"] == 50

    def test_flag_evaluation_is_deterministic_per_org_user(self, svc):
        """The same (org, flag, user) triple must always produce the same result."""
        svc.set_flag("org-a", "stable_flag", enabled=True, rollout_pct=50)

        results = [
            svc.is_enabled("org-a", "stable_flag", user_id="user-42")
            for _ in range(10)
        ]

        # All 10 evaluations must agree
        assert len(set(results)) == 1, "is_enabled() must be deterministic"

    def test_nonexistent_flag_returns_false_for_all_orgs(self, svc):
        """A flag that was never created must evaluate to False for any org."""
        assert svc.is_enabled("org-a", "ghost_flag", user_id="user-1") is False
        assert svc.is_enabled("org-b", "ghost_flag", user_id="user-1") is False
        assert svc.is_enabled("org-c", "ghost_flag", user_id="user-1") is False

    def test_cache_invalidation_does_not_cross_org_boundary(self, svc):
        """Invalidating org-A's cache must not affect org-B's cached values."""
        svc.set_flag("org-a", "cached_flag", enabled=True, rollout_pct=100)
        svc.set_flag("org-b", "cached_flag", enabled=True, rollout_pct=100)

        # Warm the cache for both orgs
        assert svc.is_enabled("org-a", "cached_flag", user_id="u1") is True
        assert svc.is_enabled("org-b", "cached_flag", user_id="u1") is True

        # Invalidate only org-A
        svc._invalidate("org-a", "cached_flag")

        # org-B must still evaluate correctly (from cache or fresh read)
        assert svc.is_enabled("org-b", "cached_flag", user_id="u1") is True


# ===========================================================================
# 3. Gradual rollout percentage functionality
# ===========================================================================

class TestGradualRolloutPercentage:
    """
    Requirement 7.6: The system SHALL support gradual rollout by percentage.

    Key invariants:
      - 0%  → always disabled (for any user)
      - 100% → always enabled (for any user)
      - Intermediate % → deterministic, stable per-user bucketing via SHA-256
    """

    def test_zero_percent_rollout_always_disabled(self, svc):
        """A flag with rollout_pct=0 must be disabled for every user."""
        svc.set_flag("org-x", "zero_pct", enabled=True, rollout_pct=0)

        users = [f"user-{i}" for i in range(50)]
        results = [svc.is_enabled("org-x", "zero_pct", user_id=u) for u in users]

        assert all(r is False for r in results), (
            "rollout_pct=0 must disable the flag for all users"
        )

    def test_hundred_percent_rollout_always_enabled(self, svc):
        """A flag with rollout_pct=100 must be enabled for every user."""
        svc.set_flag("org-x", "full_pct", enabled=True, rollout_pct=100)

        users = [f"user-{i}" for i in range(50)]
        results = [svc.is_enabled("org-x", "full_pct", user_id=u) for u in users]

        assert all(r is True for r in results), (
            "rollout_pct=100 must enable the flag for all users"
        )

    def test_disabled_master_switch_overrides_rollout_pct(self, svc):
        """enabled=False must disable the flag regardless of rollout_pct."""
        svc.set_flag("org-x", "master_off", enabled=False, rollout_pct=100)

        users = [f"user-{i}" for i in range(20)]
        results = [svc.is_enabled("org-x", "master_off", user_id=u) for u in users]

        assert all(r is False for r in results), (
            "enabled=False must override rollout_pct=100"
        )

    def test_fifty_percent_rollout_approximately_half_users_enabled(self, svc):
        """A 50% rollout should enable the flag for roughly half of a large user set."""
        svc.set_flag("org-x", "half_rollout", enabled=True, rollout_pct=50)

        # Use 200 users to get a stable statistical estimate
        users = [f"user-{i}" for i in range(200)]
        enabled_count = sum(
            1 for u in users if svc.is_enabled("org-x", "half_rollout", user_id=u)
        )
        ratio = enabled_count / len(users)

        # Allow ±15% tolerance around 50%
        assert 0.35 <= ratio <= 0.65, (
            f"Expected ~50% of users enabled for 50% rollout, got {ratio:.1%}"
        )

    def test_rollout_bucketing_is_deterministic(self, svc):
        """The same user must always land in the same bucket across multiple calls."""
        svc.set_flag("org-x", "det_flag", enabled=True, rollout_pct=50)

        user_id = "stable-user-abc"
        first_result = svc.is_enabled("org-x", "det_flag", user_id=user_id)

        for _ in range(20):
            assert svc.is_enabled("org-x", "det_flag", user_id=user_id) == first_result, (
                "Bucket assignment must be stable across repeated calls"
            )

    def test_rollout_bucket_matches_sha256_formula(self, svc):
        """Bucket assignment must match the documented SHA-256 formula."""
        svc.set_flag("org-x", "hash_check", enabled=True, rollout_pct=50)

        org_id = "org-x"
        flag_key = "hash_check"

        for user_id in ["alice", "bob", "charlie", "dave", "eve"]:
            raw = f"{org_id}:{flag_key}:{user_id}".encode()
            expected_bucket = int(hashlib.sha256(raw).hexdigest(), 16) % 100
            expected_enabled = expected_bucket < 50

            actual = svc.is_enabled(org_id, flag_key, user_id=user_id)
            assert actual == expected_enabled, (
                f"User {user_id!r}: expected bucket={expected_bucket}, "
                f"enabled={expected_enabled}, got {actual}"
            )

    def test_different_users_can_have_different_rollout_results(self, svc):
        """With a 50% rollout, not all users should get the same result."""
        svc.set_flag("org-x", "mixed_rollout", enabled=True, rollout_pct=50)

        users = [f"user-{i}" for i in range(100)]
        results = {svc.is_enabled("org-x", "mixed_rollout", user_id=u) for u in users}

        # With 100 users and 50% rollout, we expect both True and False
        assert True in results and False in results, (
            "A 50% rollout should produce both enabled and disabled users"
        )

    def test_rollout_pct_ten_percent_enables_roughly_ten_percent(self, svc):
        """A 10% rollout should enable the flag for roughly 10% of users."""
        svc.set_flag("org-x", "ten_pct", enabled=True, rollout_pct=10)

        users = [f"user-{i}" for i in range(300)]
        enabled_count = sum(
            1 for u in users if svc.is_enabled("org-x", "ten_pct", user_id=u)
        )
        ratio = enabled_count / len(users)

        # Allow ±10% tolerance around 10%
        assert 0.0 <= ratio <= 0.20, (
            f"Expected ~10% of users enabled for 10% rollout, got {ratio:.1%}"
        )

    def test_rollout_pct_ninety_percent_enables_roughly_ninety_percent(self, svc):
        """A 90% rollout should enable the flag for roughly 90% of users."""
        svc.set_flag("org-x", "ninety_pct", enabled=True, rollout_pct=90)

        users = [f"user-{i}" for i in range(300)]
        enabled_count = sum(
            1 for u in users if svc.is_enabled("org-x", "ninety_pct", user_id=u)
        )
        ratio = enabled_count / len(users)

        # Allow ±10% tolerance around 90%
        assert 0.80 <= ratio <= 1.0, (
            f"Expected ~90% of users enabled for 90% rollout, got {ratio:.1%}"
        )

    def test_no_user_id_treated_as_enabled_when_pct_above_zero(self, svc):
        """When user_id is empty and rollout_pct > 0, the flag should be enabled."""
        svc.set_flag("org-x", "anon_flag", enabled=True, rollout_pct=50)

        # Empty user_id → service treats as enabled (bucket 0 < pct)
        assert svc.is_enabled("org-x", "anon_flag", user_id="") is True

    def test_no_user_id_disabled_when_pct_is_zero(self, svc):
        """When user_id is empty and rollout_pct == 0, the flag must be disabled."""
        svc.set_flag("org-x", "anon_zero", enabled=True, rollout_pct=0)

        assert svc.is_enabled("org-x", "anon_zero", user_id="") is False

    def test_invalid_rollout_pct_raises_value_error(self, svc):
        """set_flag() must raise ValueError for rollout_pct outside 0-100."""
        with pytest.raises(ValueError, match="rollout_pct must be 0-100"):
            svc.set_flag("org-x", "bad_pct", enabled=True, rollout_pct=101)

        with pytest.raises(ValueError, match="rollout_pct must be 0-100"):
            svc.set_flag("org-x", "bad_pct", enabled=True, rollout_pct=-1)
