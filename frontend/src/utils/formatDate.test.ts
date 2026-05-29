/**
 * formatDate — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { formatDate } from './formatDate';

const SAMPLE = new Date(Date.UTC(2026, 4, 27, 9, 30, 0)); // 2026-05-27 09:30 UTC

describe('formatDate', () => {
  it('formats English long dates', () => {
    const out = formatDate(SAMPLE, 'en-US', { dateStyle: 'long', timeZone: 'UTC' });
    expect(out).toContain('2026');
    expect(out).toMatch(/May/i);
  });

  it('formats Arabic dates with Arabic-Indic digits by default when requested', () => {
    const out = formatDate(SAMPLE, 'ar', { dateStyle: 'long', arabicIndic: true, timeZone: 'UTC' });
    // Arabic-Indic digit ٢ (U+0662) should appear somewhere.
    expect(out).toMatch(/[٠-٩]/);
  });

  it('maps Kurdish (ku) to a real Intl locale (ar-IQ) without throwing', () => {
    const out = formatDate(SAMPLE, 'ku', { dateStyle: 'medium', timeZone: 'UTC' });
    expect(out.length).toBeGreaterThan(0);
  });

  it('forces Latin digits when arabicIndic=false', () => {
    const out = formatDate(SAMPLE, 'ar', {
      dateStyle: 'long',
      arabicIndic: false,
      timeZone: 'UTC',
    });
    expect(out).toMatch(/\d/); // contains ASCII digit
    expect(out).not.toMatch(/[٠-٩]/); // no Arabic-Indic
  });

  it('accepts an ISO string', () => {
    const out = formatDate('2026-05-27T00:00:00Z', 'en-US', { dateStyle: 'short', timeZone: 'UTC' });
    expect(out).toContain('26');
  });

  it('accepts a numeric epoch', () => {
    const out = formatDate(SAMPLE.getTime(), 'en-US', { dateStyle: 'short', timeZone: 'UTC' });
    expect(out).toContain('26');
  });

  it('returns empty string for invalid input', () => {
    expect(formatDate('not-a-date', 'en')).toBe('');
    expect(formatDate(new Date('nope'), 'en')).toBe('');
  });

  it('defaults to medium date style', () => {
    const out = formatDate(SAMPLE, 'en-US', { timeZone: 'UTC' });
    expect(out.length).toBeGreaterThan(0);
  });
});
