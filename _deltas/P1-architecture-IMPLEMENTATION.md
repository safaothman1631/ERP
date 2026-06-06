# P1 Architecture Upgrades — APPLY-READY Implementation Guide

> **Status:** Reviewed, **NOT applied.** This is a principal-architect design grounded in the
> *real* code as it exists on `2026-06-03`. Every recommendation cites actual files / functions
> and says **what exists vs what is missing**. Nothing here has been committed; it requires the
> full `pytest` suite on Windows before any of it lands (see §6).
>
> **Scope:** backend only (`backend/app/**`). FastAPI + Firestore, ~86k LOC.
> **Author intent:** make the platform event-driven, saga-safe, update-safe (Clean Core),
> gateway-fronted, and give it a real no-code workflow engine — without a big-bang rewrite.

---

## 0. ئەوەی ئێستا هەیە بەرامبەر ئەوەی نییە (Ground truth — what exists vs what is missing)

I read the code. Here is the honest baseline.

### 0.1 Outbox — exists as a shell, not durable, not transactional

`backend/app/firestore/outbox.py` is **20 lines**:

```python
class OutboxEventRepository(BaseRepository):
    collection_name = "outbox_events"

    def enqueue(self, event_type: str, payload: dict) -> dict:
        return self.create({
            "event_type": event_type,
            "payload": payload,
            "status": "pending",
            "attempts": 0,
            "next_retry_at": datetime.utcnow(),
        })
```

- It calls `BaseRepository.create()` — a **standalone `.set()`** (`base.py:398`). It is **NOT** written
  in the same transaction as any domain write.
- `backend/app/services/outbox_dispatcher.py::dispatch_pending()` polls `outbox_events where status==pending`,
  but `_handle_event()` (line 46) only knows **one** event type, `"einvoice_dispatch"`, and that is a
  **`logger.info` stub**. Every other event hits `outbox_no_handler`. So the outbox is wired to the
  scheduler (`scheduler.py:149` job `outbox_dispatch`, every 1 min) but does effectively nothing.
- **Nobody calls `OutboxEventRepository.enqueue()`** from a domain handler. A repo-wide grep for
  `enqueue`/`OutboxEvent` finds only the einvoice path.

### 0.2 Webhooks — a *second*, parallel, fire-and-forget path

`backend/app/services/webhook_dispatcher.py`:

- `dispatch_event(org_id, event, body)` (line 120) spawns a **daemon `threading.Thread`** and returns
  immediately. Delivery happens in `_deliver()` with in-thread retries (`time.sleep(2**attempt)`).
- It *also* writes a `webhook_inbox` doc (`_enqueue_inbox`, line 60) with `status:"pending"` and a 7-day
  TTL — **but nothing ever drains `webhook_inbox`.** There is no dispatcher for it. It is dead storage.
- Callers wrap it in `try/except: pass`. Example — `backend/app/api/invoices.py:176`:

```python
# Webhook: invoice.created
try:
    from app.services.webhook_dispatcher import dispatch_event
    dispatch_event(user["org_id"], "invoice.created", {"id": invoice["id"]})
except Exception:
    pass

try:
    from app.services.automation_runner import fire_automated_actions
    fire_automated_actions(user["org_id"], "invoice", "on_create", invoice)
except Exception:
    pass
```

**Failure modes that exist today:**
1. Process dies between the Firestore write (`repo.create`, line 150) and the thread starting → event lost forever (no durability).
2. The daemon thread on Cloud Run can be killed by CPU throttling between requests → delivery silently dropped.
3. Two parallel notification systems (`webhook_inbox` + `outbox_events`) that don't talk to each other.
4. No internal consumer: modules can only react by editing the producer's handler and adding another inline call.

### 0.3 No internal domain-event bus

There is **no** `app/events/` package, no `app/services/events.py`, no pub/sub abstraction. Modules
react to each other by **direct import + call at the call-site** (`invoices.py` imports
`automation_runner` and `webhook_dispatcher`). This is the coupling we remove.

### 0.4 Multi-aggregate flows are sequential, non-atomic, no compensation

`backend/app/api/sales_orders.py:142` `sales_order_to_invoice()` does, in order, with **no transaction
and no rollback**:

```python
SALES_ORDER_SM.transition(so, "invoiced")          # 1. mutate SO state (in memory)
inv = inv_repo.create({... "status": "draft" ...})  # 2. write Invoice
inv_repo.set_lines(inv["id"], [...])                 # 3. write Invoice lines (separate batch.commit)
repo.update(sales_order_id, {... "invoice_id": ...}) # 4. write SO back
```

If step 3 or 4 throws, you have a half-built invoice and an SO that may or may not be flipped. This is
the canonical **saga** target (§2).

### 0.5 Idempotency — real and good (reuse it)

`backend/app/services/idempotency.py` (`IdempotencyService`, Firestore-TTL on `expires_at`) +
`backend/app/middleware/idempotency_http.py` (`idempotency_middleware`, prefix-gated `_IDEMPOTENCY_PREFIXES`,
`Idempotency-Key` header → cached response). This is solid and we lean on it for the gateway (§4) and the
event consumer (§1).

### 0.6 Repo base pattern (the seam we extend)

`backend/app/firestore/base.py::BaseRepository`:
- `__init__(org_id)` → `self.db = get_db()`, `self.collection = self.db.collection(...)`.
- `create()`/`update()` do standalone `.set()`/`.update()`.
- **Transactions already exist** in `update_versioned()` (line 421): uses `@fs.transactional` +
  `self.db.transaction()`. So the Firestore transaction API is available and proven in this codebase —
  we mirror that exact pattern for the transactional outbox.
- `get_db()` (`firebase_client.py:90`) returns a `google.cloud.firestore.Client`; `client.transaction()`
  and `@fs.transactional` are the primitives.

### 0.7 Extensibility — present but disjoint

- `backend/app/api/custom_fields.py` — `CustomFieldDefinitionRepository` (`custom_field_definitions`) +
  `CustomFieldValueRepository` (values keyed by `entity_type/entity_id/field_id`). Definitions are NOT
  validated against core writes; values live in a side collection.
- `backend/app/api/studio.py` — 7 repos (`studio_models/fields/views/workflows/reports/menus/records`),
  CRUD only. `studio_workflows` has a schema (`WorkflowCreate`: `trigger`, `conditions`, `actions`) but
  **no executor**.
- `backend/app/api/automation.py` — `automated_actions`, `scheduled_jobs`, `server_actions`,
  `automation_workflows` (visual graph: `nodes`, `edges`, `trigger`), `automation_runs`. The only
  execution is `automation_runner.py::fire_automated_actions()` (simple `amount/total` condition regex +
  4 action types) and `POST /workflows/{wid}/test-run` which is a **pure simulator** (`trace`, no side
  effects — `automation.py:313`). **There is no engine that runs `automation_workflows` graphs on real
  events.** That is §5.

### 0.8 API surface / versioning

`backend/app/api/v1/router.py` exposes **9** resources under `/api/v1`: contacts, invoices, items,
accounts, journals, bills, purchase_orders, sales_orders, payments. The legacy unversioned routers
(`/api/...`) are the bulk (`main.py:331-486`, ~100 routers). OpenAPI is served at `/api/openapi.json`,
docs `/api/docs`. RFC 7807 handlers registered (`register_error_handlers`, `main.py:231`). No external
gateway — clients hit Cloud Run directly (`zoho-erp-backend`, per CLAUDE.md).

### 0.9 Config + scheduler seams

- Feature flags live as typed fields on `Settings` (`config.py:127-141`, e.g. `IDEMPOTENCY_ENABLED`,
  `GL_MATERIALISATION_ENABLED`). Access via `from app.config import settings` or `get_settings()`.
- `backend/app/services/scheduler.py::start_scheduler()` — APScheduler `AsyncIOScheduler`, **20 jobs**,
  registered with `_scheduler.add_job(...)`. New background workers attach here.

---

## 1. تڕانزاکشناڵ ئاوتباکس + ئیڤێنت باس (Transactional outbox + internal event bus)

**Goal:** the event row is written in the **same Firestore transaction** as the domain write
(at-least-once, never-lost), an **out-of-process dispatcher** delivers it (Cloud Run Job + Pub/Sub, with
the existing APScheduler poller as fallback), and an **internal event bus** lets modules subscribe to
domain events instead of being called inline.

### 1.1 Canonical event envelope + topic naming

Create **`backend/app/events/__init__.py`**:

```python
"""Canonical domain-event envelope + topic registry (P1)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any


# ── Topic naming: "<aggregate>.<past-tense-fact>" — lowercase, dot-separated ──
# Producers emit FACTS, not commands. Past tense. One topic per business fact.
class Topics:
    INVOICE_CREATED = "invoice.created"
    INVOICE_POSTED = "invoice.posted"          # GL committed
    INVOICE_PAID = "invoice.paid"
    INVOICE_VOIDED = "invoice.voided"
    BILL_CREATED = "bill.created"
    BILL_POSTED = "bill.posted"
    PAYMENT_CAPTURED = "payment.captured"
    PAYMENT_REFUNDED = "payment.refunded"
    STOCK_MOVED = "stock.moved"                # any inventory delta
    STOCK_LOW = "stock.low"
    SALES_ORDER_CONFIRMED = "sales_order.confirmed"
    SALES_ORDER_INVOICED = "sales_order.invoiced"
    PURCHASE_ORDER_RECEIVED = "purchase_order.received"
    POS_SALE_COMPLETED = "pos.sale_completed"
    CONTACT_CREATED = "contact.created"
    SUBSCRIPTION_RENEWED = "subscription.renewed"

    @classmethod
    def all(cls) -> list[str]:
        return [v for k, v in vars(cls).items() if k.isupper() and isinstance(v, str)]


_SCHEMA_VERSION = 1


@dataclass
class DomainEvent:
    """Immutable fact. `id` is the dedup key for at-least-once consumers."""
    topic: str
    org_id: str
    payload: dict[str, Any]
    aggregate_type: str = ""           # "invoice", "payment", ...
    aggregate_id: str = ""
    actor_id: str | None = None        # user who caused it (audit)
    correlation_id: str | None = None  # ties a saga / request together
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    occurred_at: datetime = field(default_factory=datetime.utcnow)
    schema_version: int = _SCHEMA_VERSION

    def to_doc(self) -> dict[str, Any]:
        d = asdict(self)
        d["status"] = "pending"
        d["attempts"] = 0
        d["next_retry_at"] = self.occurred_at
        return d

    @staticmethod
    def topic_of(doc: dict) -> str:
        return doc.get("topic") or doc.get("event_type") or ""
```

**Why a dataclass, not Pydantic:** the producer path runs inside a hot Firestore transaction; a plain
dataclass keeps it allocation-cheap and dependency-free. Consumers validate as needed.

> **Backward-compat note:** the existing `outbox_events` rows use `event_type`, not `topic`.
> `DomainEvent.topic_of()` reads either, and `OutboxEventRepository.enqueue()` (old) still works. New
> code uses `topic`; the dispatcher handles both.

### 1.2 Transactional enqueue helper

Extend **`backend/app/firestore/outbox.py`** (keep the old `enqueue` for the einvoice path; add the
transactional one):

```python
"""Outbox events for exactly-once side effects (Wave I) + transactional outbox (P1)."""
from __future__ import annotations

from datetime import datetime

from google.cloud import firestore as fs

from .base import BaseRepository


class OutboxEventRepository(BaseRepository):
    collection_name = "outbox_events"

    # ── Legacy (kept; einvoice path depends on it) ──
    def enqueue(self, event_type: str, payload: dict) -> dict:
        return self.create({
            "event_type": event_type,
            "payload": payload,
            "status": "pending",
            "attempts": 0,
            "next_retry_at": datetime.utcnow(),
        })

    # ── P1: write an event INSIDE a caller-supplied transaction ──
    def stage_in_txn(self, transaction: fs.Transaction, event) -> str:
        """Write a DomainEvent doc as part of `transaction`.

        MUST be called from within an @fs.transactional function, AFTER all
        reads and ideally as the last write, so the event commits atomically
        with the domain mutation. Returns the event id.
        """
        doc = event.to_doc()
        doc["org_id"] = event.org_id           # outbox is org-scoped for the poller
        ref = self.collection.document(event.id)
        transaction.set(ref, doc)
        return event.id
```

### 1.3 The internal event bus (in-process subscribers)

Create **`backend/app/events/bus.py`**:

```python
"""In-process domain-event bus (P1).

Two delivery moments:
  • SYNC subscribers run in the dispatcher when an outbox row is delivered
    (out-of-process, at-least-once, retried). This is where module reactions live.
  • There is intentionally NO inline sync delivery at produce-time — producers only
    stage the event in the DB transaction. Decoupling is the whole point.

Subscribers register a handler per topic. Handlers MUST be idempotent (they may be
re-run on retry). Handler signature: handler(event: DomainEvent) -> None.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Callable

from app.events import DomainEvent

logger = logging.getLogger("event_bus")

_SUBSCRIBERS: dict[str, list[Callable[[DomainEvent], None]]] = defaultdict(list)


def subscribe(topic: str, handler: Callable[[DomainEvent], None]) -> None:
    _SUBSCRIBERS[topic].append(handler)


def on(topic: str):
    """Decorator form: @on(Topics.INVOICE_POSTED)"""
    def _wrap(fn):
        subscribe(topic, fn)
        return fn
    return _wrap


def deliver(event: DomainEvent) -> dict:
    """Run every subscriber for event.topic. Used by the dispatcher.

    Returns {"ran": n, "errors": [...]}. Raising is the caller's choice: the
    dispatcher treats a non-empty errors list as a retry trigger.
    """
    handlers = list(_SUBSCRIBERS.get(event.topic, []))
    # wildcard subscribers (e.g. audit firehose, external webhook fan-out)
    handlers += list(_SUBSCRIBERS.get("*", []))
    ran, errors = 0, []
    for h in handlers:
        try:
            h(event)
            ran += 1
        except Exception as exc:  # noqa: BLE001
            logger.exception("event handler failed topic=%s handler=%s", event.topic, h.__name__)
            errors.append({"handler": getattr(h, "__name__", str(h)), "error": str(exc)[:300]})
    return {"ran": ran, "errors": errors}
```

Create **`backend/app/events/subscribers.py`** — this is where the old inline calls move. The webhook
fan-out and automation engine become subscribers, not call-site imports:

```python
"""Wire core reactions to domain events (P1). Imported once at startup."""
from __future__ import annotations

import logging

from app.events import DomainEvent, Topics
from app.events.bus import on

logger = logging.getLogger("event_subscribers")


# ── External webhook fan-out: ONE wildcard subscriber replaces N inline calls ──
@on("*")
def _fan_out_to_tenant_webhooks(event: DomainEvent) -> None:
    """Deliver every domain event to tenant-configured webhook endpoints.

    Reuses the existing synchronous delivery in webhook_dispatcher, but now it
    runs in the dispatcher (out-of-process, retried) — NOT a fire-and-forget
    daemon thread at request time.
    """
    from app.services.webhook_dispatcher import _deliver  # sync, retried by us
    _deliver(event.org_id, event.topic, {"id": event.aggregate_id, **event.payload})


# ── Automation engine: replaces inline fire_automated_actions() ──
@on("*")
def _run_automations(event: DomainEvent) -> None:
    from app.services.automation_runner import fire_automated_actions
    # map "invoice.created" -> entity_type="invoice", trigger="on_create"
    aggregate, _, fact = event.topic.partition(".")
    trigger = {"created": "on_create", "updated": "on_update",
               "posted": "on_update", "paid": "on_update",
               "voided": "on_delete"}.get(fact, f"on_{fact}")
    fire_automated_actions(event.org_id, aggregate, trigger, {"id": event.aggregate_id, **event.payload})


# ── Workflow engine (§5) ──
@on("*")
def _run_workflows(event: DomainEvent) -> None:
    from app.services.workflow_engine import run_workflows_for_event
    run_workflows_for_event(event)


def register_all() -> None:
    """No-op body; importing this module runs the @on registrations.

    Called from main.py startup. Kept as an explicit function so the import is
    intentional and testable.
    """
    logger.info("event subscribers registered")
```

### 1.4 Producer: emit in the same transaction as the domain write

Add a **transactional create-with-event** helper to `BaseRepository`. Insert in
`backend/app/firestore/base.py` right after `update_versioned()` (after line 450):

```python
    def create_with_event(self, data: dict, event) -> dict:
        """Create a domain doc AND stage a DomainEvent atomically (P1).

        Mirrors `update_versioned`'s transaction pattern. The domain doc and the
        outbox row commit together: either both land or neither does.
        """
        import uuid as _uuid
        from app.firestore.outbox import OutboxEventRepository

        doc_id = data.pop("id", str(_uuid.uuid4()))
        self._reject_client_org_id(data)
        data.pop("org_id", None)
        if self.WRITE_MODEL is not None:
            data = self._validate_payload(data)
        data["org_id"] = self.org_id
        data.setdefault("is_active", True)
        now = datetime.utcnow()
        data["created_at"] = now
        data["updated_at"] = now
        data.setdefault("_version", 1)
        data.setdefault("schema_version", self.SCHEMA_TARGET_VERSION)
        from app.services.ttl_fields import attach_ttl_fields
        data = attach_ttl_fields(self.collection_name, data)
        self._check_doc_size(self.collection_name, data)

        doc_ref = self.collection.document(doc_id)
        outbox = OutboxEventRepository(self.org_id)
        event.aggregate_id = event.aggregate_id or doc_id

        @fs.transactional
        def _tx(transaction: fs.Transaction) -> None:
            transaction.set(doc_ref, data)
            outbox.stage_in_txn(transaction, event)   # same commit

        _tx(self.db.transaction())
        result = {"id": doc_id, **data}
        result["is_deleted"] = result.get("deleted_at") is not None
        return result
```

> **Firestore caveat (call out honestly):** the line-items are written via
> `BaseRepository.set_lines()` → a **separate `batch.commit()`** (`base.py:493`). Firestore
> transactions and batches are different objects; you cannot mix a 500-write batch into the same
> transaction trivially. **Decision:** the *header* + the *event* commit atomically; the lines are a
> child write. The event payload therefore carries only the **header id** (the consumer re-reads lines).
> This matches today's behaviour where `dispatch_event(..., {"id": invoice["id"]})` already only sends
> the id (`invoices.py:179`). Document this as an explicit invariant: **events reference, never embed,
> child collections.**

**Refactor the invoice create** — `backend/app/api/invoices.py`. Replace lines **150-189** (the
`repo.create({...})` + `set_lines` + two `try/except` dispatch blocks) with:

```python
    from app.events import DomainEvent, Topics
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.create_with_event(
        {
            "id": str(uuid.uuid4()),
            "contact_id": data.contact_id,
            "invoice_number": invoice_number,
            # ... unchanged fields ...
            "status": "draft",
        },
        DomainEvent(
            topic=Topics.INVOICE_CREATED,
            org_id=user["org_id"],
            aggregate_type="invoice",
            payload={"invoice_number": invoice_number, "total": total},
            actor_id=user.get("id"),
        ),
    )
    repo.set_lines(invoice["id"], lines)   # child write, unchanged
    return invoice
```

The inline `dispatch_event` and `fire_automated_actions` blocks are **deleted** — those reactions now run
in the dispatcher via the bus subscribers (§1.3). Apply the same pattern to the `invoice.paid` site
(`invoices.py:494-501`) and progressively to bills/payments/SO/PO.

### 1.5 Out-of-process dispatcher (Cloud Run Job + Pub/Sub, APScheduler fallback)

Rewrite **`backend/app/services/outbox_dispatcher.py`** to deliver to the bus and (optionally) publish to
Pub/Sub, with claim/lease semantics so two dispatchers don't double-fire:

```python
"""Dispatch durable outbox events (P1). Delivers to the internal bus + Pub/Sub."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta

from google.cloud import firestore as fs

logger = logging.getLogger(__name__)

_MAX_ATTEMPTS = 8
_BACKOFF_MIN = [1, 2, 5, 15, 30, 60, 120, 360]  # minutes, per attempt
_PUBSUB_TOPIC = os.getenv("OUTBOX_PUBSUB_TOPIC", "")  # empty → bus-only


def _publish_pubsub(event_doc: dict) -> None:
    if not _PUBSUB_TOPIC:
        return
    import json
    from google.cloud import pubsub_v1
    publisher = pubsub_v1.PublisherClient()
    publisher.publish(
        _PUBSUB_TOPIC,
        json.dumps(event_doc, default=str).encode("utf-8"),
        topic=event_doc.get("topic", ""),
        org_id=event_doc.get("org_id", ""),
        event_id=event_doc.get("id", ""),   # subscriber dedup key
    ).result(timeout=10)


def dispatch_pending(org_id: str | None = None, max_events: int = 100) -> int:
    from app.events import DomainEvent
    from app.events.bus import deliver
    from app.firebase_client import get_db

    db = get_db()
    now = datetime.utcnow()
    q = db.collection("outbox_events").where("status", "==", "pending").limit(max_events)
    if org_id:
        q = q.where("org_id", "==", org_id)

    dispatched = 0
    for snap in q.stream():
        data = snap.to_dict() or {}
        nra = data.get("next_retry_at")
        if isinstance(nra, datetime) and nra > now:
            continue

        # ── Lease: atomically flip pending -> processing so peers skip it ──
        ref = snap.reference

        @fs.transactional
        def _claim(transaction: fs.Transaction) -> bool:
            cur = ref.get(transaction=transaction).to_dict() or {}
            if cur.get("status") != "pending":
                return False
            transaction.update(ref, {"status": "processing", "leased_at": now})
            return True

        if not _claim(db.transaction()):
            continue

        topic = DomainEvent.topic_of(data)
        event = DomainEvent(
            topic=topic,
            org_id=data.get("org_id", ""),
            payload=data.get("payload") or {},
            aggregate_type=data.get("aggregate_type", ""),
            aggregate_id=data.get("aggregate_id", ""),
            actor_id=data.get("actor_id"),
            correlation_id=data.get("correlation_id"),
            id=data.get("id", snap.id),
        )
        try:
            result = deliver(event)            # in-process subscribers
            _publish_pubsub(data)              # optional external bus
            if result["errors"]:
                raise RuntimeError(f"{len(result['errors'])} handler error(s)")
            ref.update({"status": "delivered", "delivered_at": now, "updated_at": now})
            dispatched += 1
        except Exception as exc:  # noqa: BLE001
            attempts = int(data.get("attempts") or 0) + 1
            backoff = _BACKOFF_MIN[min(attempts - 1, len(_BACKOFF_MIN) - 1)]
            ref.update({
                "status": "pending" if attempts < _MAX_ATTEMPTS else "dead",
                "attempts": attempts,
                "last_error": str(exc)[:500],
                "next_retry_at": now + timedelta(minutes=backoff),
                "updated_at": now,
            })
            logger.warning("outbox_dispatch_failed topic=%s attempts=%s err=%s", topic, attempts, exc)
    return dispatched
```

The APScheduler job that already exists (`scheduler.py:149-155`, `_job_outbox_dispatch` → `dispatch_pending`)
keeps working unchanged — it becomes the **fallback / single-instance** driver. For scale, add a
**Cloud Run Job** that calls the same function in a loop and a **Pub/Sub push subscription** for the
external bus. Sketch — `backend/jobs/outbox_worker.py`:

```python
"""Cloud Run Job entrypoint: drain the outbox continuously (P1)."""
import time
from app.firebase_client import init_firebase
from app.events.subscribers import register_all
from app.services.outbox_dispatcher import dispatch_pending

if __name__ == "__main__":
    init_firebase()
    register_all()
    while True:
        n = dispatch_pending(max_events=200)
        if n == 0:
            time.sleep(2)   # idle backoff; Cloud Run keeps the job warm
```

**Indexes** — add to `firestore.indexes.json` (the codebase already manages composite indexes there per
CLAUDE.md):

```json
{ "collectionGroup": "outbox_events", "queryScope": "COLLECTION",
  "fields": [ {"fieldPath": "status", "order": "ASCENDING"},
              {"fieldPath": "next_retry_at", "order": "ASCENDING"} ] },
{ "collectionGroup": "outbox_events", "queryScope": "COLLECTION",
  "fields": [ {"fieldPath": "org_id", "order": "ASCENDING"},
              {"fieldPath": "status", "order": "ASCENDING"},
              {"fieldPath": "next_retry_at", "order": "ASCENDING"} ] }
```

**Startup wiring** — `backend/app/main.py`, inside the `lifespan` startup block (after
`start_scheduler(app)`, around line 165):

```python
    try:
        from app.events.subscribers import register_all
        register_all()
    except Exception as e:
        logging.getLogger(__name__).warning(f"event subscribers not registered: {e}")
```

**Net effect:** `webhook_dispatcher.dispatch_event()` (the daemon-thread path) and the inline
`fire_automated_actions` calls are **deprecated** — kept importable for one release, but no new producer
calls them. `webhook_inbox` (the dead collection) is retired in favour of `outbox_events`.

---

## 2. ساگا / پاشەکشێ (Saga / compensation for O2C)

**Target:** `sales_orders.py::sales_order_to_invoice()` (§0.4) and the broader Order-to-Cash chain
(SO confirmed → stock reserved → invoice posted → payment captured). These touch ≥3 aggregates with no
atomicity and no rollback today.

**Pattern:** an **orchestration saga** with a persisted run document and explicit compensating actions.
We do NOT try to make cross-aggregate writes one Firestore transaction (impossible across collections at
scale + line-item batches). Instead: each step is locally atomic (use §1.4 `create_with_event`), the
saga records progress, and on failure it runs compensations in reverse.

Create **`backend/app/services/saga.py`**:

```python
"""Lightweight orchestration saga with compensation (P1)."""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Callable

from app.firestore.base import BaseRepository

logger = logging.getLogger("saga")


class SagaRunRepository(BaseRepository):
    collection_name = "saga_runs"


@dataclass
class Step:
    name: str
    action: Callable[[dict], dict]        # (ctx) -> result merged into ctx
    compensate: Callable[[dict], None] | None = None


class Saga:
    def __init__(self, org_id: str, name: str, correlation_id: str | None = None):
        self.org_id = org_id
        self.name = name
        self.correlation_id = correlation_id or str(uuid.uuid4())
        self.steps: list[Step] = []
        self.repo = SagaRunRepository(org_id)

    def step(self, name, action, compensate=None):
        self.steps.append(Step(name, action, compensate))
        return self

    def run(self, ctx: dict) -> dict:
        run_id = self.repo.create({
            "id": self.correlation_id,
            "name": self.name,
            "status": "running",
            "completed_steps": [],
            "ctx_keys": list(ctx.keys()),
        })["id"]
        done: list[Step] = []
        try:
            for s in self.steps:
                logger.info("saga=%s step=%s start", self.name, s.name)
                out = s.action(ctx) or {}
                ctx.update(out)
                done.append(s)
                self.repo.update(run_id, {
                    "completed_steps": [d.name for d in done],
                    "updated_at": datetime.utcnow().isoformat(),
                })
            self.repo.update(run_id, {"status": "completed"})
            return ctx
        except Exception as exc:  # noqa: BLE001
            logger.error("saga=%s failed at step=%s: %s — compensating", self.name,
                         done[-1].name if done else "<none>", exc)
            self.repo.update(run_id, {"status": "compensating", "error": str(exc)[:500]})
            for s in reversed(done):
                if s.compensate:
                    try:
                        s.compensate(ctx)
                    except Exception as cexc:  # noqa: BLE001
                        logger.error("saga=%s compensate step=%s FAILED: %s",
                                     self.name, s.name, cexc)
                        self.repo.update(run_id, {"status": "compensation_failed",
                                                  "compensation_error": str(cexc)[:500]})
                        raise
            self.repo.update(run_id, {"status": "compensated"})
            raise
```

**Rewrite `sales_order_to_invoice()`** (`backend/app/api/sales_orders.py:142`) as a saga:

```python
@router.post("/{sales_order_id}/convert-to-invoice", status_code=201)
def sales_order_to_invoice(sales_order_id: str, user: dict = Depends(get_current_user)):
    from app.services.saga import Saga
    from app.events import DomainEvent, Topics
    org_id = user["org_id"]
    repo = SalesOrderRepository(org_id)
    inv_repo = InvoiceRepository(org_id)
    seq_repo = SequenceRepository(org_id)

    so = _so_load(repo, sales_order_id, org_id)
    so_with_lines = repo.get_with_lines(sales_order_id)

    def _mark_invoiced(ctx):
        SALES_ORDER_SM.transition(so, "invoiced")
        repo.update(sales_order_id, {"status": so["status"]})
        return {"prev_status": "confirmed"}

    def _undo_mark(ctx):
        repo.update(sales_order_id, {"status": ctx.get("prev_status", "confirmed"),
                                     "invoice_id": fs.DELETE_FIELD})

    def _create_invoice(ctx):
        total = float(so.get("total", 0) or 0)
        today = datetime.utcnow().isoformat()[:10]
        inv = inv_repo.create_with_event(
            {"id": str(uuid.uuid4()), "invoice_number": seq_repo.get_next("invoice"),
             "contact_id": so.get("contact_id"), "date": today, "due_date": today,
             "total": total, "balance_due": total, "status": "draft",
             "sales_order_id": sales_order_id},
            DomainEvent(topic=Topics.SALES_ORDER_INVOICED, org_id=org_id,
                        aggregate_type="invoice", correlation_id=ctx["_corr"],
                        payload={"sales_order_id": sales_order_id, "total": total}),
        )
        lines = (so_with_lines or {}).get("lines") or []
        if lines:
            inv_repo.set_lines(inv["id"], [{k: v for k, v in ln.items() if k != "id"} for ln in lines])
        return {"invoice_id": inv["id"], "invoice_number": inv["invoice_number"]}

    def _undo_invoice(ctx):
        if ctx.get("invoice_id"):
            inv_repo.delete(ctx["invoice_id"], hard=True)   # draft, safe to hard-delete

    def _link_back(ctx):
        repo.update(sales_order_id, {"invoice_id": ctx["invoice_id"]})
        return {}

    saga = Saga(org_id, "so_to_invoice")
    ctx = {"_corr": saga.correlation_id}
    ctx = (saga
           .step("mark_invoiced", _mark_invoiced, _undo_mark)
           .step("create_invoice", _create_invoice, _undo_invoice)
           .step("link_back", _link_back)
           .run(ctx))
    return {"id": ctx["invoice_id"], "invoice_number": ctx["invoice_number"],
            "sales_order_id": sales_order_id}
```

**Why this is correct here:** if `create_invoice` succeeds but `link_back` throws, the saga runs
`_undo_invoice` (hard-delete the draft) and `_undo_mark` (revert SO to `confirmed`) — the system returns
to its pre-call state instead of the current half-built mess. The `saga_runs` doc is the audit trail and
the recovery point (a future reaper job can resume `compensating` rows). The `correlation_id` flows into
every emitted event so you can trace the whole O2C in logs / RUM.

> **Honest limitation:** compensation is best-effort. `delete()` runs `find_blocking_references`
> (`base.py:452`) — a draft invoice with no payments/journals won't block, but if a downstream
> subscriber already created a journal off `sales_order.invoiced`, hard-delete could conflict. Mitigation:
> **only compensate aggregates the saga itself created in this run**, and make the GL-posting subscriber
> consume `invoice.posted` (a later, explicit step), never `invoice.created`. Keep sagas short.

---

## 3. کلین کۆر (Clean Core extensibility — keep the core update-safe)

**Principle:** customers extend **beside** the core (custom fields, studio models, workflows, event
subscribers) — never **inside** it. The core ships updates without breaking tenant customizations.
The pieces already exist (§0.7); we formalize the boundary.

### 3.1 The four sanctioned extension seams

| Seam | Today | Make it update-safe |
|------|-------|---------------------|
| **Custom fields** | `custom_fields.py` defs + side-collection values | Validate on core writes via a hook (below); never alter core schema |
| **Custom models** | `studio.py` `studio_models/records` | Already side-by-side (`studio_records`); add per-model event topics |
| **Workflows** | `automation_workflows` graph, **no executor** | §5 engine, triggered by events only |
| **Event subscribers** | none | §1.3 bus — tenant logic reacts to facts, never patches producers |

### 3.2 Custom-field validation hook (no core-schema edits)

Add an **opt-in** hook to `BaseRepository._validate_payload` so custom-field *definitions* are enforced
without touching any core write-model. Insert in `backend/app/firestore/base.py` near the end of
`_validate_payload` (before `return out`, ~line 121):

```python
        # ── Clean Core: enforce active custom-field definitions for this entity ──
        # Side-by-side: definitions live in `custom_field_definitions`, values are
        # passed in `data["custom_fields"]`. Core schema is never modified.
        try:
            from app.services.custom_field_guard import validate_custom_fields
            validate_custom_fields(cls.collection_name, getattr(cls, "_org_id_hint", None), out)
        except ImportError:
            pass
        return out
```

Create **`backend/app/services/custom_field_guard.py`**:

```python
"""Validate tenant custom-field values against their definitions (Clean Core, P1)."""
from __future__ import annotations

from app.firestore.system import CustomFieldDefinitionRepository

_ENTITY_FOR_COLLECTION = {
    "invoices": "invoice", "bills": "bill", "contacts": "contact",
    "items": "item", "sales_orders": "sales_order",
}


def validate_custom_fields(collection: str, org_id: str | None, payload: dict) -> None:
    entity = _ENTITY_FOR_COLLECTION.get(collection)
    if not entity or not org_id:
        return
    cf = payload.get("custom_fields") or {}
    if not isinstance(cf, dict):
        raise ValueError("custom_fields must be an object")
    defs, _ = CustomFieldDefinitionRepository(org_id).list(
        filters=[{"field": "entity_type", "op": "==", "value": entity},
                 {"field": "is_active", "op": "==", "value": True}], limit=200)
    by_name = {d["field_name"]: d for d in defs}
    for d in defs:
        if d.get("is_required") and d["field_name"] not in cf:
            raise ValueError(f"custom field required: {d['field_name']}")
    for name in cf:
        if name not in by_name:
            raise ValueError(f"unknown custom field: {name}")
```

> **Honest caveat:** `BaseRepository` has `self.org_id` per instance but `_validate_payload` is a
> `@classmethod`. To pass `org_id` cleanly, change the call site in `create()`/`update()` to
> `self._validate_payload(data)` → an instance wrapper that threads `self.org_id`, or stash it on the
> instance. Keep the guard **flag-gated** (`CLEAN_CORE_CF_VALIDATION: bool = False` in `config.py`) so it
> is off until the org-id threading + tests are in. This is the one place that needs care; everything
> else is purely additive.

### 3.3 Per-custom-model events

When a `studio_records` row is created (`studio.py:151` `create_record`), emit
`studio.<model_name>.created` through the bus (via `create_with_event`). Tenant workflows can then react
to *their own* models with the same machinery as core entities. This is the "Odoo Studio automated
actions on custom models" parity feature.

### 3.4 The contract (write it down, enforce in review)

Add a short ADR (the repo already keeps `docs/adr/` per CLAUDE.md): **"Core code never imports tenant
extension code. Extensions never edit `app/api/*` core handlers or `app/firestore/*` core repos.
Extension points are: custom_fields, studio, automation_workflows, event subscribers."** Lint it with a
grep guard in CI (no `import app.studio` from core).

---

## 4. API گەیتوەی + OpenAPI (Gateway + contract + versioning + public surface)

### 4.1 Gateway: front Cloud Run, don't hand-roll auth/rate-limit at the edge

Today clients hit Cloud Run directly and every cross-cutting concern is a FastAPI middleware
(`main.py:275-614`: HTTPS, security headers, CORS, org-context, CSRF, rate-limit, module-gate,
idempotency, audit). That works but couples edge policy to app deploys. Introduce a gateway in front:

**Recommended for this stack (GCP, Cloud Run): Google Cloud API Gateway** (managed, cheapest path, native
to the existing `zoho-83cda` project) driven by the OpenAPI doc the app already emits. Kong/Apigee are
viable if you want a richer plugin ecosystem, but Cloud API Gateway is the least-effort win here.

Gateway responsibilities (move OFF the app over time): TLS termination (already at Cloud Run), API-key /
quota for the **public** API, IP allow-listing, request-size caps, coarse rate-limit (keep the
fine-grained per-tenant `RateLimitMiddleware` in-app), and routing `api.erpiq.systems` →
`zoho-erp-backend`. The app keeps JWT verification (it's tenant-aware; the gateway can't see org context).

`gateway/openapi-gateway.yaml` (Cloud API Gateway config, derived from `/api/openapi.json`):

```yaml
swagger: "2.0"
info: { title: erpiq-public, version: "1.0.0" }
host: api.erpiq.systems
schemes: [https]
securityDefinitions:
  api_key: { type: apiKey, name: x-api-key, in: header }
  bearer:  { type: oauth2, flow: implicit, authorizationUrl: "https://erpiq.systems/login", x-google-issuer: "..." }
x-google-backend:
  address: https://zoho-erp-backend-6plfqh2hiq-ew.a.run.app
paths:
  /api/v1/{proxy+}:
    get:    { security: [{bearer: []}, {api_key: []}], responses: {"200": {description: ok}} }
    post:   { security: [{bearer: []}, {api_key: []}], responses: {"200": {description: ok}} }
    # ... PUT/PATCH/DELETE ...
```

### 4.2 Full OpenAPI contract + tighten what's generated

FastAPI already produces `/api/openapi.json`. The gaps: many legacy routers use bare `dict` bodies
(e.g. `custom_fields.py:17 create_definition(data: dict)`, `studio.py:152 create_record(body: dict)`),
which produce a useless schema. **Action:** give every *public* endpoint a Pydantic request/response
model. Prioritize the v1 routers (already typed) and the entities you expose publicly.

Add **global response headers + auth scheme** to the schema so the contract documents idempotency,
versioning, and optimistic concurrency (the app *behaves* this way per `main.py:206-218` but the schema
doesn't say so). Insert in `main.py` after `app = FastAPI(...)` (after line 224):

```python
def _custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    from fastapi.openapi.utils import get_openapi
    schema = get_openapi(title=app.title, version=app.version,
                         description=app.description, routes=app.routes)
    schema.setdefault("components", {}).setdefault("securitySchemes", {})["bearerAuth"] = {
        "type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
    schema["security"] = [{"bearerAuth": []}]
    # document cross-cutting request headers once
    schema["components"]["parameters"] = {
        "IdempotencyKey": {"name": "Idempotency-Key", "in": "header", "required": False,
                           "schema": {"type": "string"}},
        "IfMatch": {"name": "If-Match", "in": "header", "required": False,
                    "schema": {"type": "string"}},
    }
    app.openapi_schema = schema
    return schema

app.openapi = _custom_openapi
```

### 4.3 Versioning policy (write it into the contract)

The split is already `/api/<legacy>` vs `/api/v1/<resource>`. Formalize:
- **`/api/v1` is the supported, public, stable surface.** New public resources go here only.
- Legacy `/api/...` is **internal / first-party frontend** — not promised to third parties.
- Deprecation: add `Deprecation` + `Sunset` response headers (RFC 8594) on legacy routes you intend to
  retire; the gateway can also inject them.
- The v1 router (`v1/router.py`) is the place to grow the public surface — add `pos`, `expenses`,
  `inventory`, `projects`, `subscriptions` v1 routers next, each cursor-paginated + RFC 7807 (the v1
  infra already does both, per `register_error_handlers` and the docstring at `main.py:213-218`).

### 4.4 Expand the public API surface (concrete order)

Lowest-risk, highest-value additions to `/api/v1` (each ~mirrors an existing legacy router, wrapped in the
v1 pagination/error conventions): **payments** (already v1) → **webhooks subscriptions** (promote
`webhooks_settings.py` to `/api/v1/webhooks` so third parties self-manage endpoints) → **events**
(`GET /api/v1/events` read-only feed from `outbox_events`, so partners can poll instead of needing a
webhook) → **custom-fields** + **studio records** (typed) → **inventory** + **pos**. Gate the public ones
behind the gateway API-key; keep tenant JWT for first-party.

---

## 5. ووۆرکفلۆ / BPMN ئینجن (No-code workflow / approval engine)

**Goal:** make `automation_workflows` (the visual `nodes`/`edges` graph that today only has a *simulator*
at `automation.py:313`) actually execute on real domain events — the Odoo-Studio competitor.

### 5.1 Data model — reuse what exists, add run state

`automation_workflows` already stores `{trigger:{event,filter,cron_expr?}, nodes:[{id,type,config}], edges:[{from_node_id,to_node_id,condition?}], active}`
(`automation.py:233`). Keep it. Node `type` ∈ `{trigger, condition, action, delay, approval}`. We add an
**instance** collection for in-flight runs (delays + approvals make workflows long-running):

Create **`backend/app/firestore/workflow_instances.py`**:

```python
from app.firestore.base import BaseRepository

class WorkflowInstanceRepository(BaseRepository):
    """One row per (workflow, triggering event). Survives delays/approvals."""
    collection_name = "workflow_instances"
    # fields: workflow_id, event_id (dedup), org_id, status
    #         (running|waiting_delay|waiting_approval|completed|failed),
    #         cursor_node_id, context(dict), wake_at(datetime|None),
    #         approval{node_id, approver_ids, decision, decided_by, decided_at}
```

### 5.2 Execution engine

Create **`backend/app/services/workflow_engine.py`**:

```python
"""No-code workflow engine — executes automation_workflows graphs on events (P1)."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from app.events import DomainEvent
from app.firestore.automation import WorkflowRepository, WorkflowRunRepository
from app.firestore.workflow_instances import WorkflowInstanceRepository

logger = logging.getLogger("workflow_engine")


def run_workflows_for_event(event: DomainEvent) -> None:
    """Subscriber entrypoint (registered in subscribers.py @on('*'))."""
    wf_repo = WorkflowRepository(event.org_id)
    workflows, _ = wf_repo.list(
        filters=[{"field": "active", "op": "==", "value": True}], limit=500)
    for wf in workflows:
        trig = wf.get("trigger") or {}
        if trig.get("event") != event.topic:
            continue
        if not _match_filter(trig.get("filter") or {}, event.payload):
            continue
        _start_instance(event.org_id, wf, event)


def _match_filter(flt: dict, payload: dict) -> bool:
    # simple equality / comparison filter, reuse automation_runner's safe evaluator
    for k, expected in flt.items():
        if payload.get(k) != expected:
            return False
    return True


def _start_instance(org_id: str, wf: dict, event: DomainEvent) -> None:
    inst_repo = WorkflowInstanceRepository(org_id)
    # idempotency: one instance per (workflow, event) — handlers may re-run on retry
    existing, _ = inst_repo.list(filters=[
        {"field": "workflow_id", "op": "==", "value": wf["id"]},
        {"field": "event_id", "op": "==", "value": event.id}], limit=1)
    if existing:
        return
    inst = inst_repo.create({
        "workflow_id": wf["id"], "event_id": event.id, "status": "running",
        "cursor_node_id": _entry_node(wf), "context": {"event": event.payload},
        "correlation_id": event.correlation_id,
    })
    _advance(org_id, wf, inst)


def _entry_node(wf: dict) -> str | None:
    targets = {e.get("to_node_id") for e in (wf.get("edges") or [])}
    for n in wf.get("nodes") or []:
        if n["id"] not in targets:   # node with no inbound edge = entry
            return n["id"]
    return (wf.get("nodes") or [{}])[0].get("id")


def _advance(org_id: str, wf: dict, inst: dict) -> None:
    """Walk nodes from cursor until we finish or hit a wait (delay/approval)."""
    inst_repo = WorkflowInstanceRepository(org_id)
    node_map = {n["id"]: n for n in wf.get("nodes") or []}
    edges = wf.get("edges") or []
    ctx = inst.get("context") or {}
    cursor = inst.get("cursor_node_id")

    while cursor:
        node = node_map.get(cursor)
        if not node:
            break
        ntype = node.get("type", "action")
        cfg = node.get("config") or {}

        if ntype == "delay":
            wake = datetime.utcnow() + timedelta(minutes=int(cfg.get("delay_minutes", 60)))
            inst_repo.update(inst["id"], {"status": "waiting_delay", "wake_at": wake,
                                          "cursor_node_id": cursor})
            return
        if ntype == "approval":
            inst_repo.update(inst["id"], {
                "status": "waiting_approval", "cursor_node_id": cursor,
                "approval": {"node_id": cursor,
                             "approver_ids": cfg.get("approver_ids", []),
                             "decision": None}})
            _notify_approvers(org_id, inst, cfg)   # via event/email
            return
        if ntype == "condition":
            branch = "true" if _eval_condition(cfg, ctx) else "false"
            cursor = _next(edges, cursor, branch)
            continue
        if ntype == "action":
            _run_action(org_id, cfg, ctx)
        cursor = _next(edges, cursor, None)

    inst_repo.update(inst["id"], {"status": "completed",
                                  "completed_at": datetime.utcnow().isoformat()})
    WorkflowRunRepository(org_id).create({
        "workflow_id": wf["id"], "instance_id": inst["id"], "result": "ok",
        "ran_at": datetime.utcnow().isoformat()})


def _next(edges, frm, branch):
    for e in edges:
        if e.get("from_node_id") == frm:
            if branch is None or e.get("condition") in (None, branch):
                return e.get("to_node_id")
    return None


def _eval_condition(cfg: dict, ctx: dict) -> bool:
    # reuse the SAFE evaluator from automation_runner (regex-bounded, no eval())
    from app.services.automation_runner import evaluate_condition
    return evaluate_condition(cfg.get("expr"), ctx.get("event") or {})


def _run_action(org_id: str, cfg: dict, ctx: dict) -> None:
    # delegate to the SAME action set automation_runner supports, extended:
    # send_email / send_sms / send_whatsapp / create_task / create_invoice /
    # update_field / http_webhook  (see automation.py list_available_actions)
    from app.services.automation_actions import execute_action  # NEW thin dispatcher
    execute_action(org_id, cfg.get("action_type") or cfg.get("type"), cfg, ctx)


def _notify_approvers(org_id, inst, cfg):
    logger.info("approval requested wf_instance=%s approvers=%s",
                inst["id"], cfg.get("approver_ids"))
```

### 5.3 Approvals + delays need a waker job

Approvals resolve via an endpoint; delays resolve via a scheduler job. Add to
`backend/app/api/automation.py`:

```python
@router.post("/workflow-instances/{iid}/approve",
             dependencies=[Depends(require_perm("settings.update"))])
def approve_instance(iid: str, decision: str = "approved", user: dict = Depends(get_current_user)):
    from app.firestore.workflow_instances import WorkflowInstanceRepository
    from app.firestore.automation import WorkflowRepository
    from app.services.workflow_engine import _advance, _next
    inst_repo = WorkflowInstanceRepository(user["org_id"])
    inst = inst_repo.get(iid)
    if not inst or inst.get("status") != "waiting_approval":
        raise HTTPException(404, "no pending approval")
    appr = inst.get("approval") or {}
    if appr.get("approver_ids") and user["id"] not in appr["approver_ids"]:
        raise HTTPException(403, "not an approver")
    wf = WorkflowRepository(user["org_id"]).get(inst["workflow_id"])
    branch = "approved" if decision == "approved" else "rejected"
    inst_repo.update(iid, {"status": "running",
                           "cursor_node_id": _next(wf.get("edges", []), inst["cursor_node_id"], branch),
                           "approval": {**appr, "decision": decision,
                                        "decided_by": user["id"],
                                        "decided_at": datetime.utcnow().isoformat()}})
    _advance(user["org_id"], wf, inst_repo.get(iid))
    return {"status": "resumed", "decision": decision}
```

Add a scheduler job — `backend/app/services/scheduler.py`, register inside `start_scheduler` (mirror the
existing `_job_outbox_dispatch` block at line 149):

```python
    _scheduler.add_job(
        _job_workflow_waker,
        trigger=IntervalTrigger(minutes=1),
        id="workflow_waker", name="Resume delayed workflow instances",
        coalesce=True, max_instances=1, replace_existing=True)
```

…and the job body (alongside `_job_outbox_dispatch`, ~line 765), iterating orgs like the other jobs do:

```python
def _job_workflow_waker():
    """Resume workflow_instances whose delay has elapsed (P1)."""
    try:
        from datetime import datetime
        from app.firebase_client import get_firestore_client
        from app.firestore.workflow_instances import WorkflowInstanceRepository
        from app.firestore.automation import WorkflowRepository
        from app.services.workflow_engine import _advance
        db = get_firestore_client()
        now = datetime.utcnow()
        for org_doc in db.collection("organizations").stream():
            inst_repo = WorkflowInstanceRepository(org_doc.id)
            waiting, _ = inst_repo.list(filters=[
                {"field": "status", "op": "==", "value": "waiting_delay"}], limit=200)
            for inst in waiting:
                wake = inst.get("wake_at")
                if isinstance(wake, datetime) and wake <= now:
                    wf = WorkflowRepository(org_doc.id).get(inst["workflow_id"])
                    if wf:
                        inst_repo.update(inst["id"], {"status": "running"})
                        _advance(org_doc.id, wf, inst_repo.get(inst["id"]))
    except Exception as e:
        logging.getLogger(__name__).error("workflow waker failed: %s", e)
```

### 5.4 Unify the two automation systems

You now have **two** overlapping things: `automated_actions` (flat trigger→action, `automation_runner`)
and `automation_workflows` (graph, the new engine). **Decision:** keep `automated_actions` as the
"simple rule" UI (it's already wired and event-driven via the `_run_automations` subscriber), and
position `automation_workflows` as "advanced / multi-step / approvals." Both are now driven by the **same
event bus** (§1.3). Promote the existing `/workflows/{wid}/test-run` simulator (`automation.py:313`) to
call the *real* engine in a dry-run mode (pass a flag that makes `_run_action` log instead of execute) so
the preview matches production.

---

## 6. ڕیزبەندی، مەترسی، و پشتڕاستکردنەوە (Sequencing, risk, feature flags, verify, rollback)

### 6.1 Sequence (each phase is independently shippable & flag-gated)

1. **Phase A — Event envelope + bus + transactional outbox producer (`§1`).**
   Lowest risk: purely additive (`app/events/*`, `create_with_event`, dispatcher rewrite). The bus has
   zero subscribers at first, so behaviour is unchanged. **Do this first** — everything else depends on it.
2. **Phase B — Move webhook + automation to subscribers (`§1.3`).** Flip producers off the inline calls
   one entity at a time (start with invoices). Each move is a small diff + its own test.
3. **Phase C — Saga for O2C (`§2`).** Only `sales_order_to_invoice` at first; it's the clearest win.
4. **Phase D — Workflow engine (`§5`).** Needs the bus (A) and is the biggest new surface; ship behind a
   flag with a few canary tenants.
5. **Phase E — Clean Core CF validation (`§3.2`).** Last of the app-side work; it's the only change that
   can reject previously-accepted writes, so it ships **off** and gets enabled per-tenant.
6. **Phase F — Gateway + OpenAPI hardening + public surface (`§4`).** Infra + contract; parallelizable
   with D/E, but don't expose the public surface until the bus/outbox are proven.

### 6.2 Feature flags (add to `Settings` in `backend/app/config.py`, after line 134 — same block as `GL_MATERIALISATION_ENABLED`)

```python
    # ── P1 architecture ──
    OUTBOX_TRANSACTIONAL_ENABLED: bool = False   # create_with_event commits event in txn
    EVENT_BUS_ENABLED: bool = True               # dispatcher delivers to in-process bus
    EVENT_BUS_WEBHOOK_FANOUT: bool = False        # subscriber replaces inline dispatch_event
    SAGA_O2C_ENABLED: bool = False               # sales_order_to_invoice uses Saga
    WORKFLOW_ENGINE_ENABLED: bool = False        # automation_workflows actually execute
    CLEAN_CORE_CF_VALIDATION: bool = False       # enforce custom-field defs on core writes
    OUTBOX_PUBSUB_ENABLED: bool = False          # also publish to Pub/Sub (needs OUTBOX_PUBSUB_TOPIC)
```

Gate each new path on its flag, e.g. in `create_with_event`:
`if not get_settings().OUTBOX_TRANSACTIONAL_ENABLED: return self.create(data)` (falls back to the exact
current behaviour — the inline `dispatch_event` then still runs at the call-site until Phase B). This
guarantees **flag-off = byte-for-byte today's behaviour**.

### 6.3 Risk register (honest)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Firestore txn can't include line-item batch | Certain | Events reference header id only (§1.4 caveat); documented invariant |
| Double-delivery (two dispatchers) | Medium | Lease via txn flip `pending→processing` (§1.5 `_claim`); consumers idempotent on `event.id` |
| Subscriber raises → event stuck retrying forever | Medium | `_MAX_ATTEMPTS=8` → `status:"dead"`; add a `dead` alert + DLQ review UI |
| Saga compensation itself fails | Low | Record `compensation_failed`, raise, page on-call; only compensate self-created aggregates |
| Clean-Core CF guard rejects valid legacy writes | Medium | Ships off; per-tenant rollout; `unknown custom field` is a 422 the UI can show |
| `_validate_payload` is a classmethod (no org_id) | Certain | Thread `self.org_id` via instance wrapper before enabling §3.2; flagged off until then |
| Workflow infinite loop (cyclic edges) | Low | `_advance` should cap node visits per run (add `max_steps=100`); reject cyclic graphs on save |
| Gateway hides org context | Certain | Keep JWT + per-tenant rate-limit in-app; gateway does only coarse/API-key policy |

### 6.4 Verify on Windows (full suite — this is mandatory before applying)

The codebase's verified pattern (CLAUDE.md) is `pytest` from `backend/` on the Windows venv. Run:

```powershell
cd C:\Users\SAFA\zoho\backend
.\venv\Scripts\Activate.ps1
pytest -q                                   # full suite (baseline was ~1333 passing / 2 pre-existing fails)
pytest -q tests/ -k "outbox or event or saga or workflow or idempotency or automation"
```

New tests to author (mirror existing `tests/` style — e.g. `tests/test_payments_*`):
- `tests/test_outbox_transactional.py` — `create_with_event` writes header **and** outbox row; simulate
  txn abort → assert **neither** persisted (the atomicity proof).
- `tests/test_event_bus.py` — `subscribe`/`deliver`; a raising handler is isolated and reported in
  `errors`; wildcard fan-out runs.
- `tests/test_outbox_dispatcher.py` — lease prevents double-deliver; backoff schedule; `dead` after
  `_MAX_ATTEMPTS`.
- `tests/test_saga_o2c.py` — happy path links invoice; inject failure in `link_back` → assert draft
  invoice hard-deleted and SO reverted to `confirmed` (compensation proof).
- `tests/test_workflow_engine.py` — event triggers workflow; condition branches; delay parks an
  instance; `approve_instance` resumes; idempotent on duplicate `event_id`.
- `tests/test_clean_core_cf.py` — required CF missing → 422; unknown CF → 422; flag-off → no-op.

Also confirm the app still boots and route count is unchanged-or-higher (the project tracks
`/api/metrics → route_count`): `python -c "from app.main import app; print(len(app.routes))"`.

> **Why this guide is "reviewed, not applied":** the changes touch the hot write path (`base.py`),
> the request pipeline (`main.py`), and money flows (`sales_orders.py`, `invoices.py`). The project's
> own rule (CLAUDE.md, P0 finance note) is **money/core paths never change without the full test suite
> on Windows**, which only runs on the user's machine. So this is the design + exact diffs; the user runs
> `pytest` and commits.

### 6.5 Rollback

- **Code:** every change is behind a flag in §6.2 — set the flag(s) to `False` and the new path is
  bypassed (flag-off == today's behaviour). No redeploy needed if flags are read from a settings bag;
  redeploy needed if read from `Settings` env (they are, so: flip env var + restart).
- **Data:** the new collections (`outbox_events` already exists, `saga_runs`, `workflow_instances`) are
  additive — leaving rows behind is harmless. The dispatcher only acts on `status:"pending"`; setting
  `EVENT_BUS_ENABLED=False` makes `_job_outbox_dispatch` a no-op (guard it). No core collection schema
  changes, so **no migration to reverse.**
- **Gateway:** DNS `api.erpiq.systems` → flip back to direct Cloud Run; the app served direct traffic
  before and still does (gateway is additive, not in the data path of first-party traffic).

---

## Appendix — file-by-file change map

| File | Change | New/Edit |
|------|--------|----------|
| `backend/app/events/__init__.py` | `DomainEvent`, `Topics` | **new** |
| `backend/app/events/bus.py` | in-process bus (`subscribe`/`on`/`deliver`) | **new** |
| `backend/app/events/subscribers.py` | webhook + automation + workflow subscribers | **new** |
| `backend/app/firestore/outbox.py` | add `stage_in_txn`; keep legacy `enqueue` | edit |
| `backend/app/firestore/base.py` | add `create_with_event`; CF-guard hook in `_validate_payload` | edit |
| `backend/app/services/outbox_dispatcher.py` | rewrite: lease + bus deliver + Pub/Sub + backoff | edit |
| `backend/app/services/saga.py` | `Saga`, `SagaRunRepository` | **new** |
| `backend/app/services/custom_field_guard.py` | `validate_custom_fields` | **new** |
| `backend/app/services/workflow_engine.py` | event-driven graph executor | **new** |
| `backend/app/services/automation_actions.py` | thin shared action dispatcher (extract from runner) | **new** |
| `backend/app/firestore/workflow_instances.py` | `WorkflowInstanceRepository` | **new** |
| `backend/app/api/invoices.py` | use `create_with_event`; delete inline dispatch blocks | edit |
| `backend/app/api/sales_orders.py` | `sales_order_to_invoice` → `Saga` | edit |
| `backend/app/api/automation.py` | add `approve_instance`; real-engine `test-run` | edit |
| `backend/app/services/scheduler.py` | register `workflow_waker` job + body | edit |
| `backend/app/main.py` | `register_all()` at startup; `_custom_openapi` | edit |
| `backend/app/config.py` | 7 P1 feature flags | edit |
| `backend/jobs/outbox_worker.py` | Cloud Run Job entrypoint | **new** |
| `gateway/openapi-gateway.yaml` | Cloud API Gateway config | **new** |
| `firestore.indexes.json` | 2 `outbox_events` composite indexes | edit |
| `docs/adr/NNNN-clean-core-boundary.md` | extension-point contract | **new** |
| `backend/tests/test_*` | 6 new test modules (§6.4) | **new** |

**Deprecated (kept importable one release, no new callers):** `webhook_dispatcher.dispatch_event`
(daemon-thread path), inline `fire_automated_actions` call-sites, `webhook_inbox` collection (dead),
`OutboxEventRepository.enqueue` legacy einvoice path (migrate to `create_with_event` + `Topics`).
