/**
 * CalendarPreferenceContext — tenant-level Gregorian / Hijri / Both choice
 * (growth-to-100 § R4.11).
 *
 * Persistence: `localStorage["calendar_preference"]`.
 *
 * Consumers either:
 *   * use `formatDate` directly when Gregorian is enough (default), OR
 *   * read `preference` and render the Hijri line themselves via
 *     `formatHijri` from `utils/hijri-date.ts` when `'hijri'` or `'both'`.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type CalendarPreference = 'gregorian' | 'hijri' | 'both';

interface CalendarPreferenceContextValue {
  preference: CalendarPreference;
  setPreference: (next: CalendarPreference) => void;
  showHijri: boolean;       // convenience — true for 'hijri' | 'both'
  showGregorian: boolean;   // convenience — true for 'gregorian' | 'both'
}

const STORAGE_KEY = 'calendar_preference';
const DEFAULT: CalendarPreference = 'gregorian';

function _read(): CalendarPreference {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'gregorian' || v === 'hijri' || v === 'both') return v;
  } catch { /* ignore */ }
  return DEFAULT;
}

function _write(value: CalendarPreference): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch { /* ignore */ }
}

const Context = createContext<CalendarPreferenceContextValue | null>(null);

export const CalendarPreferenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, _setPreference] = useState<CalendarPreference>(_read);

  const setPreference = useCallback((next: CalendarPreference) => {
    _setPreference(next);
    _write(next);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'gregorian' || e.newValue === 'hijri' || e.newValue === 'both')) {
        _setPreference(e.newValue as CalendarPreference);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const value = useMemo<CalendarPreferenceContextValue>(() => ({
    preference,
    setPreference,
    showHijri: preference === 'hijri' || preference === 'both',
    showGregorian: preference === 'gregorian' || preference === 'both',
  }), [preference, setPreference]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export function useCalendarPreference(): CalendarPreferenceContextValue {
  const ctx = useContext(Context);
  if (ctx) return ctx;
  return {
    preference: DEFAULT,
    setPreference: () => { /* no-op */ },
    showHijri: false,
    showGregorian: true,
  };
}

export default CalendarPreferenceProvider;
