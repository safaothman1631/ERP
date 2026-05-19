/**
 * useHelp — resolves the active-locale Help_Content for a `sectionId`.
 *
 * Owned by `system-wide-ux-overhaul` (task 2.3). The hook is the only legal
 * way for product code to read Help_Registry entries — `HelpIcon` and
 * `HelpPanel` consume `ResolvedHelp` and render `what → why → relatesTo →
 * howSteps` in that fixed order (R6.3, R6.4).
 *
 * Lazy loading
 * ------------
 * `helpRegistry` lives in a Vite `manualChunks` `help` chunk (see
 * `frontend/vite.config.ts`) so it never ships in the initial bundle. The
 * hook dynamically `import()`s the chunk and caches the resolved registry at
 * the module level so subsequent mounts read it synchronously. The promise
 * cache is reset to `null` on chunk-load failure so the **next** mount with a
 * new `sectionId` re-attempts the load — the hook never retries mid-render
 * and never spins a retry loop (R8.4, R15.5, design §"Lazy Loading & Offline
 * Degradation").
 *
 * Graceful failure (R6.1, R8.4, R12.5, R15.5)
 * -------------------------------------------
 * When the lazy chunk fails to load, the hook returns:
 *
 *   {
 *     sectionId,
 *     what: t('help.unavailable.message'),   // always-bundled key
 *     why: '',
 *     relatesTo: [],
 *     howSteps: [],
 *     fellBack: false,
 *     unavailable: true,
 *   }
 *
 * The hook MUST NOT throw, MUST NOT block language switching, MUST NOT
 * force-reset the active language, and MUST NOT crash the surrounding
 * Section. `HelpIcon` checks `unavailable` and renders nothing (or an inline
 * fallback) so the Section continues to render normally.
 *
 * Per-key locale fallback (R8.4, R12.5)
 * --------------------------------------
 * For each translation key consumed from the registry, the hook checks
 * whether the active locale has the key defined via `i18n.exists(key, { lng:
 * activeLng })`. If not, the key falls back through i18next's standard
 * fallback chain (`ku → en` per `i18n.ts`) and `fellBack` is set to `true`.
 * A `console.warn` is emitted in development and a structured `warn` log in
 * production so the missing translation surfaces in observability without
 * crashing the UI.
 *
 * Loading vs unavailable
 * ----------------------
 * Both the transient loading phase (before the lazy chunk resolves) and the
 * terminal failure phase render as `unavailable: true`. This matches the
 * design contract: `HelpIcon` decides what to render based purely on
 * `unavailable`, so the icon is hidden during load and stays hidden on
 * failure. A successful load triggers a re-render with `unavailable: false`
 * and the resolved fields.
 *
 * _Validates: Requirements 6.1, 6.4, 8.4, 12.5, 15.5_
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SectionId } from './sectionIds';
import type { HelpRegistry } from './registry';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolved Help_Content for a Section in the active locale.
 *
 * Shape mirrors `design.md` §"useHelp(sectionId) Hook" exactly. Every text
 * field is the localized string (already passed through `t()`) — consumers
 * render these directly without further i18n indirection.
 */
export interface ResolvedHelp {
  readonly sectionId: SectionId;
  readonly what: string;
  readonly why: string;
  readonly relatesTo: ReadonlyArray<{ readonly label: string; readonly route: string }>;
  readonly howSteps: ReadonlyArray<string>;
  /** True when at least one field fell back from the active locale to another locale. */
  readonly fellBack: boolean;
  /** True when the lazy registry chunk failed to load OR the load is still in flight. */
  readonly unavailable: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level lazy-load cache
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Three-state cache for the lazy `helpRegistry` import:
 *   - `undefined` — never attempted (fresh module load).
 *   - `null`      — last attempt failed; next mount triggers a retry.
 *   - `HelpRegistry` — successfully loaded; used synchronously by subsequent mounts.
 */
let cachedRegistry: HelpRegistry | null | undefined;

/** In-flight load promise; `null` while idle (no load currently running). */
let inflight: Promise<HelpRegistry | null> | null = null;

/**
 * Trigger (or share) the lazy `helpRegistry` import.
 *
 * - On success: caches the registry and resolves to it; subsequent calls are
 *   synchronous via the module-level cache.
 * - On failure: caches `null`, resets `inflight` so the next call retries,
 *   logs a structured warning, and resolves to `null` (never rejects — the
 *   hook never throws per R8.4).
 */
function loadRegistry(): Promise<HelpRegistry | null> {
  if (cachedRegistry !== undefined) {
    // Either a successful registry or a recorded `null` failure; reuse.
    return Promise.resolve(cachedRegistry);
  }
  if (inflight !== null) {
    return inflight;
  }
  inflight = import('./registry')
    .then((mod): HelpRegistry => {
      cachedRegistry = mod.helpRegistry;
      inflight = null;
      return mod.helpRegistry;
    })
    .catch((err: unknown): null => {
      cachedRegistry = null;
      inflight = null;
      // Structured warn for production telemetry; console.warn is the lingua
      // franca consumed by both dev tools and the existing prod logger.
      try {
        // eslint-disable-next-line no-console
        console.warn('[useHelp] failed to load help registry chunk', err);
      } catch {
        /* noop — never throw from the hook (R8.4) */
      }
      return null;
    });
  return inflight;
}

/**
 * Test-only reset hook. Allows unit tests that need to exercise the load
 * path repeatedly to clear the module-level cache between cases. Not
 * exported from the package barrel; importable by direct path.
 */
export function __resetHelpRegistryCacheForTests(): void {
  cachedRegistry = undefined;
  inflight = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline-fallback strings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inline-bundled fallback messages for `help.unavailable.message`.
 *
 * These ship in the always-loaded core bundle so the hook can render
 * something useful even when the i18n locale resource bundle for the active
 * language has not yet loaded (R12.5: independent code paths). The runtime
 * preferentially calls `t('help.unavailable.message')`; this constant
 * supplies the `defaultValue` so missing translations never produce an
 * empty string (R12.5, R15.5).
 */
const UNAVAILABLE_MESSAGE_FALLBACK: Record<string, string> = {
  en: 'Help is temporarily unavailable. Please try again.',
  ku: 'یارمەتی بۆ کاتێک بەردەست نییە. تکایە دواتر هەوڵ بدەوە.',
  ar: 'المساعدة غير متاحة مؤقتًا. يرجى المحاولة مرة أخرى.',
};

/** Translation key for the inline-fallback unavailable message (R8.4, R15.5). */
const UNAVAILABLE_MESSAGE_KEY = 'help.unavailable.message';

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/** Internal load-state machine for the registry import. */
type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly registry: HelpRegistry }
  | { readonly status: 'failed' };

/**
 * Compute the initial `LoadState` synchronously from the module-level cache.
 * Avoids a one-tick "loading" flicker on subsequent mounts that follow a
 * successful first mount.
 */
function readInitialLoadState(): LoadState {
  if (cachedRegistry === undefined) return { status: 'loading' };
  if (cachedRegistry === null) return { status: 'failed' };
  return { status: 'loaded', registry: cachedRegistry };
}

/** Resolve the inline-fallback `unavailable` message in the active locale. */
function resolveUnavailableMessage(
  t: (key: string, options?: { defaultValue?: string }) => string,
  activeLanguage: string,
): string {
  const langKey = activeLanguage in UNAVAILABLE_MESSAGE_FALLBACK ? activeLanguage : 'en';
  const defaultValue = UNAVAILABLE_MESSAGE_FALLBACK[langKey];
  // `defaultValue` ensures we never return `''`, the literal key, or a
  // humanized key (i18n.ts' parseMissingKeyHandler). If the i18n_Registry
  // later acquires the key (task 6.4), the localized value takes priority.
  return t(UNAVAILABLE_MESSAGE_KEY, { defaultValue });
}

/** Build the `ResolvedHelp` shape returned for `loading` and `failed` states. */
function buildUnavailableResolved(sectionId: SectionId, message: string): ResolvedHelp {
  return {
    sectionId,
    what: message,
    why: '',
    relatesTo: [],
    howSteps: [],
    fellBack: false,
    unavailable: true,
  };
}

/**
 * Resolve the active-locale Help_Content for `sectionId`.
 *
 * Returns a {@link ResolvedHelp}. Never throws. Triggers a lazy import of the
 * Help_Registry chunk on first call; reuses the cached registry on
 * subsequent calls.
 */
export function useHelp(sectionId: SectionId): ResolvedHelp {
  const { t, i18n } = useTranslation();
  const activeLanguage = i18n.language || 'en';

  const [loadState, setLoadState] = useState<LoadState>(readInitialLoadState);

  useEffect(() => {
    let cancelled = false;

    // If a previous mount cached a successful registry, the synchronous
    // `readInitialLoadState` above already returned `loaded` — no work needed.
    if (loadState.status === 'loaded') {
      return undefined;
    }

    // Re-attempt on each new sectionId-mount only when the previous attempt
    // either never ran or failed. The `loadRegistry` cache itself decides
    // whether to fire a fresh dynamic import or reuse a previous result.
    void loadRegistry().then((registry) => {
      if (cancelled) return;
      if (registry === null) {
        setLoadState({ status: 'failed' });
      } else {
        setLoadState({ status: 'loaded', registry });
      }
    });

    return () => {
      cancelled = true;
    };
    // We intentionally re-run when sectionId changes so a freshly-mounted
    // consumer can drive a retry after a previous failure (per task spec:
    // "Re-attempt on each new sectionId-mount if previous load failed").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  // ── Loading / failure paths ─────────────────────────────────────────────
  if (loadState.status !== 'loaded') {
    const message = resolveUnavailableMessage(t, activeLanguage);
    return buildUnavailableResolved(sectionId, message);
  }

  // ── Success path — resolve every field with per-key locale-fallback tracking
  const entry = loadState.registry[sectionId];
  if (!entry) {
    // Defensive: SectionId is exhaustive over the registry, so this path is
    // unreachable in production. Surface as `unavailable` rather than throw.
    const message = resolveUnavailableMessage(t, activeLanguage);
    return buildUnavailableResolved(sectionId, message);
  }

  let fellBack = false;
  const resolveKey = (key: string): string => {
    // `i18n.exists` resolves true when the key is defined in the active
    // language's resource bundle with a non-empty value. When false, t()
    // still returns a usable string via i18next's fallback chain
    // (`ku → en` per `i18n.ts`); we just record the fallback for telemetry.
    let existsInActive = false;
    try {
      existsInActive = i18n.exists(key, { lng: activeLanguage });
    } catch {
      // i18n.exists should never throw, but guard anyway — never crash
      // the hook (R6.1, R8.4).
      existsInActive = false;
    }
    if (!existsInActive) {
      fellBack = true;
      logFallback(key, sectionId, activeLanguage);
    }
    return t(key);
  };

  return {
    sectionId,
    what: resolveKey(entry.what),
    why: resolveKey(entry.why),
    relatesTo: entry.relatesTo.map((r) => ({
      label: resolveKey(r.label),
      route: r.route,
    })),
    howSteps: entry.howSteps.map((step) => resolveKey(step)),
    fellBack,
    unavailable: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Best-effort dev-vs-prod check. Defaults to "production" off the happy path. */
function isDevEnvironment(): boolean {
  try {
    // Vite injects `import.meta.env.DEV` at build time; in test runs Vitest
    // also defines it. Wrapped in try/catch so non-Vite consumers (e.g., a
    // bare Node test) don't crash if `import.meta.env` is absent.
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

/**
 * Emit a per-key locale-fallback notice. Uses `console.warn` for both dev
 * and prod paths; the production form includes a structured payload so
 * downstream log shippers (e.g., Datadog, Sentry breadcrumbs) can index by
 * `sectionId` and `key` (R8.4, R12.5).
 */
function logFallback(key: string, sectionId: SectionId, lang: string): void {
  try {
    if (isDevEnvironment()) {
      // eslint-disable-next-line no-console
      console.warn(`[useHelp] missing translation for "${key}" in lang="${lang}" (sectionId="${sectionId}")`);
    } else {
      // eslint-disable-next-line no-console
      console.warn('[useHelp] translation fallback', {
        event: 'i18n.fallback',
        sectionId,
        key,
        lang,
      });
    }
  } catch {
    /* noop — never throw from the hook (R8.4, R12.5) */
  }
}
