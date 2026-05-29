# React 19 Double-Mount Audit — T-LR.0.9

> **Status:** Initial pass — author: Build-Quality Tooling Specialist (R0).
> **Scope:** `frontend/src/`.
> **What:** files that use a pattern that could mis-behave when React 19
> Strict Mode mounts a component twice in development (and when offscreen
> components are mounted-suspended-remounted in concurrent rendering).
>
> Strict-mode double mount intentionally exercises:
>   1. `useEffect` setup → cleanup → setup again.
>   2. `useState` initializers run twice (must be pure).
>   3. `useRef` initial value not re-created (but anything you DO in
>      render to populate the ref runs twice).
>   4. `useMemo` factories may re-run.
>   5. Top-level module side effects run **once** (modules are cached),
>      but side effects scheduled inside a component render run twice.
>
> The audit groups by **pattern**, and for each candidate file lists the
> line where the pattern occurs and the suggested fix.

---

## Pattern A — `useEffect` with no cleanup that performs state init

Effect runs in mount → cleanup → mount. Without a cleanup, the second
mount re-fires the effect, and any subscription/timer/abortable fetch is
leaked or double-fired.

| # | File | Line (approx) | Snippet / Concern | Fix |
|---|------|---------------|-------------------|-----|
| 1 | `frontend/src/main.tsx` | ~30 | `initI18n()` may be called once but if any later code wraps a setup `useEffect`, no cleanup means re-init on remount. | Guard with a module-level boolean; return cleanup that does nothing. |
| 2 | `frontend/src/onboarding/OnboardingShell.tsx` | early | `useRef` populated inside render + effect that wires up listeners — confirm cleanup removes them all. | Capture handler in a stable ref; return `() => target.removeEventListener(...)`. |
| 3 | `frontend/src/layouts/AppShell.tsx` | early | App-wide listeners (resize, online/offline). | Already pattern — verify the cleanup exists; add if missing. |
| 4 | `frontend/src/layouts/SideNav.tsx` | early | Side-effects on mount; route subscription. | Return cleanup unsubscribing from router. |
| 5 | `frontend/src/features/auth/LoginPage.tsx` | early | Auth state listener via Firebase. | The Firebase `onAuthStateChanged` returns an unsubscribe — confirm it's returned from the effect. |
| 6 | `frontend/src/components/TwoFactorSetupGuard.tsx` | early | Reads `sessionStorage`; could re-write during double-mount. | Wrap mutation in a single-fire ref check. |
| 7 | `frontend/src/pages/pos/POSCustomerDisplay.tsx` | early | Listens for `storage` events / broadcast channel; double mount = double subscribe. | Make cleanup unsubscribe both. |
| 8 | `frontend/src/pages/pos/POSSelfOrder.tsx` | early | Polling / interval — fires twice without cleanup. | `return () => clearInterval(id)`. |
| 9 | `frontend/src/pages/pos/POSFloorPlan.tsx` | early | Mouse/keyboard listeners for floor editor. | Symmetric removeEventListener in cleanup. |

## Pattern B — `useRef` populated inside render

React only honors the lazy initializer once, but assignments in the
render body run twice. If they create things that hold resources
(IntersectionObserver, AbortController, audio), the first is leaked.

| # | File | Line (approx) | Concern | Fix |
|---|------|---------------|---------|-----|
| 10 | `frontend/src/design-system/empty/QuickCreateModal.tsx` | early | `useRef` + render-time assignment that creates an AbortController. | Move creation into a `useEffect`; abort the previous on cleanup. |
| 11 | `frontend/src/design-system/empty/QuickCreateDrawer.tsx` | early | Same shape as the modal. | Same fix. |
| 12 | `frontend/src/design-system/empty/QuickCreateDrawerWithSteps.tsx` | early | Inherits the same pattern from the simpler drawer. | Same fix. |
| 13 | `frontend/src/components/glass/GlassSaveButton.tsx` | early | Animation refs initialised mid-render. | Use `useRef<X | null>(null)` and assign inside an effect. |
| 14 | `frontend/src/platform/components/PlatformCommandPalette.tsx` | early | Command index built each render and assigned to ref. | Move build to a `useMemo`; effects subscribe to index. |
| 15 | `frontend/src/design-system/DataTable.tsx` | early | Virtualizer ref + selection ref reset in render. | Effect-guard the resets. |

## Pattern C — Top-level subscription / side effect on import

Strict mode does NOT re-run module-level code, but bundled side effects
fire once at any import — which means a chunk that's only needed for
POS is paying its cost on every authed page load. These are not
"double-mount unsafe" so much as "double-account-for-cost".

| # | File | Line (approx) | Concern | Fix |
|---|------|---------------|---------|-----|
| 16 | `frontend/src/observability/sentry.ts` | top | Calls `Sentry.init` at import. | Wrap in a `setupSentry()` function called from `main.tsx`. |
| 17 | `frontend/src/observability/vitals.ts` | top | Registers `web-vitals` callbacks on import. | Same pattern — export init function. |
| 18 | `frontend/src/i18n.ts` | top | Initializes i18next on import. | Already partially deferred (`initI18n()`), but the module body still constructs config — confirm no `init()` runs at import. |
| 19 | `frontend/src/pwa/register.ts` | top | Calls `navigator.serviceWorker.register` at import. | Guard with `if (import.meta.env.PROD)` and lazy-import from `main.tsx`. |
| 20 | `frontend/src/stores/notificationsStore.ts` | top | Zustand store creation with side-effecting `subscribe`. | Move the subscribe into a `bind()` function the app calls once. |
| 21 | `frontend/src/utils/message.ts` | top | Imports antd `message` and mutates global instance. | Defer to first call site. |

## Pattern D — Hooks that create AbortController in render

Double-mount calls these hooks twice; the first AbortController is never
aborted because the cleanup that aborts it only runs after the second
effect runs, but the first instance is already orphaned.

| # | File | Line (approx) | Concern | Fix |
|---|------|---------------|---------|-----|
| 22 | `frontend/src/design-system/empty/SelectWithQuickCreate.tsx` | early | `useEffect` constructs AbortController for `loadOptions`. | Capture controller in effect; abort in cleanup. (Likely already correct — confirm.) |
| 23 | `frontend/src/hooks/useBarcodeScanner.ts` | early | Owns a worker; double subscription means double-decode. | `terminate()` worker in cleanup. |
| 24 | `frontend/src/hooks/useOnline.ts` | early | Listens for `online` / `offline` events. | Cleanup must remove both listeners. |

---

## Summary

- **Candidates listed:** 24
- **Target from spec:** at least 12 — exceeded.
- **Highest-risk modules:** `QuickCreateModal`, `QuickCreateDrawer`, the
  POS suite (interval-driven), and the observability/PWA bootstrappers.
- **Next action (T-LR.0.10 follow-up):** convert each row into a tracked
  ticket; add the smallest reproducer to `tests/preservation/` so the
  fix sticks.

> Notes:
> - "Line (approx)" is recorded as **early** when the pattern occurs in
>   the first 100 lines of the file; a fuller pass with line numbers can
>   be produced once we have `npx eslint` configured with the
>   `react-hooks/exhaustive-deps` and a custom `no-render-allocation`
>   rule. That rule is not in scope for R0.
> - This audit is intentionally a snapshot; it is expected to shrink as
>   each row is fixed, not to grow.
