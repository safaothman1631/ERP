"""Pool 3.3 event bus: real, idempotent outbox handlers + register_all wiring.

Mock-based — no live Firestore or FCM is hit. Each delegate (submission queue
repo, atomic adjustment, push service) is patched, mirroring the mock style in
test_outbox_bus.py.
"""
from unittest.mock import MagicMock, patch

from app.services import outbox_dispatcher as OD
from app.services import outbox_handlers as OH


def setup_function(_):
    OD.clear_handlers()


# ── register_all wiring ──────────────────────────────────────────────────────

def test_register_all_registers_three_event_types():
    OH.register_all()
    for event_type in (OH.EINVOICE_DISPATCH, OH.INVENTORY_ADJUST, OH.NOTIFICATION):
        handlers = OD._HANDLERS.get(event_type) or []
        assert len(handlers) == 1, f"{event_type} should have exactly one handler"
    assert set(OD._HANDLERS) >= {"einvoice_dispatch", "inventory_adjust", "notification"}


def test_register_all_is_idempotent():
    OH.register_all()
    OH.register_all()
    # register_handler dedupes per fn, so a second call must not duplicate.
    assert len(OD._HANDLERS[OH.INVENTORY_ADJUST]) == 1


def test_registered_handler_is_dispatched_by_handle_event():
    OH.register_all()
    # _handle_event should find + run the notification handler (guarded, no FCM).
    ran = OD._handle_event("org1", OH.NOTIFICATION, {"title": "hi", "body": "there"})
    assert ran == 1


# ── einvoice_dispatch ────────────────────────────────────────────────────────

def test_einvoice_enqueues_when_signed_xml_present():
    repo = MagicMock()
    repo.enqueue.return_value = {"id": "sub-1"}
    with patch("app.efakhata.submission_queue.SubmissionQueueRepository", return_value=repo):
        OH.handle_einvoice_dispatch("org1", {"invoice_id": "inv-1", "xml_signed": "<x/>"})
    repo.enqueue.assert_called_once()
    kwargs = repo.enqueue.call_args.kwargs
    assert kwargs["invoice_id"] == "inv-1" and kwargs["xml_signed"] == "<x/>"


def test_einvoice_logs_linkage_without_signed_xml():
    # No xml_signed -> must NOT touch the submission queue, must not raise.
    with patch("app.efakhata.submission_queue.SubmissionQueueRepository") as repo_cls:
        OH.handle_einvoice_dispatch("org1", {"invoice_id": "inv-1"})
    repo_cls.assert_not_called()


def test_einvoice_skips_when_no_target():
    OH.handle_einvoice_dispatch(None, {})  # no org / no invoice -> clean no-op


def test_einvoice_swallows_subsystem_error():
    with patch(
        "app.efakhata.submission_queue.SubmissionQueueRepository",
        side_effect=RuntimeError("firestore down"),
    ):
        # Must not raise — guarded so a missing subsystem isn't a poison event.
        OH.handle_einvoice_dispatch("org1", {"invoice_id": "i", "xml_signed": "<x/>"})


# ── inventory_adjust ─────────────────────────────────────────────────────────

def test_inventory_adjust_delegates_to_atomic_post():
    with patch(
        "app.services.inventory_adjustment_atomic.post_adjustment_atomic",
        return_value={"id": "adj-1"},
    ) as posted:
        OH.handle_inventory_adjust("org1", {"id": "adj-1", "item_id": "item-1", "quantity_adjusted": 5})
    posted.assert_called_once()
    args = posted.call_args[0]
    assert args[0] == "org1" and args[1]["item_id"] == "item-1"


def test_inventory_adjust_skips_when_no_item():
    OH.handle_inventory_adjust("org1", {})  # no item_id -> clean no-op


def test_inventory_adjust_swallows_post_error():
    with patch(
        "app.services.inventory_adjustment_atomic.post_adjustment_atomic",
        side_effect=ValueError("item_not_found"),
    ):
        OH.handle_inventory_adjust("org1", {"item_id": "item-1"})  # must not raise


# ── notification ─────────────────────────────────────────────────────────────

def test_notification_routes_to_topic():
    with patch("app.services.push_notifications.send_to_topic") as to_topic, \
         patch("app.services.push_notifications.send_to_user") as to_user, \
         patch("app.services.push_notifications.send_to_tenant") as to_tenant:
        OH.handle_notification("org1", {"topic": "tenant_org1", "title": "T", "body": "B"})
    to_topic.assert_called_once()
    to_user.assert_not_called()
    to_tenant.assert_not_called()


def test_notification_routes_to_user():
    with patch("app.services.push_notifications.send_to_user") as to_user, \
         patch("app.services.push_notifications.send_to_topic") as to_topic:
        OH.handle_notification("org1", {"user_id": "u1", "title_i18n": {"ku": "ها"}, "data": {"k": 1}})
    to_user.assert_called_once()
    to_topic.assert_not_called()
    args = to_user.call_args[0]
    assert args[0] == "org1" and args[1] == "u1"


def test_notification_defaults_to_tenant():
    with patch("app.services.push_notifications.send_to_tenant") as to_tenant:
        OH.handle_notification("org1", {"title": "hello"})
    to_tenant.assert_called_once()


def test_notification_skips_when_no_tenant():
    OH.handle_notification(None, {"title": "x"})  # no tenant -> clean no-op


def test_notification_swallows_delivery_error():
    with patch(
        "app.services.push_notifications.send_to_tenant",
        side_effect=RuntimeError("fcm not configured"),
    ):
        OH.handle_notification("org1", {"title": "x"})  # must not raise


# ── each handler runs without raising on a plain sample payload (no patches) ──

def test_all_handlers_run_without_raising_on_sample_payload():
    # Real services are reached but guarded: no Firestore/FCM in tests, so each
    # handler logs cleanly and returns. None of these may raise.
    OH.handle_einvoice_dispatch("org1", {"invoice_id": "inv-1"})
    OH.handle_inventory_adjust("org1", {"item_id": "item-1", "quantity_adjusted": 1})
    OH.handle_notification("org1", {"title": "Sample", "body": "Payload"})
