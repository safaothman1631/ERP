/**
 * formatNumber — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { formatNumber } from './formatNumber';

describe('formatNumber', () => {
  it('formats with grouping in English', () => {
    expect(formatNumber(1234567, 'en-US')).toBe('1,234,567');
  });

  it('formats with German grouping', () => {
    expect(formatNumber(1234567.89, 'de-DE')).toBe('1.234.567,89');
  });

  it('uses Arabic-Indic digits when requested', () => {
    const out = formatNumber(1234, 'ar', { arabicIndic: true });
    expect(out).toMatch(/[٠-٩]/);
  });

  it('uses Latin digits when arabicIndic=false', () => {
    const out = formatNumber(1234, 'ar', { arabicIndic: false });
    expect(out).toMatch(/\d/);
    expect(out).not.toMatch(/[٠-٩]/);
  });

  it('respects minimumFractionDigits', () => {
    expect(formatNumber(5, 'en-US', { minimumFractionDigits: 2 })).toBe('5.00');
  });

  it('handles zero', () => {
    expect(formatNumber(0, 'en-US')).toBe('0');
  });

  it('handles negative numbers', () => {
    expect(formatNumber(-1234.5, 'en-US')).toBe('-1,234.5');
  });

  it('handles very large numbers', () => {
    expect(formatNumber(1_000_000_000_000, 'en-US')).toBe('1,000,000,000,000');
  });

  it('returns empty string for NaN / Infinity', () => {
    expect(formatNumber(NaN, 'en-US')).toBe('');
    expect(formatNumber(Infinity, 'en-US')).toBe('');
  });

  it('maps Kurdish (ku) to a real Intl locale', () => {
    const out = formatNumber(1234, 'ku');
    expect(out.length).toBeGreaterThan(0);
  });
});
