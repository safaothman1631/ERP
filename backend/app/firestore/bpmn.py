"""BPMN workflow definition + instance repositories (Pool 3.6 buildout).

Persists the pure ``app.services.workflow_engine`` state machine to Firestore:

  * ``bpmn_definitions`` — a reusable workflow definition
    ``{name, states, start, end, transitions}``. ``transitions`` are stored as
    plain dicts ``{from, to, on}`` (no runtime ``guard`` callables — guards on a
    persisted definition are evaluated separately; see the API layer).
  * ``bpmn_instances`` — a running instance of a definition
    ``{definition_id, state, history}`` where ``history`` is an append-only list
    of ``{event, from, to, at, context}`` records.

Both are scoped under ``org_id`` via :class:`app.firestore.base.BaseRepository`.
"""
from app.firestore.base import BaseRepository


class WorkflowDefRepository(BaseRepository):
    """Repository for BPMN workflow definitions."""

    collection_name = "bpmn_definitions"


class WorkflowInstanceRepository(BaseRepository):
    """Repository for running BPMN workflow instances."""

    collection_name = "bpmn_instances"
