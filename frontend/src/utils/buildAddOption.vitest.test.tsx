/**
 * buildAddOption.vitest.test.tsx
 *
 * Unit tests for Add_Option navigation behaviour.
 *
 * Runner: Vitest (jsdom environment)
 *
 * Feature: nav-settings-cleanup
 * Requirements: 5.3, 5.5
 */
import { describe, it, expect, vi } from 'vitest';
import {
  handleAddOptionChange,
  buildEffectiveOptions,
} from './buildAddOption';

// ---------------------------------------------------------------------------
// Requirement 5.3 — selecting '__add__' calls navigate with the correct route
// ---------------------------------------------------------------------------
describe('handleAddOptionChange', () => {
  it('calls navigate when value is __add__', () => {
    const navigate = vi.fn();
    const result = handleAddOptionChange('__add__', '/settings?s=fiscal', navigate);
    expect(result).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/settings?s=fiscal');
  });

  it('does not call navigate when value is a normal option value', () => {
    const navigate = vi.fn();
    const result = handleAddOptionChange('2025', '/settings?s=fiscal', navigate);
    expect(result).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Requirement 5.5 — when options is non-empty, Add_Option is NOT present
// ---------------------------------------------------------------------------
describe('buildEffectiveOptions', () => {
  it('returns original options when non-empty', () => {
    const options = [{ value: '1', label: 'FY 2025' }];
    const result = buildEffectiveOptions(options, 'Fiscal Year', '/settings?s=fiscal', vi.fn());
    expect(result).toEqual(options);
    expect(result.some(o => o.value === '__add__')).toBe(false);
  });

  it('returns a single Add_Option when options is empty', () => {
    const navigate = vi.fn();
    const result = buildEffectiveOptions([], 'Fiscal Year', '/settings?s=fiscal', navigate);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('__add__');
  });
});
