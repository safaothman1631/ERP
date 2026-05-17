/**
 * buildAddOption / buildEffectiveOptions
 *
 * Utility helpers for Ant Design <Select> components that may render with zero
 * options.  When the options array is empty, `buildEffectiveOptions` injects a
 * single "＋ Add …" escape-hatch option that navigates the user to the entity
 * creation screen.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.6
 */
import React from 'react';
import type { NavigateFunction } from 'react-router-dom';

/** Minimal shape of an Ant Design Select option. */
export interface SelectOption {
  value: string | number;
  label: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

/** The sentinel value used to identify the Add_Option. */
export const ADD_OPTION_VALUE = '__add__' as const;

/**
 * Builds a single Ant Design Select option that acts as a navigation
 * escape-hatch when the options list is empty.
 *
 * @param entityName  Human-readable entity name (e.g. "Fiscal Year").
 * @param route       Destination route (e.g. "/settings?s=fiscal").
 * @param navigate    React Router `NavigateFunction` from `useNavigate()`.
 * @param lang        Active language code — `'ku'` renders Kurdish label.
 *                    Defaults to `'en'`.
 */
export function buildAddOption(
  entityName: string,
  route: string,
  navigate: NavigateFunction,
  lang?: string,
): SelectOption {
  const isKurdish = lang === 'ku';
  const labelText = isKurdish
    ? `＋ زیادکردنی ${entityName}`
    : `＋ Add ${entityName}`;

  return {
    value: ADD_OPTION_VALUE,
    label: (
      <span className="add-option-label" style={{ opacity: 0.65 }}>
        {labelText}
      </span>
    ),
    className: 'add-option',
  };
}

/**
 * `onChange` guard for Select components that include an Add_Option.
 *
 * Call this at the top of your `onChange` handler:
 *
 * ```tsx
 * onChange={(value) => {
 *   if (handleAddOptionChange(value, '/settings?s=fiscal', navigate)) return;
 *   // … normal handling …
 * }}
 * ```
 *
 * Falls back to `window.location.href` if `navigate` is unavailable.
 *
 * @returns `true` when the Add_Option was selected (caller should return early).
 */
export function handleAddOptionChange(
  value: string | number | null | undefined,
  route: string,
  navigate?: NavigateFunction,
): boolean {
  if (value !== ADD_OPTION_VALUE) return false;

  if (typeof navigate === 'function') {
    navigate(route);
  } else {
    // Fallback: navigate without React Router (e.g. outside Router context).
    window.location.href = route;
  }
  return true;
}

/**
 * Returns the effective options array for a Select component.
 *
 * - When `options` is non-empty, returns `options` unchanged.
 * - When `options` is empty, returns `[buildAddOption(...)]` so the user
 *   always has a way to create the missing entity.
 *
 * @param options     The options array derived from an API response.
 * @param entityName  Human-readable entity name passed to `buildAddOption`.
 * @param route       Creation route passed to `buildAddOption`.
 * @param navigate    React Router `NavigateFunction`.
 * @param lang        Active language code (`'ku'` for Kurdish).
 */
export function buildEffectiveOptions(
  options: SelectOption[],
  entityName: string,
  route: string,
  navigate: NavigateFunction,
  lang?: string,
): SelectOption[] {
  if (options.length > 0) return options;
  return [buildAddOption(entityName, route, navigate, lang)];
}
