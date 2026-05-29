/**
 * Iraqi Dinar denomination utilities (growth-to-100 § R4.10).
 *
 * IQD has no decimal subdivision in practice. Current circulating notes:
 *
 *     50 000, 25 000, 10 000, 5 000, 1 000, 500, 250
 *
 * Older 50/100/200 dinar notes are technically still legal but withdrawn
 * from daily commerce; the cash-drawer UI may still allow input for them
 * (flagged `withdrawn: true`).
 *
 * Greedy break-down is correct for the IQD denomination set because every
 * higher denomination is an integer multiple of every smaller one used in
 * practice — there is no need for a knapsack / DP approach. Spec R4.10
 * explicitly accepts greedy.
 */

export interface DenominationInfo {
  value: number;
  label_ku: string;
  label_ar: string;
  label_en: string;
  withdrawn?: boolean;
}

/** Active denominations, ordered largest → smallest for greedy. */
export const DENOMINATIONS: readonly number[] = [
  50_000, 25_000, 10_000, 5_000, 1_000, 500, 250,
] as const;

/** Same as DENOMINATIONS but with bilingual labels (for the cash-drawer UI). */
export const DENOMINATION_META: readonly DenominationInfo[] = [
  { value: 50_000, label_ku: '٥٠٬٠٠٠ د.ع', label_ar: '٥٠٬٠٠٠ د.ع', label_en: '50,000 IQD' },
  { value: 25_000, label_ku: '٢٥٬٠٠٠ د.ع', label_ar: '٢٥٬٠٠٠ د.ع', label_en: '25,000 IQD' },
  { value: 10_000, label_ku: '١٠٬٠٠٠ د.ع', label_ar: '١٠٬٠٠٠ د.ع', label_en: '10,000 IQD' },
  { value: 5_000, label_ku: '٥٬٠٠٠ د.ع', label_ar: '٥٬٠٠٠ د.ع', label_en: '5,000 IQD' },
  { value: 1_000, label_ku: '١٬٠٠٠ د.ع', label_ar: '١٬٠٠٠ د.ع', label_en: '1,000 IQD' },
  { value: 500, label_ku: '٥٠٠ د.ع', label_ar: '٥٠٠ د.ع', label_en: '500 IQD' },
  { value: 250, label_ku: '٢٥٠ د.ع', label_ar: '٢٥٠ د.ع', label_en: '250 IQD' },
] as const;

/** Withdrawn denominations — surfaced in the count UI for completeness. */
export const WITHDRAWN_DENOMINATIONS: readonly DenominationInfo[] = [
  { value: 200, label_ku: '٢٠٠ د.ع', label_ar: '٢٠٠ د.ع', label_en: '200 IQD', withdrawn: true },
  { value: 100, label_ku: '١٠٠ د.ع', label_ar: '١٠٠ د.ع', label_en: '100 IQD', withdrawn: true },
  { value: 50, label_ku: '٥٠ د.ع', label_ar: '٥٠ د.ع', label_en: '50 IQD', withdrawn: true },
] as const;

// ─────────────────────────────────────────────────────────────────────────
// Break-down
// ─────────────────────────────────────────────────────────────────────────

/**
 * Greedy decomposition of `amount` into the smallest count of IQD notes.
 *
 * Returns a Map keyed by denomination value (50000, 25000, …) whose values
 * are the count of that note required. Denominations with count = 0 are
 * **excluded** from the map so callers can iterate without filtering.
 *
 * Negative or non-finite input returns an empty map. Fractions are floored
 * to the next 250 IQD (smallest denomination) — IQD has no decimals.
 *
 * @example
 *   breakDown(127_750)
 *   // → Map { 50000 → 2, 25000 → 1, 1000 → 2, 500 → 1, 250 → 1 }
 */
export function breakDown(
  amount: number,
  denominations: readonly number[] = DENOMINATIONS,
): Map<number, number> {
  const out = new Map<number, number>();
  if (!Number.isFinite(amount) || amount <= 0) return out;
  // Round down to nearest 250 — anything smaller is uncountable in IQD.
  let remainder = Math.floor(amount / 250) * 250;
  const sorted = [...denominations].sort((a, b) => b - a);
  for (const note of sorted) {
    if (remainder < note) continue;
    const count = Math.floor(remainder / note);
    out.set(note, count);
    remainder -= note * count;
    if (remainder <= 0) break;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Rounding
// ─────────────────────────────────────────────────────────────────────────

export type RoundingMode = 'up' | 'down' | 'nearest';

/**
 * Round `amount` to the nearest 250/500/1000/5000 IQD denomination.
 *
 * @param step  The denomination granularity to round to (default 250).
 * @param mode  'up' | 'down' | 'nearest' (default 'nearest')
 */
export function roundToNearestDenomination(
  amount: number,
  mode: RoundingMode = 'nearest',
  step = 250,
): number {
  if (!Number.isFinite(amount)) return 0;
  if (step <= 0) return amount;
  if (mode === 'up') return Math.ceil(amount / step) * step;
  if (mode === 'down') return Math.floor(amount / step) * step;
  return Math.round(amount / step) * step;
}

/**
 * Suggested "quick cash" tender amounts that round the total upward to the
 * nearest 5000 / 10000 / 25000 / 50000 IQD note. Cashiers use these as
 * one-tap buttons when the customer pays in round notes.
 */
export function quickCashTenders(amount: number, count = 4): number[] {
  if (!Number.isFinite(amount) || amount <= 0) return [];
  const steps = [5_000, 10_000, 25_000, 50_000];
  const out = new Set<number>();
  // Exact amount is always offered when it is itself a round denomination.
  if (amount % 250 === 0) out.add(amount);
  for (const s of steps) {
    out.add(roundToNearestDenomination(amount, 'up', s));
  }
  return [...out].sort((a, b) => a - b).slice(0, count);
}

// ─────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────

const LATIN_TO_INDIC: Record<string, string> = {
  '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
  '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩',
};

function toIndic(s: string): string {
  return s.replace(/[0-9]/g, (d) => LATIN_TO_INDIC[d] || d);
}

/**
 * Format an IQD amount per R4.9 — no decimals, locale-aware separator,
 * suffix `د.ع` (Arabic/Kurdish) or `IQD` (English).
 *
 * Same contract as the backend `format_iqd()` so server and client agree.
 */
export function format(
  amount: number,
  locale: 'ku' | 'ar' | 'en' = 'ku',
  useArabicIndic = false,
): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const isRtl = locale === 'ku' || locale === 'ar';
  const sep = isRtl ? '٬' : ',';
  let formatted = Math.abs(safe).toLocaleString('en-US').replace(/,/g, sep);
  if (safe < 0) formatted = `-${formatted}`;
  if (useArabicIndic) formatted = toIndic(formatted);
  const suffix = isRtl ? ' د.ع' : ' IQD';
  return `${formatted}${suffix}`;
}

/** Total represented by a denomination map (inverse of `breakDown`). */
export function sumFromBreakdown(breakdown: Map<number, number>): number {
  let total = 0;
  for (const [note, count] of breakdown) total += note * count;
  return total;
}

const iqdHelpers = {
  DENOMINATIONS,
  DENOMINATION_META,
  WITHDRAWN_DENOMINATIONS,
  breakDown,
  roundToNearestDenomination,
  quickCashTenders,
  format,
  sumFromBreakdown,
};

export default iqdHelpers;
