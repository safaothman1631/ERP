/**
 * Proper-noun allowlist (system-wide-ux-overhaul, R11.7, R13.4, R13.5).
 *
 * These tokens may legally appear verbatim in either locale (en / ku) without
 * triggering:
 *   1. The `no-hardcoded-literal` ESLint rule (R13.4, R13.5) — they are brand
 *      / product / standard names, not translatable copy.
 *   2. The cross-script visible-text check (P6, R13.8) — Latin-script tokens
 *      appearing in the Kurdish locale and vice-versa do not count as a
 *      language-purity violation when they belong to this list.
 *
 * Edits to this list are reviewed in PRs (R11.7) — additions must be true
 * proper nouns (brand names, product names, standards, code identifiers),
 * never translatable user-facing copy.
 *
 * Owner: this spec (system-wide-ux-overhaul). Sibling specs consume read-only.
 */
export const PROPER_NOUNS = [
  'Vercel',
  'Firebase',
  'Google',
  'Apple',
  'AntD',
  'Tailwind',
  'GitHub',
  'Stripe',
  'iOS',
  'Android',
  'WCAG',
  'ERPIQ',
] as const;

/** Union of every allow-listed proper-noun literal. */
export type ProperNoun = (typeof PROPER_NOUNS)[number];

/**
 * Type guard — narrows an arbitrary string to {@link ProperNoun} when it is
 * present in {@link PROPER_NOUNS}. Useful in lint/test utilities that must
 * decide whether a Latin-script token in a Kurdish-locale screen is allowed.
 */
export function isProperNoun(value: string): value is ProperNoun {
  return (PROPER_NOUNS as readonly string[]).includes(value);
}
