"""Phase 4.3: Automation engine v1 — fire trigger-driven automated actions."""
from __future__ import annotations

import logging
import operator
import re
from datetime import datetime
from typing import Any

from app.firestore.activities import ActivityRepository
from app.firestore.automation import AutomatedActionRepository, AutomationLogRepository
from app.services.webhook_dispatcher import dispatch_event

logger = logging.getLogger("automation_runner")

_CONDITION_RE = re.compile(
    r"^\s*(amount|total)\s*(>=|<=|==|!=|>|<)\s*([\d.]+)\s*$",
    re.IGNORECASE,
)
_OPS = {
    ">": operator.gt,
    ">=": operator.ge,
    "<": operator.lt,
    "<=": operator.le,
    "==": operator.eq,
    "!=": operator.ne,
}


def evaluate_condition(condition: str | None, record: dict) -> bool:
    """Evaluate a simple amount/total condition against *record*."""
    if not condition:
        return True
    match = _CONDITION_RE.match(condition.strip())
    if not match:
        logger.warning("automation: unsupported condition %r", condition)
        return False
    _field, op_str, val_str = match.groups()
    try:
        amount = float(record.get("amount") or record.get("total") or 0)
        threshold = float(val_str)
    except (TypeError, ValueError):
        return False
    op_fn = _OPS.get(op_str)
    if not op_fn:
        return False
    return op_fn(amount, threshold)


def _execute_action(
    org_id: str,
    rule: dict,
    entity_type: str,
    trigger: str,
    record: dict,
) -> None:
    action_type = rule.get("action_type") or ""
    config = rule.get("action_config") or {}
    record_id = record.get("id", "")

    if action_type == "webhook":
        event = config.get("event") or f"{entity_type}.{trigger.replace('on_', '')}"
        dispatch_event(org_id, event, {"id": record_id, **record})
        return

    if action_type == "create_activity":
        ActivityRepository(org_id).create({
            "entity_type": entity_type,
            "entity_id": record_id,
            "title": config.get("title") or f"Automation: {rule.get('name', entity_type)}",
            "due_at": config.get("due_at"),
            "assignee_id": config.get("assignee_id"),
            "status": "open",
            "source": "automation",
            "automation_rule_id": rule.get("id"),
        })
        return

    if action_type == "log":
        AutomationLogRepository(org_id).create({
            "automation_rule_id": rule.get("id"),
            "rule_name": rule.get("name"),
            "entity_type": entity_type,
            "entity_id": record_id,
            "trigger": trigger,
            "action_type": action_type,
            "message": config.get("message") or f"Rule fired: {rule.get('name', rule.get('id'))}",
            "ran_at": datetime.utcnow().isoformat(),
            "result": "ok",
        })
        return

    if action_type == "send_email":
        AutomationLogRepository(org_id).create({
            "automation_rule_id": rule.get("id"),
            "rule_name": rule.get("name"),
            "entity_type": entity_type,
            "entity_id": record_id,
            "trigger": trigger,
            "action_type": action_type,
            "message": f"[mock] email to={config.get('to')} subject={config.get('subject')}",
            "ran_at": datetime.utcnow().isoformat(),
            "result": "mock",
        })
        return

    logger.warning("automation: unknown action_type %r rule=%s", action_type, rule.get("id"))


def fire_automated_actions(
    org_id: str,
    entity_type: str,
    trigger: str,
    record: dict,
) -> dict[str, Any]:
    """Load matching active rules and execute their actions.

    Returns summary ``{"fired": N, "skipped": N, "errors": N}``.
    """
    if not org_id or not entity_type or not trigger:
        return {"fired": 0, "skipped": 0, "errors": 0}

    repo = AutomatedActionRepository(org_id)
    rules, _ = repo.list(
        filters=[
            {"field": "entity_type", "op": "==", "value": entity_type},
            {"field": "trigger", "op": "==", "value": trigger},
            {"field": "active", "op": "==", "value": True},
        ],
        limit=500,
    )

    fired = skipped = errors = 0
    for rule in rules:
        if not evaluate_condition(rule.get("condition"), record):
            skipped += 1
            continue
        try:
            _execute_action(org_id, rule, entity_type, trigger, record)
            fired += 1
        except Exception as exc:
            errors += 1
            logger.error(
                "automation action failed rule=%s type=%s: %s",
                rule.get("id"),
                rule.get("action_type"),
                exc,
            )
    return {"fired": fired, "skipped": skipped, "errors": errors}
