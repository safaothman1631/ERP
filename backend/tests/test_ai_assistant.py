"""Tests for the LLM analytics assistant (app/analytics/ai/assistant.py +
app/api/ai_assistant.py).

The whole point of the assistant is that the LLM can *never* inject SQL: its only
output is a JSON object that we validate against the ``analytics._FACTS``
whitelist before anything runs. These tests prove that boundary holds.

No live Anthropic API or BigQuery is hit:
  * a fake ``anthropic`` module is injected into ``sys.modules`` so the lazy
    ``import anthropic`` inside the service resolves to a controllable double
    whose ``messages.create`` returns a canned JSON / summary (mirrors the fake
    ``google.cloud.bigquery`` injection in ``test_analytics_api.py``);
  * ``analytics._run_warehouse`` is patched so a validated query returns canned
    rows without touching BigQuery.

Covered:
  * ``ask_data`` parses the LLM JSON, validates it against the whitelist, and
    runs it -> ``ok`` with rows + the echoed query.
  * a malicious / non-whitelist LLM response (bad fact, bad measure, SQL in a
    field) is rejected -> ``could_not_interpret`` and ``_run_warehouse`` is
    NEVER called (the LLM cannot inject a bad query).
  * the LLM JSON, not raw SQL, is what flows in (we assert on the parsed query).
  * ``narrative_insights`` returns the canned summary in ``ok``.
  * graceful ``ai_not_configured`` when no key, ``warehouse_not_configured``
    when the warehouse is off, ``error`` on a Claude failure — never raises.
  * the endpoints forward the service result and never 500.
"""
from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.analytics.ai import assistant
from app.api import ai_assistant
from app.services.auth import get_current_user


# ── User / app fixtures ──────────────────────────────────────────────────────


def _user():
    # role=owner -> permissions == {"*"} -> satisfies require_perm(reports.read)
    return {
        "id": "user-1",
        "org_id": "org-1",
        "email": "user@example.com",
        "name": "Test User",
        "role": "owner",
    }


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(ai_assistant.router)
    app.dependency_overrides[get_current_user] = _user
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def _enable_flags(monkeypatch):
    """Default to AI + warehouse configured so most tests exercise the happy
    path. Individual tests override these to assert the disabled branches."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", "myproj.zoho_wh")
    yield


# ── Fake anthropic SDK injection ─────────────────────────────────────────────


class _TextBlock:
    """Mimics an Anthropic text content block (``.type`` / ``.text``)."""

    type = "text"

    def __init__(self, text: str):
        self.text = text


class _Message:
    def __init__(self, text: str):
        self.content = [_TextBlock(text)]


def _install_fake_anthropic(monkeypatch, *, reply_text=None, replies=None, raises=None):
    """Inject a fake ``anthropic`` module.

    ``reply_text`` — every ``messages.create`` returns this text.
    ``replies``    — a list; successive calls pop the next text (for retry tests).
    ``raises``     — an exception instance ``messages.create`` raises.

    Records the create-call kwargs on ``captured`` (returned) so tests can assert
    the model id / system prompt were passed.
    """
    captured: dict = {"calls": []}
    mod = types.ModuleType("anthropic")
    queue = list(replies) if replies is not None else None

    class _Messages:
        def create(self, **kwargs):
            captured["calls"].append(kwargs)
            if raises is not None:
                raise raises
            if queue is not None:
                text = queue.pop(0) if queue else "{}"
            else:
                text = reply_text if reply_text is not None else "{}"
            return _Message(text)

    class Anthropic:
        def __init__(self, *a, **k):
            self.messages = _Messages()

    mod.Anthropic = Anthropic
    monkeypatch.setitem(sys.modules, "anthropic", mod)
    return captured


# A well-formed, whitelisted query the LLM might emit for "revenue by month".
_GOOD_QUERY_JSON = (
    '{"fact": "fact_invoices", "measures": ["total"], "dimensions": ["month"], '
    '"filters": {}, "date_from": null, "date_to": null, '
    '"order_by": "month", "order_dir": "ASC", "limit": 12}'
)


# ── ask_data: happy path ─────────────────────────────────────────────────────


def test_ask_data_parses_llm_json_validates_and_runs(monkeypatch):
    _install_fake_anthropic(monkeypatch, reply_text=_GOOD_QUERY_JSON)
    run = MagicMock(return_value=[{"month": "2026-01", "total": 1000.0}])
    monkeypatch.setattr(assistant.analytics, "_run_warehouse", run)

    out = assistant.ask_data("org-1", "Show me revenue by month")

    assert out["status"] == "ok"
    assert out["rows"] == [{"month": "2026-01", "total": 1000.0}]
    # The echoed query is the validated AnalysisDef the LLM produced (not SQL).
    assert out["query"]["fact"] == "fact_invoices"
    assert out["query"]["measures"] == ["total"]
    assert out["query"]["dimensions"] == ["month"]
    # _run_warehouse received a real AnalysisDef + the caller's org_id.
    assert run.called
    _defn, _fact, org_id = run.call_args.args
    assert org_id == "org-1"
    assert isinstance(_defn, assistant.analytics.AnalysisDef)


def test_ask_data_uses_cheap_model_and_whitelist_system_prompt(monkeypatch):
    captured = _install_fake_anthropic(monkeypatch, reply_text=_GOOD_QUERY_JSON)
    monkeypatch.setattr(assistant.analytics, "_run_warehouse", MagicMock(return_value=[]))

    assistant.ask_data("org-1", "revenue by month")

    call = captured["calls"][0]
    assert call["model"] == assistant.MODEL_TRANSLATE == "claude-haiku-4-5"
    # System prompt names the whitelist facts but never leaks SQL expressions.
    system_text = call["system"][0]["text"]
    assert "fact_invoices" in system_text
    assert "fact_pos_orders" in system_text
    assert "SUM(" not in system_text  # no SQL expressions exposed to the model
    # Prompt cache breakpoint is set on the (stable) system prompt.
    assert call["system"][0]["cache_control"] == {"type": "ephemeral"}


def test_ask_data_parses_json_wrapped_in_code_fence(monkeypatch):
    fenced = "```json\n" + _GOOD_QUERY_JSON + "\n```"
    _install_fake_anthropic(monkeypatch, reply_text=fenced)
    monkeypatch.setattr(
        assistant.analytics, "_run_warehouse", MagicMock(return_value=[{"x": 1}])
    )
    out = assistant.ask_data("org-1", "revenue by month")
    assert out["status"] == "ok"
    assert out["query"]["fact"] == "fact_invoices"


# ── ask_data: the LLM CANNOT inject a bad query ──────────────────────────────


def test_ask_data_rejects_non_whitelist_fact(monkeypatch):
    """A hallucinated / malicious fact table is rejected by _validate; the query
    never reaches the warehouse."""
    evil = '{"fact": "users; DROP TABLE invoices", "measures": ["total"]}'
    # Both attempts return the same bad fact (retry also fails) -> give up.
    _install_fake_anthropic(monkeypatch, replies=[evil, evil])
    run = MagicMock()
    monkeypatch.setattr(assistant.analytics, "_run_warehouse", run)

    out = assistant.ask_data("org-1", "delete all the users")

    assert out["status"] == "could_not_interpret"
    run.assert_not_called()  # the bad query NEVER reached SQL


def test_ask_data_rejects_non_whitelist_measure(monkeypatch):
    evil = '{"fact": "fact_invoices", "measures": ["(SELECT password FROM users)"]}'
    _install_fake_anthropic(monkeypatch, replies=[evil, evil])
    run = MagicMock()
    monkeypatch.setattr(assistant.analytics, "_run_warehouse", run)

    out = assistant.ask_data("org-1", "leak secrets")

    assert out["status"] == "could_not_interpret"
    run.assert_not_called()


def test_ask_data_rejects_non_whitelist_dimension(monkeypatch):
    evil = (
        '{"fact": "fact_invoices", "measures": ["total"], '
        '"dimensions": ["1; DROP TABLE x"]}'
    )
    _install_fake_anthropic(monkeypatch, replies=[evil, evil])
    run = MagicMock()
    monkeypatch.setattr(assistant.analytics, "_run_warehouse", run)

    out = assistant.ask_data("org-1", "evil group by")
    assert out["status"] == "could_not_interpret"
    run.assert_not_called()


def test_ask_data_unparseable_json_then_retry_succeeds(monkeypatch):
    """First reply is garbage, retry returns a valid whitelisted query -> ok.
    Proves the single retry works."""
    _install_fake_anthropic(
        monkeypatch, replies=["I'm sorry, I cannot do that.", _GOOD_QUERY_JSON]
    )
    run = MagicMock(return_value=[{"month": "2026-02", "total": 5.0}])
    monkeypatch.setattr(assistant.analytics, "_run_warehouse", run)

    out = assistant.ask_data("org-1", "revenue by month")

    assert out["status"] == "ok"
    assert out["rows"] == [{"month": "2026-02", "total": 5.0}]
    assert run.call_count == 1  # only the valid query ran


def test_ask_data_totally_unparseable_gives_could_not_interpret(monkeypatch):
    _install_fake_anthropic(monkeypatch, replies=["no json here", "still no json"])
    run = MagicMock()
    monkeypatch.setattr(assistant.analytics, "_run_warehouse", run)

    out = assistant.ask_data("org-1", "???")
    assert out["status"] == "could_not_interpret"
    run.assert_not_called()


# ── ask_data: graceful degradation (never raises) ────────────────────────────


def test_ask_data_ai_not_configured_when_no_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    out = assistant.ask_data("org-1", "anything")
    assert out["status"] == "ai_not_configured"
    assert out["rows"] == []


def test_ask_data_ai_not_configured_when_sdk_missing(monkeypatch):
    """Key is set but the anthropic SDK import fails -> ai_not_configured."""
    # Ensure no fake module is present and the real one isn't importable.
    monkeypatch.setitem(sys.modules, "anthropic", None)  # import -> ImportError
    out = assistant.ask_data("org-1", "anything")
    assert out["status"] == "ai_not_configured"


def test_ask_data_warehouse_not_configured(monkeypatch):
    monkeypatch.delenv("ANALYTICS_BQ_DATASET", raising=False)
    _install_fake_anthropic(monkeypatch, reply_text=_GOOD_QUERY_JSON)
    out = assistant.ask_data("org-1", "revenue by month")
    assert out["status"] == "warehouse_not_configured"


def test_ask_data_error_when_claude_raises(monkeypatch):
    _install_fake_anthropic(monkeypatch, raises=RuntimeError("claude exploded"))
    run = MagicMock()
    monkeypatch.setattr(assistant.analytics, "_run_warehouse", run)
    out = assistant.ask_data("org-1", "revenue by month")
    assert out["status"] == "error"
    run.assert_not_called()


def test_ask_data_error_when_warehouse_raises(monkeypatch):
    """Valid query, but BigQuery itself fails -> error (not could_not_interpret)."""
    _install_fake_anthropic(monkeypatch, reply_text=_GOOD_QUERY_JSON)
    monkeypatch.setattr(
        assistant.analytics,
        "_run_warehouse",
        MagicMock(side_effect=RuntimeError("bq down")),
    )
    out = assistant.ask_data("org-1", "revenue by month")
    assert out["status"] == "error"


# ── narrative_insights ───────────────────────────────────────────────────────


def test_narrative_insights_returns_summary(monkeypatch):
    summary = "پوختەی کار: داهات بەرزبووەتەوە..."  # Sorani sample
    captured = _install_fake_anthropic(monkeypatch, reply_text=summary)
    # Every analysis returns a canned row set.
    monkeypatch.setattr(
        assistant.analytics,
        "_run_warehouse",
        MagicMock(return_value=[{"month": "2026-01", "total": 100.0, "count": 3}]),
    )

    out = assistant.narrative_insights("org-1", lang="ku")

    assert out["status"] == "ok"
    assert out["summary"] == summary
    # The three fixed analyses were collected and handed to the model.
    assert set(out["data_used"].keys()) == {
        "revenue_by_month",
        "top_customers",
        "bills_by_month",
    }
    # Narrative uses the higher-quality model.
    assert captured["calls"][0]["model"] == assistant.MODEL_NARRATE == "claude-opus-4-8"


def test_narrative_insights_ai_not_configured(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    out = assistant.narrative_insights("org-1")
    assert out["status"] == "ai_not_configured"
    assert out["summary"] is None


def test_narrative_insights_warehouse_not_configured(monkeypatch):
    monkeypatch.delenv("ANALYTICS_BQ_DATASET", raising=False)
    _install_fake_anthropic(monkeypatch, reply_text="x")
    out = assistant.narrative_insights("org-1")
    assert out["status"] == "warehouse_not_configured"


def test_narrative_insights_error_when_claude_raises(monkeypatch):
    _install_fake_anthropic(monkeypatch, raises=RuntimeError("boom"))
    monkeypatch.setattr(
        assistant.analytics, "_run_warehouse", MagicMock(return_value=[])
    )
    out = assistant.narrative_insights("org-1")
    assert out["status"] == "error"


# ── Endpoints: forward the service result, never 500 ─────────────────────────


def test_ask_endpoint_ok(client, monkeypatch):
    _install_fake_anthropic(monkeypatch, reply_text=_GOOD_QUERY_JSON)
    monkeypatch.setattr(
        assistant.analytics,
        "_run_warehouse",
        MagicMock(return_value=[{"month": "2026-01", "total": 7.0}]),
    )
    resp = client.post("/api/ai/ask", json={"question": "revenue by month"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["rows"] == [{"month": "2026-01", "total": 7.0}]


def test_ask_endpoint_ai_not_configured_no_500(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    resp = client.post("/api/ai/ask", json={"question": "anything"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ai_not_configured"


def test_ask_endpoint_rejects_injection_no_500(client, monkeypatch):
    evil = '{"fact": "evil_table", "measures": ["total"]}'
    _install_fake_anthropic(monkeypatch, replies=[evil, evil])
    run = MagicMock()
    monkeypatch.setattr(assistant.analytics, "_run_warehouse", run)
    resp = client.post("/api/ai/ask", json={"question": "drop tables"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "could_not_interpret"
    run.assert_not_called()


def test_insights_endpoint_ok(client, monkeypatch):
    _install_fake_anthropic(monkeypatch, reply_text="کورتەی ڕاپۆرت")
    monkeypatch.setattr(
        assistant.analytics, "_run_warehouse", MagicMock(return_value=[])
    )
    resp = client.get("/api/ai/insights?lang=ku")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["summary"] == "کورتەی ڕاپۆرت"


def test_insights_endpoint_default_lang_no_500(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    resp = client.get("/api/ai/insights")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ai_not_configured"


# ── "any model works": env-configurable model ids ────────────────────────────


def test_model_resolution_defaults(monkeypatch):
    """With no overrides, each task uses its sensible built-in default."""
    for var in ("AI_MODEL", "AI_TRANSLATE_MODEL", "AI_NARRATE_MODEL"):
        monkeypatch.delenv(var, raising=False)
    assert assistant.model_translate() == assistant._DEFAULT_MODEL_TRANSLATE
    assert assistant.model_narrate() == assistant._DEFAULT_MODEL_NARRATE


def test_model_resolution_global_override(monkeypatch):
    """``AI_MODEL`` alone switches BOTH tasks to one model — no code change."""
    for var in ("AI_TRANSLATE_MODEL", "AI_NARRATE_MODEL"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("AI_MODEL", "claude-some-future-model")
    assert assistant.model_translate() == "claude-some-future-model"
    assert assistant.model_narrate() == "claude-some-future-model"


def test_model_resolution_per_task_overrides_global(monkeypatch):
    """Per-task env vars take precedence over the global ``AI_MODEL``."""
    monkeypatch.setenv("AI_MODEL", "global-model")
    monkeypatch.setenv("AI_TRANSLATE_MODEL", "fast-model")
    monkeypatch.setenv("AI_NARRATE_MODEL", "prose-model")
    assert assistant.model_translate() == "fast-model"
    assert assistant.model_narrate() == "prose-model"


def test_ask_data_uses_configured_model(monkeypatch):
    """The model id flowing into ``messages.create`` is the configured one."""
    monkeypatch.setenv("AI_TRANSLATE_MODEL", "my-custom-model")
    captured = _install_fake_anthropic(monkeypatch, reply_text=_GOOD_QUERY_JSON)
    monkeypatch.setattr(
        assistant.analytics, "_run_warehouse", MagicMock(return_value=[])
    )
    out = assistant.ask_data("org-1", "revenue by month")
    assert out["status"] == "ok"
    assert captured["calls"][0]["model"] == "my-custom-model"


# ── "any model works": rich→plain fallback ───────────────────────────────────


def _install_picky_anthropic(monkeypatch, *, reply_text):
    """Fake SDK whose ``messages.create`` REJECTS the rich form.

    It raises ``TypeError`` if called with ``output_config`` or a *list* system
    block (i.e. an older SDK / a model that doesn't support structured output or
    cached system blocks), and only succeeds on the plain form (string ``system``,
    no ``output_config``). This proves ``_create_message`` degrades so any
    model/SDK works. Records calls on the returned ``captured`` dict.
    """
    captured: dict = {"calls": []}
    mod = types.ModuleType("anthropic")

    class _Messages:
        def create(self, **kwargs):
            captured["calls"].append(kwargs)
            if "output_config" in kwargs or isinstance(kwargs.get("system"), list):
                raise TypeError("unexpected keyword argument 'output_config'")
            return _Message(reply_text)

    class Anthropic:
        def __init__(self, *a, **k):
            self.messages = _Messages()

    mod.Anthropic = Anthropic
    monkeypatch.setitem(sys.modules, "anthropic", mod)
    return captured


def test_create_message_falls_back_to_plain_call(monkeypatch):
    """A schema-bearing call on a picky SDK still returns text via the plain form."""
    captured = _install_picky_anthropic(monkeypatch, reply_text="ok")
    client = assistant._anthropic_client()
    msg = assistant._create_message(
        client, model="m", system_text="sys",
        messages=[{"role": "user", "content": "hi"}], max_tokens=8,
        schema={"type": "object"},
    )
    assert assistant._extract_text(msg) == "ok"
    # Two attempts recorded: the rich one (rejected) then the plain one (ok).
    assert len(captured["calls"]) == 2
    assert "output_config" in captured["calls"][0]
    assert "output_config" not in captured["calls"][1]
    assert captured["calls"][1]["system"] == "sys"  # plain string system


def test_ask_data_works_on_model_without_structured_output(monkeypatch):
    """End-to-end: a model that rejects structured output still answers — the
    key 'just works' for any model because we parse JSON-in-text on fallback."""
    _install_picky_anthropic(monkeypatch, reply_text=_GOOD_QUERY_JSON)
    monkeypatch.setattr(
        assistant.analytics,
        "_run_warehouse",
        MagicMock(return_value=[{"month": "2026-01", "total": 5.0}]),
    )
    out = assistant.ask_data("org-1", "revenue by month")
    assert out["status"] == "ok"
    assert out["rows"] == [{"month": "2026-01", "total": 5.0}]


# ── status() + /api/ai/status endpoint ───────────────────────────────────────


def test_status_reports_ok_when_configured(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", "p.ds")
    monkeypatch.setenv("AI_TRANSLATE_MODEL", "t-model")
    monkeypatch.setenv("AI_NARRATE_MODEL", "n-model")
    out = assistant.status()
    assert out["status"] == "ok"
    assert out["ai_configured"] is True
    assert out["warehouse_configured"] is True
    assert out["translate_model"] == "t-model"
    assert out["narrate_model"] == "n-model"
    assert "probe" not in out  # no live call unless asked


def test_status_reports_ai_not_configured(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    out = assistant.status()
    assert out["status"] == "ai_not_configured"
    assert out["ai_configured"] is False


def test_status_probe_makes_live_call_when_configured(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", "p.ds")
    _install_fake_anthropic(monkeypatch, reply_text="ok")
    out = assistant.status(probe=True)
    assert out["probe"]["ok"] is True


def test_status_probe_reports_error_without_raising(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-bad")
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", "p.ds")
    _install_fake_anthropic(monkeypatch, raises=RuntimeError("401 invalid key"))
    out = assistant.status(probe=True)
    assert out["probe"]["ok"] is False
    assert "401" in out["probe"]["error"]


def test_status_endpoint_no_500_when_unconfigured(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    resp = client.get("/api/ai/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ai_not_configured"
    assert body["ai_configured"] is False
    assert "translate_model" in body and "narrate_model" in body


def test_status_endpoint_ok_when_configured(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", "p.ds")
    resp = client.get("/api/ai/status")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
