/**
 * Branded `TranslationKey` type (system-wide-ux-overhaul, R11.5, R13.4, R13.5).
 *
 * A {@link TranslationKey} is a `string` that has been verified to exist in
 * both `frontend/src/locales/en.json` and `frontend/src/locales/ku.json` with
 * non-empty values. The brand is structural-only (a `unique symbol` phantom
 * field) — no runtime cost — and exists so the type system can distinguish:
 *
 *   - **A raw string literal** (e.g., `'Save'`, `'بەکارهێنەران'`) which is a
 *     Hardcoded_Literal and must be flagged by the `no-hardcoded-literal`
 *     ESLint rule (R13.4, R13.5).
 *   - **A vetted Translation_Key** (e.g., `'common.save'`) which is safe to
 *     pass to `t()` and to component props such as `titleKey`, `labelKey`,
 *     `descriptionKey`, `ctaKey`, etc.
 *
 * Branding is enforced at the boundary by {@link asTranslationKey} (used by
 * the Help_Registry and other compile-time-known content sources) and is
 * verified at CI time by the `i18n-coverage` job (R13.1, R13.2, R13.3, R13.6).
 *
 * Owner: this spec (system-wide-ux-overhaul). Consumed read-only by:
 *   - `frontend/src/help/registry.ts`           (R8.2)
 *   - `frontend/src/components/responsive/*`    (R3, R4)
 *   - `frontend/src/components/AddGate/*`       (R9, R10)
 *
 * @see PROPER_NOUNS — proper-noun allowlist (R11.7).
 */
declare const translationKeyBrand: unique symbol;

export type TranslationKey = string & { readonly [translationKeyBrand]: 'TranslationKey' };

/**
 * Brand a string literal as a {@link TranslationKey}.
 *
 * Use this **only** at the boundary where the registry / a typed lookup table
 * already guarantees the key exists in both locales. The runtime is a pure
 * cast — no validation happens here. CI's `i18n-coverage` job is responsible
 * for asserting that the key actually resolves in both `en.json` and
 * `ku.json` with a non-empty value (R13.2, R13.3).
 *
 * @example
 *   const titleKey = asTranslationKey('settings.currencies.title');
 */
export function asTranslationKey(key: string): TranslationKey {
  return key as TranslationKey;
}

/**
 * Test-only DOM opt-out attribute (R13.8).
 *
 * ## Purpose
 *
 * Test scaffolding nodes — e.g., `<span data-testid="route-id"
 * data-i18n-test="ignore">/sales/invoices</span>` — that intentionally carry
 * cross-script characters (route paths, identifiers) MUST set
 * `data-i18n-test="ignore"`. The route-walk Playwright assertion (P6) skips
 * any node that carries this attribute or has an ancestor that does.
 *
 * ## When to use
 *
 * - **Test-only hidden elements** that expose route paths, numeric IDs, or
 *   other non-translatable identifiers for Playwright/Vitest assertions.
 * - **Visually hidden debug nodes** (`display: none` or `visibility: hidden`)
 *   that carry raw technical strings for developer tooling.
 *
 * ## When NOT to use
 *
 * - **Production-visible nodes** — any element the user can see or that
 *   assistive technology announces MUST NOT carry this attribute. The
 *   `no-hardcoded-literal` ESLint rule and the route-walk e2e assertion
 *   together enforce that the attribute appears only in test scaffolding.
 * - **Elements with `aria-label` or `aria-labelledby`** — these are
 *   user-facing accessibility strings and must go through `t()`.
 * - **Tooltips, placeholders, or alt text** — all user-facing attributes
 *   must be resolved from the i18n registry.
 *
 * ## Enforcement
 *
 * 1. The route-walk Playwright spec (`route-walk.spec.ts`) asserts that no
 *    visible text node with this attribute exists in the DOM at any viewport
 *    or locale combination.
 * 2. The `no-hardcoded-literal` ESLint rule skips nodes with this attribute
 *    but flags any production-visible node that carries it.
 * 3. CI's `i18n-coverage` job cross-references: if a node with this attribute
 *    is rendered with `display` other than `none` or `visibility` other than
 *    `hidden`, the build fails.
 *
 * ## ARIA Contracts (R14.3, R14.5, R14.6)
 *
 * Every interactive element in the system must satisfy one of:
 * - Has visible text content resolved through `t()`, OR
 * - Has `aria-label` resolved from the i18n registry via `t()`, OR
 * - Has `aria-labelledby` pointing to a visible translated label element.
 *
 * Dynamic content changes (toasts, validation summaries, lockout countdowns)
 * must be announced via `aria-live` regions:
 * - `aria-live="polite"` for non-urgent updates (toasts, status changes).
 * - `aria-live="assertive"` for urgent updates (errors, lockout warnings).
 *
 * Focus rings on all interactive elements are sourced from `theme/tokens.ts`
 * (`a11y.focusRingWidth`, `a11y.focusRingColor`, `a11y.focusRingOffset`).
 * No `outline: none` is permitted without a replacement focus indicator that
 * meets WCAG AA non-text contrast (≥ 3:1).
 *
 * @example
 * ```tsx
 * // ✅ Correct — test-only hidden node
 * <span
 *   data-testid="current-route"
 *   data-i18n-test="ignore"
 *   style={{ display: 'none' }}
 * >
 *   /sales/invoices
 * </span>
 *
 * // ❌ Wrong — production-visible node must NOT use this attribute
 * <button data-i18n-test="ignore">Save</button>
 * ```
 *
 * @see {@link TranslationKey} — all user-facing strings must be translation keys.
 * @see `frontend/src/theme/tokens.ts` `a11y` — focus ring token source.
 * @see `frontend/src/design-system/Toast.tsx` — aria-live toast announcer.
 * @see `frontend/src/design-system/FormLayout.tsx` — aria-live validation summary.
 */
export const I18N_TEST_IGNORE_ATTR = 'data-i18n-test' as const;
export const I18N_TEST_IGNORE_VALUE = 'ignore' as const;

/**
 * ARIA contract helpers for interactive elements (R14.3, R14.5, R14.6).
 *
 * Use these constants when building accessible interactive elements that lack
 * visible text. Every icon-only button, toggle, or control without visible
 * text MUST have an `aria-label` resolved from the i18n registry.
 *
 * @example
 * ```tsx
 * <Button
 *   icon={<DeleteOutlined />}
 *   aria-label={t('common.delete')}
 * />
 * ```
 */
export const ARIA_LIVE_POLITE = 'polite' as const;
export const ARIA_LIVE_ASSERTIVE = 'assertive' as const;
