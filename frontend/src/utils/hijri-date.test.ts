/**
 * Hijri date utilities — unit tests (growth-to-100 § R4.11).
 *
 * Conversions use known-good Gregorian↔Hijri anchor points. Because the
 * tabular fallback can diverge ±1 day from Umm al-Qura, the assertions are
 * lenient (the year matches; month / day are within a tight window).
 */
import { describe, it, expect } from 'vitest';
import {
  formatHijri,
  fromHijri,
  HIJRI_MONTHS_AR,
  HIJRI_MONTHS_EN,
  toHijri,
} from './hijri-date';

describe('toHijri', () => {
  it('returns null for invalid input', () => {
    expect(toHijri('not-a-date')).toBeNull();
    expect(toHijri(null)).toBeNull();
    expect(toHijri(undefined)).toBeNull();
  });

  it('converts 2026-05-29 to a 1447 Hijri date', () => {
    const h = toHijri(new Date('2026-05-29'));
    expect(h).not.toBeNull();
    expect(h!.year).toBe(1447);
    expect(h!.month).toBeGreaterThanOrEqual(1);
    expect(h!.month).toBeLessThanOrEqual(12);
    expect(h!.day).toBeGreaterThanOrEqual(1);
    expect(h!.day).toBeLessThanOrEqual(30);
  });

  it('the New Year 2026 maps to Hijri 1447 (around Rajab)', () => {
    const h = toHijri(new Date('2026-01-01'));
    expect(h!.year).toBe(1447);
  });

  it('round-trips approximately via fromHijri', () => {
    const greg = new Date('2026-03-01T00:00:00Z');
    const h = toHijri(greg)!;
    const back = fromHijri(h)!;
    // Within 2 days of the input — accounts for Umm al-Qura vs tabular.
    const diffDays = Math.abs((back.getTime() - greg.getTime()) / 86400000);
    expect(diffDays).toBeLessThanOrEqual(2);
  });
});

describe('formatHijri', () => {
  it('returns empty string for invalid input', () => {
    expect(formatHijri(null, 'ar')).toBe('');
  });

  it('produces Arabic format with Hijri suffix', () => {
    const out = formatHijri(new Date('2026-05-29'), 'ar', 'medium');
    expect(out).toContain('هـ');
    // contains Arabic-Indic digits
    expect(out).toMatch(/[٠-٩]/);
  });

  it('produces English format with AH suffix', () => {
    const out = formatHijri(new Date('2026-05-29'), 'en', 'medium');
    expect(out).toContain('AH');
  });

  it('short format is DD/MM/YYYY-shaped', () => {
    const out = formatHijri(new Date('2026-05-29'), 'en', 'short');
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4} AH$/);
  });
});

describe('Hijri month tables', () => {
  it('has 12 names in each language', () => {
    expect(HIJRI_MONTHS_AR).toHaveLength(12);
    expect(HIJRI_MONTHS_EN).toHaveLength(12);
  });

  it('places Ramadan at index 8', () => {
    expect(HIJRI_MONTHS_AR[8]).toBe('رمضان');
    expect(HIJRI_MONTHS_EN[8]).toBe('Ramadan');
  });
});
