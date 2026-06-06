/**
 * IQD denomination utilities — unit tests (growth-to-100 § R4.10).
 */
import { describe, it, expect } from 'vitest';
import {
  breakDown,
  DENOMINATIONS,
  format,
  quickCashTenders,
  roundToNearestDenomination,
  sumFromBreakdown,
} from './iqd-denominations';

describe('DENOMINATIONS', () => {
  it('lists exactly the current IQD notes', () => {
    expect([...DENOMINATIONS]).toEqual([
      50_000, 25_000, 10_000, 5_000, 1_000, 500, 250,
    ]);
  });
});

describe('breakDown', () => {
  it('handles the empty case', () => {
    expect(breakDown(0).size).toBe(0);
    expect(breakDown(-100).size).toBe(0);
    expect(breakDown(NaN).size).toBe(0);
  });

  it('makes 50K with a single note', () => {
    const out = breakDown(50_000);
    expect(out.get(50_000)).toBe(1);
    expect(sumFromBreakdown(out)).toBe(50_000);
  });

  it('breaks down 127,750 greedily', () => {
    const out = breakDown(127_750);
    expect(out.get(50_000)).toBe(2);   // 100k
    expect(out.get(25_000)).toBe(1);   // 125k
    expect(out.get(1_000)).toBe(2);    // 127k
    expect(out.get(500)).toBe(1);      // 127.5k
    expect(out.get(250)).toBe(1);      // 127.75k
    expect(sumFromBreakdown(out)).toBe(127_750);
  });

  it('rounds down to nearest 250 for fractional amounts', () => {
    const out = breakDown(1_000.99);
    expect(sumFromBreakdown(out)).toBe(1_000);
  });

  it('does not include zero-count denominations', () => {
    const out = breakDown(50_000);
    expect(out.has(1_000)).toBe(false);
    expect(out.has(500)).toBe(false);
  });
});

describe('roundToNearestDenomination', () => {
  it('rounds up to the next 250 by default', () => {
    expect(roundToNearestDenomination(123, 'up')).toBe(250);
    expect(roundToNearestDenomination(250, 'up')).toBe(250);
    expect(roundToNearestDenomination(251, 'up')).toBe(500);
  });

  it('rounds down', () => {
    expect(roundToNearestDenomination(499, 'down')).toBe(250);
    expect(roundToNearestDenomination(500, 'down')).toBe(500);
  });

  it('rounds nearest', () => {
    // nearest === Math.round(x / step) * step (step = 250).
    expect(roundToNearestDenomination(124, 'nearest')).toBe(0); // 0.496 → 0
    expect(roundToNearestDenomination(125, 'nearest')).toBe(250); // 0.5 → 1 (half-up)
    expect(roundToNearestDenomination(126, 'nearest')).toBe(250);
    expect(roundToNearestDenomination(374, 'nearest')).toBe(250); // 1.496 → 1
    expect(roundToNearestDenomination(375, 'nearest')).toBe(500); // 1.5 → 2
    expect(roundToNearestDenomination(500, 'nearest')).toBe(500);
  });

  it('supports custom step', () => {
    expect(roundToNearestDenomination(7_100, 'up', 5_000)).toBe(10_000);
    expect(roundToNearestDenomination(50_001, 'up', 50_000)).toBe(100_000);
  });

  it('handles non-finite input gracefully', () => {
    expect(roundToNearestDenomination(NaN, 'up')).toBe(0);
  });
});

describe('quickCashTenders', () => {
  it('returns ascending unique suggestions', () => {
    const out = quickCashTenders(7_250);
    // includes exact 7_250 because it is divisible by 250
    expect(out.includes(7_250)).toBe(true);
    // rounds up to 10K, 25K, 50K
    expect(out.includes(10_000)).toBe(true);
    expect(out.includes(25_000)).toBe(true);
    expect(out.includes(50_000)).toBe(true);
    // strictly ascending
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i]).toBeGreaterThan(out[i - 1]!);
    }
  });

  it('returns empty list for zero amount', () => {
    expect(quickCashTenders(0)).toEqual([]);
  });
});

describe('format', () => {
  it('formats with Kurdish locale and Arabic separator', () => {
    expect(format(1_500_000, 'ku')).toBe('1٬500٬000 د.ع');
  });

  it('formats with English locale and comma', () => {
    expect(format(1_500_000, 'en')).toBe('1,500,000 IQD');
  });

  it('renders Arabic-Indic digits when requested', () => {
    const out = format(1_234, 'ar', true);
    expect(out).toContain('١');
    expect(out).toContain('د.ع');
  });

  it('handles zero', () => {
    expect(format(0, 'en')).toBe('0 IQD');
  });
});
