/**
 * Hijri date utilities (growth-to-100 § R4.11).
 *
 * Strategy: prefer the browser's `Intl.DateTimeFormat` with
 * `calendar: 'islamic-umalqura'` (the deterministic Umm al-Qura variant
 * used by Saudi Arabia and accepted by Iraqi MoF for official documents).
 *
 * Fallback: a tiny pure-JS conversion using the standard tabular algorithm
 * (Khazimov / Borger). This is good to ±1 day vs Umm al-Qura but works in
 * test environments where `Intl` doesn't ship the Islamic calendar.
 *
 * The frontend deliberately does **not** depend on a heavy npm package like
 * `moment-hijri` — the browser ships everything needed.
 */

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface HijriDate {
  year: number;
  month: number;        // 1-12
  day: number;          // 1-30
  month_name_ar: string;
  month_name_en: string;
}

export const HIJRI_MONTHS_AR: readonly string[] = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
] as const;

export const HIJRI_MONTHS_EN: readonly string[] = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
  'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhu al-Qa'dah", 'Dhu al-Hijjah',
] as const;

// ─────────────────────────────────────────────────────────────────────────
// Conversion
// ─────────────────────────────────────────────────────────────────────────

function _tryIntlHijri(d: Date): HijriDate | null {
  try {
    const parts = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      year: 'numeric', month: 'numeric', day: 'numeric',
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    // Intl returns Arabic-Indic digits by default for ar-SA — normalise.
    const toInt = (s: string) => parseInt(
      s.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (ch) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch))),
      10,
    );
    const year = toInt(get('year'));
    const month = toInt(get('month'));
    const day = toInt(get('day'));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    return {
      year, month, day,
      month_name_ar: HIJRI_MONTHS_AR[month - 1] ?? '',
      month_name_en: HIJRI_MONTHS_EN[month - 1] ?? '',
    };
  } catch {
    return null;
  }
}

/**
 * Tabular Hijri conversion (Kuwaiti algorithm) — used when `Intl` doesn't
 * support the Islamic calendar. Good to ±1 day vs Umm al-Qura.
 */
function _tabularHijri(d: Date): HijriDate {
  const jd = Math.floor((d.getTime() / 86400000) + 2440587.5) + 1;
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719)
          + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
            - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  const m = Math.max(1, Math.min(12, month));
  return {
    year,
    month: m,
    day: Math.max(1, Math.min(30, day)),
    month_name_ar: HIJRI_MONTHS_AR[m - 1] ?? '',
    month_name_en: HIJRI_MONTHS_EN[m - 1] ?? '',
  };
}

/**
 * Convert a Gregorian `Date` (or ISO string) to a Hijri date.
 */
export function toHijri(value: Date | string | number | null | undefined): HijriDate | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return _tryIntlHijri(d) ?? _tabularHijri(d);
}

/**
 * Convert a Hijri date back to Gregorian. Uses `Intl` if available; otherwise
 * an inverse tabular conversion. Returns `null` for invalid input.
 *
 * Note: there is no formal inverse of the Umm al-Qura table in the standard
 * library — we approximate by binary-searching against `toHijri`. Adequate
 * for the rare "user typed a Hijri date" path.
 */
export function fromHijri(h: HijriDate): Date | null {
  if (!h || !Number.isFinite(h.year) || !Number.isFinite(h.month) || !Number.isFinite(h.day)) {
    return null;
  }
  // Binary search in a ±35 day window around the tabular forward estimate.
  // Days since AH 1-1-1 (epoch 622-07-16) ≈ 354.367 × (year - 1) + 30 × (m - 1) + d
  const approxJulianDay = 1948439
    + Math.floor((10631 * (h.year - 1) + 354) / 30)
    + Math.floor((325 * (h.month - 1) + 320) / 11)
    + h.day;
  const center = new Date((approxJulianDay - 2440587.5) * 86400000);
  for (let off = -35; off <= 35; off += 1) {
    const candidate = new Date(center.getTime() + off * 86400000);
    const back = toHijri(candidate);
    if (back && back.year === h.year && back.month === h.month && back.day === h.day) {
      return candidate;
    }
  }
  return center; // best-effort
}

// ─────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────

export type HijriFormat = 'short' | 'medium' | 'long';

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
function toIndic(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[+d] ?? d);
}

/**
 * Format a Hijri date according to `locale` and `format`.
 *
 * @example
 *   formatHijri(new Date('2026-03-01'), 'ar', 'medium')
 *   // → "١٢ رمضان ١٤٤٧ هـ"
 *
 *   formatHijri(new Date('2026-03-01'), 'en', 'short')
 *   // → "12/09/1447 AH"
 */
export function formatHijri(
  value: Date | string | number | null | undefined,
  locale: 'ar' | 'ku' | 'en' = 'ar',
  format: HijriFormat = 'medium',
): string {
  const h = toHijri(value);
  if (!h) return '';
  const useIndic = locale === 'ar' || locale === 'ku';
  const d = useIndic ? toIndic(h.day) : String(h.day);
  const y = useIndic ? toIndic(h.year) : String(h.year);
  const mNum = useIndic ? toIndic(h.month).padStart(2, '0') : String(h.month).padStart(2, '0');
  const dPad = useIndic ? toIndic(h.day).padStart(2, '0') : String(h.day).padStart(2, '0');

  if (format === 'short') {
    return locale === 'en'
      ? `${dPad}/${mNum}/${y} AH`
      : `${dPad}/${mNum}/${y} هـ`;
  }
  const month = locale === 'en' ? h.month_name_en : h.month_name_ar;
  if (format === 'long') {
    return locale === 'en'
      ? `${d} ${month} ${y} AH`
      : `${d} ${month} ${y} هـ`;
  }
  // medium
  return locale === 'en'
    ? `${d} ${month} ${y} AH`
    : `${d} ${month} ${y} هـ`;
}

const hijriHelpers = {
  toHijri,
  fromHijri,
  formatHijri,
  HIJRI_MONTHS_AR,
  HIJRI_MONTHS_EN,
};

export default hijriHelpers;
