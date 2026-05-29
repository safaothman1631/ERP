/**
 * Arabic-Indic digit utilities — unit tests (growth-to-100 § R4.8).
 */
import { describe, it, expect } from 'vitest';
import {
  defaultDigitPreference,
  formatNumberDigits,
  toArabicIndic,
  toLatin,
} from './arabic-digits';

describe('toArabicIndic', () => {
  it('rewrites digits while preserving non-digits', () => {
    expect(toArabicIndic('2026-05-29')).toBe('٢٠٢٦-٠٥-٢٩');
    expect(toArabicIndic('INV-000123')).toBe('INV-٠٠٠١٢٣');
  });

  it('handles null/undefined safely', () => {
    expect(toArabicIndic(null)).toBe('');
    expect(toArabicIndic(undefined)).toBe('');
  });

  it('handles numbers as input', () => {
    expect(toArabicIndic(12345)).toBe('١٢٣٤٥');
  });
});

describe('toLatin', () => {
  it('reverses Arabic-Indic to Latin', () => {
    expect(toLatin('٢٠٢٦-٠٥-٢٩')).toBe('2026-05-29');
  });

  it('is a no-op on already-Latin text', () => {
    expect(toLatin('hello 2026')).toBe('hello 2026');
  });
});

describe('formatNumberDigits', () => {
  it('round-trips through Arabic-Indic when requested', () => {
    expect(formatNumberDigits('123', true)).toBe('١٢٣');
    expect(formatNumberDigits('١٢٣', false)).toBe('123');
  });
});

describe('defaultDigitPreference', () => {
  it('returns true for Arabic locales', () => {
    expect(defaultDigitPreference('ar')).toBe(true);
    expect(defaultDigitPreference('ar-IQ')).toBe(true);
  });

  it('returns false for Kurdish and English', () => {
    expect(defaultDigitPreference('ku')).toBe(false);
    expect(defaultDigitPreference('en')).toBe(false);
    expect(defaultDigitPreference('en-US')).toBe(false);
  });
});
