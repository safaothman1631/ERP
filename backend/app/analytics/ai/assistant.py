"""LLM-powered AI assistant over the safe analytics warehouse (Pool 4.7+ — AI).

Two capabilities, both built **on top of** :mod:`app.api.analytics` so the LLM can
never reach SQL directly:

  * :func:`ask_data` — natural-language Q&A. The user's question (Kurdish / Arabic
    / English) goes to Claude with a system prompt describing *only* the
    ``analytics._FACTS`` whitelist. Claude must reply with a strict JSON object
    matching ``AnalysisDef`` (fact / measures / dimensions / filters / dates /
    order / limit) — **never SQL**. We parse that JSON, build an ``AnalysisDef``,
    and run it through ``analytics._validate`` + ``analytics._run_warehouse``. The
    only thing that ever reaches BigQuery is the validated, whitelisted query —
    a malicious or hallucinated fact/measure is rejected by ``_validate`` (400),
    so the LLM cannot inject a bad query.
  * :func:`narrative_insights` — fetches a few key analyses via ``_run_warehouse``
    (revenue by month, top customers, bills by month) and asks Claude to write a
    short plain-language business summary in the requested language (Sorani
    Kurdish by default).

Design — mirrors :mod:`app.analytics.ai.anomaly` and :mod:`app.api.analytics`:
  * **Lazy SDK import.** ``anthropic`` is imported *inside* the functions, never
    at module load, so this module imports (and the app boots) on machines
    without the SDK installed.
  * **Flag-gated + graceful — NEVER raises to the caller.** Every public function
    returns a dict carrying a ``status``:
      - ``ANTHROPIC_API_KEY`` unset OR the ``anthropic`` SDK missing -> ``ai_not_configured``
      - ``ANALYTICS_BQ_DATASET`` unset (warehouse off) -> ``warehouse_not_configured``
      - any Claude / BigQuery error caught -> ``error``
      - LLM returns invalid JSON / a non-whitelisted field (after one retry) -> ``could_not_interpret``
      - success -> ``ok``

Model choice:
  * NL->query translation uses the cheaper, fast Haiku model (``MODEL_TRANSLATE``)
    — it's a constrained structured-extraction task.
  * The narrative summary uses Opus (``MODEL_NARRATE``) for prose quality.
  Both are current Claude model ids. The system prompt (the large, stable part of
  every request) is sent with ``cache_control`` so repeated calls hit the prompt
  cache.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

from app.api import analytics

log = logging.getLogger("analytics.ai.assistant")

# ── Statuses ─────────────────────────────────────────────────────────────────
STATUS_OK = "ok"
STATUS_AI_NOT_CONFIGURED = "ai_not_configured"
STATUS_WAREHOUSE_NOT_CONFIGURED = "warehouse_not_configured"
STATUS_COULD_NOT_INTERPRET = "could_not_interpret"
STATUS_ERROR = "error"

# ── Model ids (current Claude models) ────────────────────────────────────────
# Cheap, fast model for the constrained NL -> structured-query translation.
MODEL_TRANSLATE = "claude-haiku-4-5"
# Higher-quality model for the plain-language business narrative.
MODEL_NARRATE = "claude-opus-4-8"

_MAX_TOKENS_QUERY = 1024
_MAX_TOKENS_NARRATIVE = 2048


# ── Config / SDK helpers ─────────────────────────────────────────────────────


def ai_enabled() -> bool:
    """The assistant only runs when an Anthropic API key is configured."""
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def warehouse_enabled() -> bool:
    """The warehouse is only queried when its dataset is opted into (same
    contract as :mod:`app.api.analytics` / :mod:`app.analytics.ai.anomaly`)."""
    return bool(os.environ.get("ANALYTICS_BQ_DATASET"))


def _anthropic_client():
    """Return an ``anthropic.Anthropic`` client, or ``None`` if unavailable.

    Lazy import so the module loads without the SDK. Returns ``None`` when the
    SDK is missing or the client can't be constructed (e.g. no key) — callers
    map that to ``ai_not_configured`` and never raise.
    """
    try:
        import anthropic  # lazy, like the bigquery import in anomaly.py
    except Exception:  # pragma: no cover - lib optional in dev/CI
        log.warning("assistant.anthropic_lib_missing — install anthropic")
        return None
    try:
        return anthropic.Anthropic()
    except Exception:  # pragma: no cover - misconfigured key etc.
        log.warning("assistant.anthropic_client_init_failed")
        return None


# ── Whitelist description for the LLM ────────────────────────────────────────


def _facts_catalogue() -> dict[str, Any]:
    """The ``analytics._FACTS`` whitelist reduced to client-facing keys only.

    We expose only the *names* (measure keys, dimension keys, date column) — never
    the SQL expressions behind them — so the model has exactly the vocabulary it
    is allowed to choose from and nothing more.
    """
    out: dict[str, Any] = {}
    for fact, cfg in analytics._FACTS.items():
        out[fact] = {
            "measures": sorted(cfg["measures"].keys()),
            "dimensions": sorted(cfg["dimensions"].keys()),
            "date_col": cfg["date_col"],
        }
    return out


def _system_prompt() -> str:
    """Build the system prompt describing ONLY the whitelist + the output rules.

    Deterministic (sorted keys) so it is byte-stable across requests and the
    ``cache_control`` breakpoint actually hits the prompt cache.
    """
    catalogue = json.dumps(_facts_catalogue(), ensure_ascii=False, sort_keys=True, indent=2)
    return (
        "You are a careful data-analytics query planner for an ERP system used in "
        "Iraq (users write in Kurdish (Sorani), Arabic, or English).\n\n"
        "You translate a natural-language question into a STRICT JSON query object "
        "over a fixed, whitelisted set of fact tables. You do NOT write SQL. You do "
        "NOT invent table, measure, or dimension names. You may ONLY use the exact "
        "keys listed below.\n\n"
        "Available fact tables (measures / dimensions / date column):\n"
        f"{catalogue}\n\n"
        "Reply with a SINGLE JSON object and NOTHING ELSE (no prose, no markdown "
        "fences, no SQL). The object must have this shape:\n"
        "{\n"
        '  "fact": "<one fact table name from the list>",\n'
        '  "measures": ["<one or more measure keys for that fact>"],\n'
        '  "dimensions": ["<zero or more dimension keys for that fact>"],\n'
        '  "filters": {"<dimension key>": "<value>"},\n'
        '  "date_from": "YYYY-MM-DD or null",\n'
        '  "date_to": "YYYY-MM-DD or null",\n'
        '  "order_by": "<a measure or dimension key, or null>",\n'
        '  "order_dir": "ASC or DESC",\n'
        '  "limit": <integer 1..1000>\n'
        "}\n\n"
        "Rules:\n"
        "- measures must be non-empty.\n"
        "- Every measure/dimension/filter/order_by key MUST belong to the chosen "
        "fact table per the list above. If the question cannot be answered with the "
        "available tables and fields, choose the closest sensible fact and a single "
        "count measure rather than inventing fields.\n"
        "- 'revenue'/'sales'/'income' -> fact_invoices. 'expenses'/'purchases'/"
        "'bills' -> fact_bills. 'point of sale'/'POS'/'register' -> fact_pos_orders.\n"
        "- 'by month' -> dimensions:[\"month\"]. 'top'/'biggest' -> set order_by to "
        "the relevant measure, order_dir DESC, and a small limit.\n"
        "- Output ONLY the JSON object."
    )


# ── JSON extraction ──────────────────────────────────────────────────────────


def _extract_text(message: Any) -> str:
    """Concatenate the text blocks of an Anthropic ``Message`` response."""
    parts: list[str] = []
    for block in getattr(message, "content", []) or []:
        if getattr(block, "type", None) == "text":
            parts.append(getattr(block, "text", "") or "")
    return "".join(parts).strip()


def _parse_query_json(text: str) -> Optional[dict]:
    """Parse the model's reply into a query dict, tolerating stray wrapping.

    Returns ``None`` if no JSON object can be recovered. Handles a clean object,
    a ```json fenced block, or an object embedded in surrounding prose by slicing
    the outermost ``{ ... }``.
    """
    if not text:
        return None
    candidate = text.strip()
    # Strip a markdown code fence if the model added one despite instructions.
    if candidate.startswith("```"):
        candidate = candidate.strip("`")
        if candidate.lower().startswith("json"):
            candidate = candidate[4:]
        candidate = candidate.strip()
    try:
        obj = json.loads(candidate)
        return obj if isinstance(obj, dict) else None
    except (ValueError, TypeError):
        pass
    # Fall back to the outermost brace span.
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            obj = json.loads(candidate[start : end + 1])
            return obj if isinstance(obj, dict) else None
        except (ValueError, TypeError):
            return None
    return None


def _ask_claude_for_query(client: Any, question: str) -> Optional[dict]:
    """Send the question to Claude and return the parsed query dict (or None).

    Uses structured-output (``output_config.format``) so the model is constrained
    to emit a JSON object; the system prompt is cached. Any SDK error propagates
    to the caller (which maps it to ``status: error``)."""
    message = client.messages.create(
        model=MODEL_TRANSLATE,
        max_tokens=_MAX_TOKENS_QUERY,
        system=[
            {
                "type": "text",
                "text": _system_prompt(),
                "cache_control": {"type": "ephemeral"},
            }
        ],
        output_config={
            "format": {
                "type": "json_schema",
                "schema": {
                    "type": "object",
                    "properties": {
                        "fact": {"type": "string"},
                        "measures": {"type": "array", "items": {"type": "string"}},
                        "dimensions": {"type": "array", "items": {"type": "string"}},
                        "filters": {"type": "object", "additionalProperties": True},
                        "date_from": {"type": ["string", "null"]},
                        "date_to": {"type": ["string", "null"]},
                        "order_by": {"type": ["string", "null"]},
                        "order_dir": {"type": "string", "enum": ["ASC", "DESC"]},
                        "limit": {"type": "integer"},
                    },
                    "required": ["fact", "measures"],
                    "additionalProperties": True,
                },
            }
        },
        messages=[{"role": "user", "content": question}],
    )
    return _parse_query_json(_extract_text(message))


def _build_and_run(query: dict, org_id: str) -> tuple[Optional[list[dict]], dict]:
    """Validate a query dict against the whitelist and run it on the warehouse.

    Returns ``(rows, analysis_dict)``. Raises ``analytics.HTTPException`` (400)
    or pydantic ``ValidationError`` when the dict is not a valid, whitelisted
    ``AnalysisDef`` — the caller treats that as "the LLM gave us something bad".
    ``rows`` is ``None`` when the warehouse is off (``_run_warehouse`` signal).
    """
    defn = analytics.AnalysisDef(**query)
    fact = analytics._validate(defn)  # HTTPException(400) on a non-whitelist field
    rows = analytics._run_warehouse(defn, fact, org_id)
    return rows, defn.model_dump()


# ── Public API ───────────────────────────────────────────────────────────────


def ask_data(org_id: str, question: str) -> dict:
    """Answer a natural-language data question via Claude + the safe warehouse.

    Pipeline: question -> Claude (whitelist-only system prompt) -> strict JSON ->
    ``AnalysisDef`` -> ``_validate`` -> ``_run_warehouse``. The LLM never touches
    SQL; only a validated whitelist query reaches BigQuery.

    Returns ``{question, query, rows, status}``:
      - ``ai_not_configured`` if no key / SDK,
      - ``warehouse_not_configured`` if ``ANALYTICS_BQ_DATASET`` unset,
      - ``could_not_interpret`` if the model's JSON is invalid or off-whitelist
        (after one retry),
      - ``error`` on any Claude/BQ failure,
      - ``ok`` with ``rows`` otherwise.
    Never raises.
    """
    base = {"question": question, "query": None, "rows": [], "status": STATUS_OK}

    if not ai_enabled():
        base["status"] = STATUS_AI_NOT_CONFIGURED
        return base
    if not warehouse_enabled():
        base["status"] = STATUS_WAREHOUSE_NOT_CONFIGURED
        return base

    client = _anthropic_client()
    if client is None:
        base["status"] = STATUS_AI_NOT_CONFIGURED
        return base

    # Try once, then retry once on invalid-JSON / off-whitelist before giving up.
    last_reason = "no_response"
    for attempt in range(2):
        try:
            query = _ask_claude_for_query(client, question)
        except Exception as exc:  # Claude/SDK failure -> graceful error
            log.warning("ask_data.claude_failed attempt=%s: %s", attempt, exc)
            base["status"] = STATUS_ERROR
            base["error"] = str(exc)
            return base

        if not query:
            last_reason = "unparseable_json"
            continue

        try:
            rows, analysis = _build_and_run(query, org_id)
        except analytics.HTTPException as exc:  # non-whitelist field -> reject
            last_reason = f"invalid_query: {exc.detail}"
            log.info("ask_data.llm_off_whitelist attempt=%s: %s", attempt, exc.detail)
            continue
        except Exception as exc:  # pydantic ValidationError or BQ error
            # A pydantic validation error means the LLM's shape was wrong -> retry;
            # a genuine warehouse error means the query was fine but BQ failed.
            if exc.__class__.__name__ == "ValidationError":
                last_reason = "schema_validation"
                log.info("ask_data.llm_bad_schema attempt=%s", attempt)
                continue
            log.warning("ask_data.warehouse_failed: %s", exc)
            base["status"] = STATUS_ERROR
            base["error"] = str(exc)
            return base

        # Success — _run_warehouse returns None only when the warehouse is off,
        # which we already gated above; treat a late None as empty rows.
        base["query"] = analysis
        base["rows"] = rows if rows is not None else []
        base["status"] = STATUS_OK
        return base

    base["status"] = STATUS_COULD_NOT_INTERPRET
    base["reason"] = last_reason
    return base


# ── Narrative insights ───────────────────────────────────────────────────────

# The fixed set of analyses summarised by :func:`narrative_insights`. Each is a
# plain ``AnalysisDef`` kwargs dict — all keys are whitelisted, so they pass
# ``_validate`` unchanged.
_NARRATIVE_ANALYSES: dict[str, dict] = {
    "revenue_by_month": {
        "fact": "fact_invoices",
        "measures": ["total", "count"],
        "dimensions": ["month"],
        "order_by": "month",
        "order_dir": "ASC",
        "limit": 24,
    },
    "top_customers": {
        "fact": "fact_invoices",
        "measures": ["total"],
        "dimensions": ["contact_name"],
        "order_by": "total",
        "order_dir": "DESC",
        "limit": 10,
    },
    "bills_by_month": {
        "fact": "fact_bills",
        "measures": ["total", "count"],
        "dimensions": ["month"],
        "order_by": "month",
        "order_dir": "ASC",
        "limit": 24,
    },
}

_LANG_NAMES = {
    "ku": "Sorani Kurdish (کوردیی ناوەندی)",
    "ckb": "Sorani Kurdish (کوردیی ناوەندی)",
    "ar": "Arabic (العربية)",
    "en": "English",
}


def _collect_narrative_data(org_id: str) -> dict[str, list[dict]]:
    """Run the fixed narrative analyses against the warehouse.

    Returns ``{key: rows}``. Each analysis is validated then executed via
    ``_run_warehouse``; a ``None`` result (warehouse off) becomes an empty list.
    Raises on a genuine warehouse error so the caller maps it to ``error``.
    """
    data: dict[str, list[dict]] = {}
    for key, kwargs in _NARRATIVE_ANALYSES.items():
        defn = analytics.AnalysisDef(**kwargs)
        fact = analytics._validate(defn)
        rows = analytics._run_warehouse(defn, fact, org_id)
        data[key] = rows if rows is not None else []
    return data


def _narrative_system_prompt(lang: str) -> str:
    """System prompt instructing Claude to write the summary in ``lang``."""
    lang_name = _LANG_NAMES.get((lang or "ku").lower(), _LANG_NAMES["ku"])
    return (
        "You are a financial analyst writing a concise business summary for the "
        "owner of a small/medium business in Iraq. You are given pre-computed "
        "analytics (revenue by month, top customers, expenses/bills by month) as "
        "JSON.\n\n"
        f"Write the ENTIRE response in {lang_name}. Use clear, plain language a "
        "non-accountant can understand. Use the actual numbers from the data; do "
        "NOT invent figures. If a dataset is empty, say there is not enough data "
        "for that area rather than guessing.\n\n"
        "Structure: 3-5 short observations (trends, notable months, concentration "
        "among top customers, revenue-vs-expense balance), then 2-3 practical "
        "recommendations. Keep it brief and skimmable."
    )


def narrative_insights(org_id: str, lang: str = "ku") -> dict:
    """Generate a plain-language business summary in the requested language.

    Fetches a few key analyses via ``_run_warehouse`` then asks Claude to write a
    concise summary (3-5 observations + 2-3 recommendations) in ``lang`` (Sorani
    Kurdish by default).

    Returns ``{summary, data_used, status}``:
      - ``ai_not_configured`` / ``warehouse_not_configured`` as above,
      - ``error`` on any failure,
      - ``ok`` with the ``summary`` text otherwise.
    Never raises.
    """
    base: dict[str, Any] = {"summary": None, "data_used": {}, "status": STATUS_OK}

    if not ai_enabled():
        base["status"] = STATUS_AI_NOT_CONFIGURED
        return base
    if not warehouse_enabled():
        base["status"] = STATUS_WAREHOUSE_NOT_CONFIGURED
        return base

    client = _anthropic_client()
    if client is None:
        base["status"] = STATUS_AI_NOT_CONFIGURED
        return base

    try:
        data = _collect_narrative_data(org_id)
    except Exception as exc:  # warehouse/BQ failure -> graceful error
        log.warning("narrative_insights.warehouse_failed: %s", exc)
        base["status"] = STATUS_ERROR
        base["error"] = str(exc)
        return base

    base["data_used"] = data
    payload = json.dumps(data, ensure_ascii=False, sort_keys=True, default=str)

    try:
        message = client.messages.create(
            model=MODEL_NARRATE,
            max_tokens=_MAX_TOKENS_NARRATIVE,
            system=[
                {
                    "type": "text",
                    "text": _narrative_system_prompt(lang),
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": f"Here is the analytics data as JSON:\n{payload}",
                }
            ],
        )
    except Exception as exc:  # Claude/SDK failure -> graceful error
        log.warning("narrative_insights.claude_failed: %s", exc)
        base["status"] = STATUS_ERROR
        base["error"] = str(exc)
        return base

    base["summary"] = _extract_text(message)
    base["status"] = STATUS_OK
    return base
