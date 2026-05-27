# Tasks: Empty State + Quick Create — Phased Execution Plan

> **Spec ID:** `empty-state-quick-create`
> **Companion to:** `requirements.md`, `design.md`
> **Status:** Draft v1.0
> **Owner:** Safa Othman
> **Total surfaces:** 76 (42 selectors + 8 lists + 12 drawers + 14 subforms)
> **Estimated calendar:** 6–8 weeks for 100% migration with 1 FE + 1 designer; 10–12 weeks for one developer alone.

---

## Phase overview

| Phase | Theme | Calendar | Surfaces migrated | Cumulative coverage |
|-------|-------|----------|-------------------|---------------------|
| **EP-0** | Primitives + Registry | Week 1 | 0 | 0% |
| **EP-1** | Top-7 selectors (accounting core) | Week 2-3 | 7 | 9% |
| **EP-2** | Class A long-tail | Week 3-4 | 15 | 29% |
| **EP-3** | Class B drawer entities | Week 4-5 | 6 | 37% |
| **EP-4** | List pages + search-empty | Week 5-6 | 14 | 56% |
| **EP-5** | Subforms + drawers + Class C | Week 6-7 | 21 | 84% |
| **EP-6** | Long tail + lint ratchet + flag retirement | Week 7-8 | 13 | 100% |

> Phases overlap where dependencies allow. EP-0 must complete before EP-1.

---

## Phase EP-0 — Primitives + Registry (Week 1)

> **Exit criteria:** `<EmptyState>` renders in Storybook for all 5 variants. `quickCreateRegistry.ts` has 7 entries with full schemas. Motion + telemetry plumbing live. Feature flag `ui.empty_state_v2` plumbed (default OFF). Zero production user-facing change yet.

### T-E.0.1 — Build `<EmptyState>` primitive

- Create `frontend/src/design-system/empty/EmptyState.tsx` per design §1.1.
- Create `frontend/src/design-system/empty/EmptyStateIllustration.tsx` with 8 inlined SVGs (source: Tabler / Phosphor, simplified to 2 colors via CSS vars).
- Create `frontend/src/design-system/empty/EmptyState.css` with the design-token spacing.
- Create `frontend/src/design-system/empty/types.ts` with the full `EmptyStateProps` type.
- Bundle budget: ≤ 8 KB gzipped (assert with `scripts/check-shell-size.mjs` post-build).
- Add to the always-loaded shell.
- Add Vitest unit tests for: renders all variants, fires telemetry on mount + CTA click, respects permission gate.
- **Acceptance:** the 5 variants render in Storybook (or a temporary dev page) for both LTR and RTL.
- **Effort:** 2.5 days. **Owner:** FE.

### T-E.0.2 — Build `<StateSwitch>` + `<ErrorState>` + `<LoadingState>`

- Create the three components in `frontend/src/design-system/empty/`.
- `<StateSwitch>` enforces the loading/empty/error/populated state machine.
- Add an ESLint rule `local/state-switch-required` that flags direct `<EmptyState>` usage outside `<StateSwitch>`.
- **Acceptance:** unit tests cover the state-transition matrix; lint rule fires on test fixtures.
- **Effort:** 1 day. **Owner:** FE.

### T-E.0.3 — Motion tokens

- Create `frontend/src/design-system/empty/motion.ts` per design §5.
- Verify all motion respects `useReducedMotion()`.
- Add a Vitest snapshot for the motion variants (assert exact spring values stay stable).
- **Acceptance:** motion preview renders smoothly; reduced-motion fallback verified by toggling the media query in DevTools.
- **Effort:** 0.5 day. **Owner:** FE.

### T-E.0.4 — Telemetry plumbing

- Create `frontend/src/design-system/empty/useEmptyStateTelemetry.ts` per design §6.1.
- Verify events land in the existing RUM ingest (`/api/rum/vitals`) — extend the schema to accept the new event names (additive; no breaking change).
- Add backend support in `backend/app/services/rum_ingest.py` for the new event types (or just allow the existing free-form `event` field).
- **Acceptance:** triggering each event fires a network request with correct payload (verified via DevTools Network).
- **Effort:** 1 day. **Owner:** FE + BE.

### T-E.0.5 — Per-entity registry — seven seed entries

- Create `frontend/src/data/quickCreateRegistry.ts` per design §2.1.
- Seed entries: `customer`, `vendor`, `tax_rate`, `expense_category`, `item`, `account`, `team`.
- Each entry has full field schema + apiCreate + permission + fullFormHref.
- Document per-entry: class, reasoning, owner, first-migration-PR placeholder.
- Add unit tests asserting every registry entry conforms to the `QuickCreateConfig` type and that `fields` is non-empty for class A/B.
- **Acceptance:** type-check passes; 7 entries fully populated; documentation comment block on each.
- **Effort:** 2 days. **Owner:** FE.

### T-E.0.6 — `<QuickCreateModal>` skeleton

- Create `frontend/src/design-system/empty/QuickCreateModal.tsx` per design §3.1.
- Implements: open animation, dynamic form rendering from registry config, optimistic merge on success, error display, full-form link, cancel-confirm if dirty.
- Lazy-loaded via dynamic import (`lazyWithRetry`).
- Bundle budget: ≤ 12 KB gzipped per quick-create entity chunk.
- **Acceptance:** opens for a test entity; form renders; submit hits a mock endpoint; success closes; cancel confirms if dirty.
- **Effort:** 2 days. **Owner:** FE.

### T-E.0.7 — `<QuickCreateDrawer>` skeleton

- Create `frontend/src/design-system/empty/QuickCreateDrawer.tsx` per design §3.2.
- Implements: side-drawer animation, sectioned form, "Save & Add another".
- **Acceptance:** drawer slides in; multi-section form renders for `item`; "Save & Add another" resets correctly.
- **Effort:** 2 days. **Owner:** FE.

### T-E.0.8 — Feature-flag plumbing

- Wire `ui.empty_state_v2` via existing `useFeatureFlag` hook.
- Wire `ui.empty_state_v2.<entity>` per-entity overrides.
- Default OFF in `frontend/src/api/featureFlags.ts`.
- **Acceptance:** flipping the flag in dev tools toggles the new pattern on a test surface.
- **Effort:** 0.5 day. **Owner:** FE.

### T-E.0.9 — i18n keys baseline

- Add base i18n keys to `frontend/src/locales/ku.json`, `en.json`, `ar.json` for all 7 seed entities: `qc.<entity>.title`, `qc.<entity>.description`, `qc.<entity>.cta`, plus `empty.search_no_results`, `empty.search_clear`, `qc.action.create_and_select`, `qc.action.full_form`, `qc.action.save_and_add_another`.
- Run `npm run i18n:coverage` to confirm parity across ku/en/ar.
- **Acceptance:** coverage script reports 100% on the new keys across all 3 locales.
- **Effort:** 1 day (translation pass). **Owner:** Translator + FE.

### T-E.0.10 — Audit script + lint ratchet

- Create `scripts/audit-empty-states.mjs` that enumerates remaining unmigrated `<Select>` instances by AST walk.
- Output: markdown table of file:line, entity guess, migration status.
- Wire to CI as advisory output on every PR.
- Add ESLint rule `local/empty-state-required` that flags raw `<Empty />` outside `<EmptyState>`.
- **Acceptance:** the audit script produces an accurate count matching `_deltas/empty-state-audit.md`.
- **Effort:** 1 day. **Owner:** FE.

### T-E.0.11 — Storybook setup (or simple dev gallery)

- If Storybook isn't installed: create a simple route `/dev/empty-states` (gated by `process.env.NODE_ENV === 'development'`) that renders every variant × locale × theme.
- Visual sanity check.
- **Acceptance:** the dev page lists 5 variants × 2 locales = 10 states, all rendering correctly.
- **Effort:** 1 day. **Owner:** FE.

---

## Phase EP-1 — Top-7 selectors (Week 2-3)

> **Exit criteria:** The 7 highest-impact selectors per `_deltas/empty-state-audit.md` §8 are migrated. Internal dogfooding starts. Feature flag enabled for dev tenants.

### T-E.1.1 — Build `<SelectWithQuickCreate>` HOC

- Create `frontend/src/design-system/empty/SelectWithQuickCreate.tsx` per design §4.1.
- Wraps Antd `Select`; reads entity config from registry; manages search state; opens modal on CTA.
- Pre-fills the modal's primary text field from the current search query.
- Optimistic merge on success — new option pushed to top of list with highlight pulse.
- Add Vitest tests: opens modal on empty + CTA click; pre-fills from search; auto-selects on success.
- **Acceptance:** the HOC renders correctly in the dev gallery for `customer` entity.
- **Effort:** 2 days. **Owner:** FE.

### T-E.1.2 — Migrate `InvoiceForm.tsx` customer selector *(Rank 1)*

- Replace the inline `<Select>` for `contact_id` with `<SelectWithQuickCreate entity="customer" />`.
- Add a Playwright snapshot test: open `/invoices/new` with zero contacts → empty state appears → click CTA → modal opens → submit → invoice form has the new customer selected.
- Update unit tests if they assert on the old DOM structure.
- **Acceptance:** Playwright test green; bundle-size diff acceptable (+~3 KB).
- **Effort:** 0.5 day. **Owner:** FE.

### T-E.1.3 — Migrate `InvoiceForm.tsx` item selector *(Rank 2)*

- Replace `<Select>` for `item_id` in line items with `<SelectWithQuickCreate entity="item" />`.
- Item is Class B → opens drawer.
- Verify the drawer doesn't conflict with the form's modal context (z-index management).
- **Acceptance:** Playwright test for the line-item empty → quick-create → auto-selected.
- **Effort:** 0.5 day. **Owner:** FE.

### T-E.1.4 — Migrate `QuoteForm.tsx` *(Ranks 3 + 4)*

- Customer and Item selectors — same pattern.
- Reuse the codemod from T-E.1.1's helper.
- **Acceptance:** Playwright tests for both.
- **Effort:** 0.5 day. **Owner:** FE.

### T-E.1.5 — Migrate `BillForm.tsx` *(Ranks 5 + 6)*

- Vendor and Item selectors.
- Vendor reuses the contact registry entry with `contact_type='vendor'` default.
- **Acceptance:** Playwright tests for both.
- **Effort:** 0.5 day. **Owner:** FE.

### T-E.1.6 — Migrate `ItemForm.tsx` tax selector *(Rank 7)*

- Replace `<Select>` for `tax_id` with `<SelectWithQuickCreate entity="tax_rate" />`.
- Tax is Class A → modal.
- **Acceptance:** Playwright test green.
- **Effort:** 0.5 day. **Owner:** FE.

### T-E.1.7 — Internal dogfooding

- Enable `ui.empty_state_v2` for the dev tenant.
- Walk through 5 end-to-end flows: create-new-tenant onboarding (empty everything) → invoice → quote → bill → adjust tax in item.
- Collect feedback in a notion doc; file follow-up tickets.
- **Acceptance:** Tech lead signs off after 1 day of dogfooding.
- **Effort:** 1 day. **Owner:** Tech lead.

---

## Phase EP-2 — Class A long-tail (Week 3-4)

> **Exit criteria:** 15 cumulative selectors migrated. All Class A entities have working quick-create. Conversion telemetry showing in dashboard.

### T-E.2.1 — Migrate `ExpenseForm.tsx` category selector

- Class A entity `expense_category`.
- **Effort:** 0.5 day.

### T-E.2.2 — Migrate `SubscriptionsList.tsx` customer + plan selectors

- Customer reuses; Plan is Class B → drawer.
- **Effort:** 1 day.

### T-E.2.3 — Migrate Rental, Repair, Field-Service customer selectors

- All reuse `customer` entry — no new registry work.
- 3 files × 0.5 day = 1.5 days.

### T-E.2.4 — Migrate `IoTDevices.tsx` location selector

- Class B `location` entity.
- **Effort:** 0.5 day.

### T-E.2.5 — Migrate `Equipment.tsx` category selector

- Reuse the `expense_category` pattern, but seed `equipment_category` in registry as Class A.
- **Effort:** 0.5 day.

### T-E.2.6 — Migrate `BankReconciliation.tsx` account selector *(Rank 9)*

- Class B `bank_account` entity.
- **Effort:** 0.5 day.

### T-E.2.7 — Add 4 more Class A registry entries

- `currency`, `tag`, `payment_method`, `expense_category` (if not seeded).
- **Effort:** 1 day.

### T-E.2.8 — Dashboard publish + first conversion read

- Stand up the `empty-state-funnel` Cloud Monitoring dashboard.
- Read first 7-day conversion data.
- **Acceptance:** ≥ 50% CTA-clicked rate for Class A; ≥ 80% modal-succeeded rate.
- **Effort:** 1 day. **Owner:** DevOps + FE.

---

## Phase EP-3 — Class B drawer entities (Week 4-5)

> **Exit criteria:** All 6 Class B entities have battle-tested drawers. Multi-step Steps indicator working for long forms.

### T-E.3.1 — Polish `<QuickCreateDrawer>` with Steps indicator

- For entities with > 8 fields, render a vertical Steps indicator on the left.
- Sections defined in registry config (e.g., Item: "Basic", "Pricing", "Accounting", "Inventory").
- Save validates per-section; user can navigate between sections without losing data.
- **Effort:** 2 days.

### T-E.3.2 — Migrate `TicketsList.tsx` team selector + ItemForm income/expense accounts *(Ranks 8 + 11)*

- Team is Class B with member multi-select inside the drawer.
- **Effort:** 1 day.

### T-E.3.3 — Migrate Bank Account + Subscription Plan + Location quick-create

- Already partially seeded from EP-2; finish their drawers.
- **Effort:** 1 day.

### T-E.3.4 — File / image upload in drawer

- Item has an image field. Drawer supports drag-drop image upload with preview.
- Uses existing Firebase Storage uploader if available; else placeholder upload to backend.
- **Effort:** 1.5 days.

### T-E.3.5 — "Save & Add another" telemetry

- Track how often users use this path.
- Surface in dashboard.
- **Effort:** 0.25 day.

---

## Phase EP-4 — List pages + search-empty (Week 5-6)

> **Exit criteria:** All 8 list pages have proper empty states. Search-empty distinct from data-empty everywhere.

### T-E.4.1 — Build `<ListWithEmptyState>`

- HOC wrapping `ResponsiveTable` per design §4.2.
- Empty variant uses 96px illustration, larger title, both primary + secondary CTAs.
- **Effort:** 1 day.

### T-E.4.2 — Migrate `PatientsList`, `CompaniesList`, `CAPAList` *(top 3)*

- Each gets a proper empty state + CTA that opens the existing FormDialog (no new modal needed).
- **Effort:** 1 day total.

### T-E.4.3 — Migrate `CustomReportsList`, `WorkflowsList`, `TicketsList`, `SubscriptionsList`

- Same pattern.
- **Effort:** 1 day total.

### T-E.4.4 — Search-empty variant everywhere

- In every `<SelectWithQuickCreate>`, when search term is non-empty AND results are empty, render search-empty with "Clear search" and (per OQ-1 decision) optionally "Create '<query>' as new".
- **Effort:** 1 day.

### T-E.4.5 — System-generated empty states (Anomalies, audit logs)

- These have NO CTA — but they need a descriptive empty state, not "No data".
- "No anomalies detected" / "All clear" — positive framing.
- **Effort:** 0.5 day.

### T-E.4.6 — Mid-rollout audit

- Run `scripts/audit-empty-states.mjs` — record cumulative migration progress.
- File any newly-discovered empty states.
- **Effort:** 0.25 day.

---

## Phase EP-5 — Subforms, drawers, Class C (Week 6-7)

> **Exit criteria:** All 14 subforms + 4 drawer-with-CTA + Class C navigation pattern working.

### T-E.5.1 — Build `<SubformWithEmptyState>`

- HOC for in-form repeating sections.
- "+ Add first item" CTA inline at section position.
- **Effort:** 1 day.

### T-E.5.2 — Migrate restaurant `MenuManager` + `QCPlans`

- Both have repeating-row subforms.
- Quick-add dish / quick-add QC check.
- **Effort:** 1.5 days.

### T-E.5.3 — Build `<RelatedDataPanel>` for drawers

- Activity log, payment history, maintenance schedule, etc.
- Empty state without CTA by default; opt-in CTA per panel.
- **Effort:** 1 day.

### T-E.5.4 — Migrate 4 drawer panels

- Equipment detail (maintenance schedule), Rental contract (payment schedule), Service order (tasks), Subscription detail (billing history).
- **Effort:** 1 day.

### T-E.5.5 — Class C navigate-with-return-token

- Implement `saveReturnContext()` per design §3.3 in `frontend/src/utils/returnContext.ts`.
- Implement the destination-page handler that reads `?returnTo=` and rehydrates state on save.
- Apply to Employee creation (the lone Class C entity from the audit).
- **Effort:** 1.5 days.

### T-E.5.6 — Test the Class C round-trip

- Playwright: open ticket → assign-to dropdown empty → click "Add employee" → navigate to HR new-employee form → save → return to ticket form with assignment filled.
- **Effort:** 0.5 day.

---

## Phase EP-6 — Long tail + ratchet + retire flag (Week 7-8)

> **Exit criteria:** All 76 surfaces migrated; flag retired (always-on); audit script reports zero unmigrated; default Antd empty banned in CI.

### T-E.6.1 — Migrate remaining 13 selectors from the long tail

- The audit's bottom-half selectors (Ranks 12-30 minus those already done).
- These are lower-traffic; can be batched 3-4 per day.
- **Effort:** 3 days.

### T-E.6.2 — Ban default Antd empty

- Add an ESLint rule + a Playwright snapshot regex that fails CI if "No data" appears in any user-facing screenshot.
- Run snapshot diff across the top-30 routes in 3 locales.
- **Effort:** 1 day.

### T-E.6.3 — Retire feature flag

- Default `ui.empty_state_v2` to ON in all environments.
- Schedule the removal of the flag check and the legacy fallback (one PR per surface, batched).
- **Effort:** 0.5 day for the flag flip; 2 days spread for cleanup PRs.

### T-E.6.4 — Final conversion read

- 28-day window of telemetry post-100%-rollout.
- Read per-entity conversion: `shown` → `cta_clicked` → `succeeded`.
- File follow-up tickets for any entity below the 70% / 90% targets in Requirements §12.3.
- **Effort:** 0.5 day reading + ad-hoc fixes.

### T-E.6.5 — Developer guide

- Write `docs/ui/empty-state-quick-create.md` per Requirements §16.
- Include: how to add a new entity, when to use modal vs drawer vs navigate, copy-writing rules, illustration usage, A11y checklist, telemetry instrumentation.
- **Effort:** 1 day.

### T-E.6.6 — Spec graduation

- All acceptance criteria green.
- Spec marked Complete.
- Any remaining items become entries in a follow-on spec (probably "Quick Create — bulk import + onboarding wizard" — out of scope today).
- **Effort:** 0.5 day.

---

## Cross-cutting tasks (continuous)

### T-E.X.1 — Translation maintenance

- Every new entity adds 5-8 i18n keys.
- Arabic translation is on the critical path — same OQ-5 sourcing decision applies as for the P5 spec.
- **Owner:** Translator.

### T-E.X.2 — Snapshot baseline maintenance

- After visual changes to motion or layout, update Playwright snapshot baselines via the manual workflow.
- **Owner:** Whoever lands the change.

### T-E.X.3 — Bundle-size watch

- After each migration PR, the bundle-diff bot reports chunk-size delta.
- A regression > 5 KB on the shell or > 15 KB on a feature chunk requires a justification comment.
- **Owner:** Reviewer.

### T-E.X.4 — Telemetry health-check

- Weekly: verify all 7 event types are landing in BigQuery.
- File a P1 ticket if any event drops to zero for > 2 days.
- **Owner:** Rotating.

---

## Decision tasks (Open Questions from design §13)

| OQ | Question | Decision needed by | Owner |
|----|----------|---------------------|-------|
| OQ-1 | Default vs opt-in "Create '<query>' as new" search-empty CTA | Start EP-4 | Tech lead + Product |
| OQ-2 | Inline SVG vs `/public/` cached illustrations | Mid EP-0 | FE |
| OQ-3 | Dark-mode illustrations | End EP-0 | Designer (if any) |
| OQ-4 | Multi-step Drawer Steps from day one vs Phase EP-3 polish | Start EP-2 | FE + Tech lead |
| OQ-5 | Auto-generate Playwright snapshot baselines | Start EP-1 | FE + QA |

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Quick-create modal feels like a workaround that doesn't reduce abandonment | Medium | High | Dogfood after EP-1; iterate based on real conversion telemetry; if numbers don't move, escalate the design. |
| Server-side create endpoints reject quick-create payloads (e.g., require fields not in quick-create) | High at first | Medium | Audit backend Pydantic models per entity before migration; if server requires a field, add it to the quick-create. |
| Bundle bloat from 14 dynamic-form schemas | Medium | Medium | Tree-shake per entity; lazy-load modal chunks; verify with bundle-diff bot. |
| Motion feels janky on low-end Android | Medium | Medium | Real-device test on a 4-year-old Samsung A-series in EP-1 dogfooding; tune spring constants. |
| Class C return-token state-restoration loses fields on long forms | Medium | High | sessionStorage instead of URL params; expire after 1 hour; test with a 40-field form. |
| Translation lag (Arabic at 33% per P5) blocks ship of entities | High | Low | Per Requirements §10.2: don't ship an entity's QC UI until Arabic parity. Either fast-track translation or accept staged ship. |
| Optimistic merge gets stale if server modifies the record post-save (e.g., adds default fields) | Low | Low | The apiCreate returns the full record; we merge that, not the form values. |
| Telemetry event names collide with existing | Low | Low | Namespaced under `empty_state.*` and `quick_create.*`; verify no collision in BigQuery before ship. |
| Permission gate UX (Request access) is unfamiliar to users | Medium | Low | Track `permission_gate_shown` event; if Request-access click rate is < 5%, simplify the copy. |
| Quick-create modal becomes a kitchen-sink ("just add this one more field") | High | High | Strict gate-keeping: registry PRs require an ADR if fields exceed the class limit; review at quarterly meeting. |

---

## Success metrics restated

At end of EP-6, the following must be true on production over a 28-day rolling window:

| Metric | Target | Status |
|--------|--------|--------|
| Surfaces migrated | 76 / 76 (100%) | ☐ |
| Conversion: `shown` → `cta_clicked` | ≥ 70% (Class A) | ☐ |
| Conversion: `opened` → `succeeded` | ≥ 90% | ☐ |
| User abandonment rate on invoice / quote / bill first-time create | -20% vs pre-spec baseline | ☐ |
| Bundle: shell delta | ≤ +8 KB gzipped | ☐ |
| Bundle: per-quick-create chunk | ≤ 12 KB gzipped | ☐ |
| Modal first-paint | ≤ 200 ms p75 | ☐ |
| A11y: zero serious/critical violations | per surface | ☐ |
| i18n: 100% coverage ku/en/ar | per entity | ☐ |
| Default Antd "No data" appearances | 0 user-facing | ☐ |
| Feature flag `ui.empty_state_v2` | retired | ☐ |
| Developer guide | published | ☐ |

Tick boxes get filled in at exit reviews. The spec is *done* only when all 12 are checked.

---

## How to use this document

1. **At sprint planning:** Pick 1–3 task IDs from the current phase. Each is sized for 1–3 working days for one engineer.
2. **At PR review:** Cite the task ID in the PR. Reviewer verifies acceptance + telemetry event landed in dashboard.
3. **At phase exit:** Tech lead runs `scripts/audit-empty-states.mjs --check` and confirms cumulative coverage matches.
4. **For new entities not in the audit:** Add to `quickCreateRegistry.ts` with the documentation block, file a new T-E.X.X task.
5. **When in doubt:** re-read `requirements.md` §1 — every empty state has a CTA.

---

## Companion documents

- `requirements.md` — the *what* and *why* (76 surfaces, the contract).
- `design.md` — the *how* (components, registry, motion, telemetry).
- This file (`tasks.md`) — the *when* and *who*.
- `_deltas/empty-state-audit.md` — the audit baseline (67+ specific paths).
- `docs/ui/empty-state-quick-create.md` — developer guide (created in EP-6).
- `audit/scorecards/empty-state-funnel-*.md` — weekly conversion read.

When this spec graduates, it joins `world-class-performance` as a sibling under `.kiro/specs/`. The two together close the two largest user-facing gaps: speed (world-class-performance) and friction (this spec).
