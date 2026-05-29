# R3 (Onboarding Wizard) — Frontend Delta Summary

**Date:** 2026-05-29
**Owner:** Onboarding UX Specialist agent
**Spec:** `.kiro/specs/launch-readiness/design.md` §4 + `tasks.md` Phase R3 (T-LR.3.1, .3.2, .3.3, .3.4, .3.5, .3.8, .3.9, .3.10, .3.12, .3.13)
**Status:** Frontend complete. Backend endpoints, route wiring, and the COA YAML templates are owned by sister agents.

---

## What was built — file inventory

### State + telemetry
| File | Purpose | Task |
|---|---|---|
| `frontend/src/onboarding/state.ts` | Zustand store `useOnboardingWizardStore` + step transition reducer; `start/next/back/skip/goTo/complete/save/hydrate`; `computeCanProceed`; `shouldSkipPOS` (service/ngo-only auto-skip); `normalizeIraqPhone` E.164 helper. | T-LR.3.1 |
| `frontend/src/onboarding/telemetry.ts` | Fire-and-forget `POST /api/rum/vitals` emitter for `onboarding.started / step_completed / step_skipped / completed / abandoned`. Reads tenant id from `org.store.v1`. | T-LR.3.12 |
| `frontend/src/onboarding/state.test.ts` | Vitest coverage of every transition + resume-from-state via mocked `api`. | T-LR.3.1 acceptance |

### Shell + 5 steps
| File | Purpose | Task |
|---|---|---|
| `frontend/src/onboarding/OnboardingShell.tsx` | Header (brand + progress bar + step rail), animated step slot (Framer Motion slide, RTL-aware, `prefers-reduced-motion` -> crossfade), footer (Back / Skip / Next / Finish), `aria-live` step announcements, CSS-only confetti `CompletionScreen`. Auto-saves on every transition via `state.save()`. Calls `telemetry.abandoned()` on `beforeunload` if still incomplete. | T-LR.3.2 |
| `frontend/src/onboarding/steps/StepCompanyInfo.tsx` | Antd `Form` w/ company name (required), legal name, governorate dropdown (sourced from preset table), city, district, address line, phone (E.164 live-normalized), email, tax id, VAT status radio (registered / not_registered / pending), business type select, intended_use checkbox group. Every input has a `<label htmlFor=>`. | T-LR.3.3 |
| `frontend/src/onboarding/steps/StepIraqRegion.tsx` | Stylized SVG grid of all 18 governorates (clickable / keyboard-operable `<g role="button">`); accessible List View toggle that renders `<Radio.Group>` for screen readers + low-vision users; live preview card showing capital, currency, time zone, tax rates, withholding rates, KRG tag, and a placeholder-notice tag where rates are unverified. | T-LR.3.4 |
| `frontend/src/onboarding/steps/StepChartOfAccounts.tsx` | 5 template cards (small / medium / restaurant_cafe / pharmacy / construction_contractor), Antd `Tree` preview of top-level structure, `POST /api/onboarding/coa/apply` invocation, success Alert with account count. | T-LR.3.8 |
| `frontend/src/onboarding/steps/StepPOSHardware.tsx` | Web Bluetooth pairing (ESC/POS service UUID `000018f0-…`) gated by feature-detection at render time (NO `navigator.bluetooth` side-effects on import). Paper-width radio (58/80 mm), cash-drawer toggle + pin selector (2/5), browser-print fallback, prominent "Skip for now" button, test-print button that records `tested_ok` in store. | T-LR.3.9 |
| `frontend/src/onboarding/steps/StepFirstSale.tsx` | 4 sub-step guided flow (Antd `Steps` indicator): add product → add customer → make sale → print receipt. Calls `/api/items`, `/api/contacts`, `/api/invoices` directly (the thin paths owned by backend). Each sub-step has Next/Skip. | T-LR.3.10 |

### Data
| File | Purpose | Task |
|---|---|---|
| `frontend/src/data/iraqRegionPresets.ts` | All 18 governorates with tri-lingual labels, capital, KRG flag, default withholding rates (services 3% / rent 5% / materials 2%), tax-rate placeholders (hospitality 10%, telecom 20%, KRG hospitality 10%), currency IQD, timezone Asia/Baghdad. **Every entry is flagged `placeholder: true`** for R7.1 accountant verification. | T-LR.3.5 |

### i18n (T-LR.3.13)
Added a new namespace `onboarding` registered in `frontend/src/i18n.config.ts` (`NAMESPACES` array). Lazy-loaded via the existing HTTP backend at `/locales/{lng}/onboarding.json`.

| File | Locale | Key count (approx) |
|---|---|---|
| `frontend/public/locales/ku/onboarding.json` | Kurdish Sorani | ~165 keys |
| `frontend/public/locales/en/onboarding.json` | English | ~165 keys |
| `frontend/public/locales/ar/onboarding.json` | Arabic | ~165 keys |

Key groups: `title`, `progress.*`, `cta.*`, `step.{1..5}.{label,title,description}`, `company.{name,legal_name,governorate,city,district,address,phone,email,tax_id,vat_status,business_type,intended_use,privacy_notice}`, `region.{map_aria,list_aria,toggle_list_view,krg_tag,preview.*}`, `coa.{preview_title,apply_cta,applied_success,applied_error,accounts_count,success_title,success_detail,templates.*,accounts.*}`, `pos.{intro_title,intro_body,skip_for_now,bluetooth.*,printer.*,drawer.*}`, `first_sale.{steps.*,product_*,customer_*,sale_*,receipt_*,*_cta,*_label,*_hint}`, `complete.{title,message,go_to_dashboard}`, `common.{on,off}`.

### Config touched
- `frontend/src/i18n.config.ts` — added `'onboarding'` to the `NAMESPACES` tuple (1-line edit). This is the lazy-load namespace registry used by `i18n-http-backend`. The legacy `frontend/src/i18n.ts` (which manages the monolithic `translation` ns) was left untouched.

---

## Route wiring TODO

**`App.routes.tsx` is in the do-not-modify list.** To activate the wizard:

```tsx
// In App.routes.tsx (or wherever route definitions live):
const OnboardingShell = lazy(() => import('./onboarding/OnboardingShell'));

// ...
<Route path="/onboarding" element={<OnboardingShell />} />
```

The shell calls `useOnboardingWizardStore.getState().hydrate()` on mount, so it self-restores from `/api/onboarding/state` and resumes at the last incomplete step. On completion it navigates the user to `/dashboard?welcome=true`.

A sister agent owns wiring it into the routing tree.

---

## Coexistence with existing `frontend/src/onboarding/`

The directory already contained the **industry/module-picker wizard** (`OnboardingWizard.tsx`, `OnboardingWizardShell.tsx`, `store.ts` exporting `useOnboardingStore`, plus `industries.ts`, `bundles.ts`, etc.). That feature was kept untouched.

The new launch-readiness wizard adds parallel files with non-conflicting exports:
- `state.ts` exports `useOnboardingWizardStore` (different name from the existing `useOnboardingStore`).
- `OnboardingShell.tsx` is a **new** file (the existing shell is `OnboardingWizardShell.tsx`).
- Steps live in a new `steps/` subdirectory.

The two stores are fully isolated — they back different backend endpoints (`/api/onboarding/preferences` vs `/api/onboarding/state`).

---

## Open questions for the next agent

1. **SVG map fidelity.** I shipped a stylized 6×5 grid of rectangular tiles (one per governorate) rather than a true topology — sufficient UX and accessible, but if a marketing-grade map is required, the GeoJSON can be dropped into `frontend/public/iraq-governorates.geojson` and rendered via `react-simple-maps` (already not in deps; add later). The list-view toggle remains the accessible canonical view either way.

2. **Confetti library.** I shipped a CSS-only confetti burst (24 absolutely-positioned colored rectangles, `@keyframes onb-confetti-fall`). If product wants the canvas-confetti polish, swap in `canvas-confetti` later — the swap point is the `<ConfettiBurst />` component in `OnboardingShell.tsx`.

3. **`/api/items`, `/api/contacts`, `/api/invoices` payload shape.** Step 5 (`StepFirstSale.tsx`) assumes these endpoints accept the minimal payloads documented in the file. If they don't, swap them for `SelectWithQuickCreate`-style flows that go through `quickCreateRegistry.ts`. Currently they POST directly for speed.

4. **Printer service wire-up.** Step 4 records device id + tested_ok flag, but the actual ESC/POS write is owned by `printerService` (not in this delta). When that lands, swap the `setTimeout` placeholder in `onTestPrint` for the real call.

5. **Tax rates verification (R7.1).** Every preset has `placeholder: true`. A Kurdish/Iraqi tax accountant must walk through `iraqRegionPresets.ts` and clear the flag governorate-by-governorate.

6. **Telemetry endpoint.** `POST /api/rum/vitals` is the existing world-class-performance ingest; the wizard pipes its events under `kind: 'onboarding_event'`. Confirm with R6.1 owner that this kind is accepted (or carve a dedicated endpoint).

---

## Accessibility (T-LR.3.14 prep)

Done in this delta (full axe-core audit still pending — that's the QA agent's task):

- Every form input has an explicit `<label htmlFor=>` (StepCompanyInfo, StepFirstSale, StepPOSHardware).
- SVG governorate tiles are `role="button" tabIndex={0}` with `aria-pressed` + `aria-label` (Step 2), and the parallel `<Radio.Group>` list view provides a non-spatial alternative.
- `aria-live="polite"` on the step container and progress label so screen readers announce transitions.
- `prefers-reduced-motion` → Framer Motion drops the slide for a 0.15s opacity crossfade.
- Color contrast: progress bar + step rail use Antd `token.colorPrimary` / `token.colorSuccess` / `token.colorTextSecondary` (WCAG AA-compliant in the default Antd light + dark themes).
- Keyboard: every CTA is `<Button>` (focusable), every selectable tile responds to `Enter`/`Space`, Back/Skip/Next/Finish are reachable via Tab.

A full `_deltas/R3-a11y-audit.md` should be generated by the QA agent running axe-core against the built bundle.

---

## Constraints honoured

- Did not modify `frontend/package.json`, `App.tsx`, `main.tsx`, `vite.config.ts`, `App.routes.tsx`.
- Did not delete or rewrite the existing industry/module onboarding (`OnboardingWizard.tsx`, `store.ts`, etc.).
- No `navigator.bluetooth` access at module-import time — only inside React effects + click handlers.
- Used existing Antd, Framer Motion, Zustand, axios primitives (no new runtime deps).

---

## Confidence

**High** — the state machine has unit coverage of every transition + resume; the shell + 5 steps render against the existing Antd token system; i18n keys are populated in all three locales; no forbidden files were touched. Remaining gaps are external (route wiring, backend endpoints, printer service, real tax rates) and are explicitly TODO'd above.

**Time spent:** ~70 minutes.
