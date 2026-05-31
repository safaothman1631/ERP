/**
 * formatCurrency — unit tests.
 * Validates R9.5 (locale-aware currency formatting).
 */

import { describe, it, expect } from 'vitest';
import { formatCurrency } from './formatCurrency';

describe('formatCurrency', () => {
  describe('IQD (Iraqi Dinar)', () => {
    it('renders no decimals', () => {
      const out = formatCurrency(1234567, 'IQD', 'en');
      // Allow either ASCII space or NBSP between number and symbol.
      expect(out).toMatch(/^1,234,567[\s\u00a0]IQD$/);
    });

    it('uses the localized symbol in Arabic', () => {
      const out = formatCurrency(1234567, 'IQD', 'ar');
      expect(out).toContain('د.ع');
      expect(out).not.toMatch(/\d\.\d/); // no decimal separator in the number (the symbol د.ع has a literal dot)
    });

    it('uses the localized symbol in Kurdish', () => {
      const out = formatCurrency(1000, 'IQD', 'ku');
      expect(out).toContain('د.ع');
    });

    it('rounds rather than truncates fractional input', () => {
      const out = formatCurrency(123.7, 'IQD', 'en');
      expect(out).toMatch(/^124[\s\u00a0]IQD$/);
    });

    it('formats zero', () => {
      expect(formatCurrency(0, 'IQD', 'en')).toMatch(/0[\s\u00a0]IQD/);
    });

    it('formats negative values', () => {
      const out = formatCurrency(-500, 'IQD', 'en');
      expect(out).toContain('500');
      expect(out).toMatch(/-|−/);
    });
  });

  describe('USD', () => {
    it('uses two decimals and a $ symbol', () => {
      const out = formatCurrency(1234.5, 'USD', 'en-US');
      expect(out).toBe('$1,234.50');
    });

    it('handles zero', () => {
      expect(formatCurrency(0, 'USD', 'en-US')).toBe('$0.00');
    });

    it('handles very large values', () => {
      const out = formatCurrency(1_000_000_000.99, 'USD', 'en-US');
      expect(out).toBe('$1,000,000,000.99');
    });

    it('handles negative values', () => {
      const out = formatCurrency(-1234.5, 'USD', 'en-US');
      // Intl uses either "-$1,234.50" or "($1,234.50)" depending on locale; both valid.
      expect(out).toMatch(/-?\$?1,234\.50|\(\$1,234\.50\)/);
    });
  });

  describe('EUR', () => {
    it('formats with Euro symbol', () => {
      const out = formatCurrency(1234.5, 'EUR', 'de-DE');
      expect(out).toContain('€');
      expect(out).toContain('1.234,50');
    });
  });

  describe('Edge cases', () => {
    it('returns empty string for NaN', () => {
      expect(formatCurrency(NaN, 'USD', 'en-US')).toBe('');
    });

    it('returns empty string for Infinity', () => {
      expect(formatCurrency(Infinity, 'USD', 'en-US')).toBe('');
      expect(formatCurrency(-Infinity, 'USD', 'en-US')).toBe('');
    });

    it('falls back gracefully for unknown currencies', () => {
      // ZZZ is reserved as "no currency"; some Intl impls throw.
      const out = formatCurrency(100, 'ZZZ', 'en');
      expect(out).toContain('100');
    });

    it('is pluggable — override has no decimals', () => {
      // Confirms the IQD override took effect (vs Intl's default for IQD,
      // which prints 3 decimals in some browsers).
      const out = formatCurrency(1, 'IQD', 'en');
      expect(out).not.toContain('.000');
    });
  });
});
