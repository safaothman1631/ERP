# Parity Advisory Report Template

Use this structure for every advisory response.

```markdown
# [Module/Topic] — Odoo Parity Advisory

**Date:** YYYY-MM-DD  
**Scope:** [e.g. Inventory, Full ERP, POS offline]  
**Current score:** X.X / 5.0 → **Target:** Y.Y / 5.0

---

## Executive summary

- [3–5 bullets: what's wrong, what's good, top action]

---

## Current state (evidence)

| Area | Status | Evidence |
|------|--------|----------|
| Backend API | … | `path/to/file.py` |
| Business logic | … | `path/to/service.py` |
| UI | … | `path/to/page.tsx` |
| Tests | … | `tests/test_*.py` |
| Scorecard | … | COMPETITIVE_SCORECARD.md §… |

---

## Odoo reference behavior

**Source:** `odoo-docs-19/...` or Odoo-Logic-Complete-KU.md §…

1. [How Odoo does it — workflow, states, invariants]
2. [Key models / rules Odoo enforces]

---

## Gap analysis

| # | Gap | Odoo | You | Score | Priority | Effort |
|---|-----|------|-----|-------|----------|--------|
| 1 | … | … | … | 0–5 | P0/P1/P2 | S/M/L |

---

## Recommended actions (ordered)

### Phase 1 — P0 (do first)

1. **[Title]**
   - Why: …
   - Files: `…`
   - Acceptance: …
   - Agent: `erp-*` or `zoho-backend`

### Phase 2 — P1

…

### Phase 3 — P2 (defer)

…

---

## Architecture notes

- [How to adapt Odoo pattern to Firestore + FastAPI + multi-tenant]
- [What NOT to copy from Odoo]

---

## Test plan

- [ ] Unit: …
- [ ] Integration: …
- [ ] RBAC: …
- [ ] E2E: …

---

## Risks if skipped

- [Sale blocker / data integrity / trust]

---

## Quick win vs strategic bet

| Quick win (≤1 week) | Strategic bet (≥1 month) |
|---------------------|--------------------------|
| … | … |
```

## Tone

- Direct, actionable, Kurdish if user uses Kurdish
- No vague "improve inventory" — name endpoints, collections, permissions
- Always separate **config** (credentials) from **missing code**
