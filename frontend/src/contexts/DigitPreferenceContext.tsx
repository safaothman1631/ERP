/**
 * DigitPreferenceContext — tenant-level Arabic-Indic vs Latin digits choice
 * (growth-to-100 § R4.8).
 *
 * Default per locale:
 *   - Arabic   → Arabic-Indic (٠١٢٣…)
 *   - Kurdish  → Latin (0123…)  *(common practice; can be overridden)*
 *   - English  → Latin
 *
 * Persistence: `localStorage["digit_preference"]` (values: `"indic" | "latin"`).
 * When unset, the locale default applies and the consumer sees that.
 *
 * The provider is intentionally tiny — no React Query, no async hydration —
 * because the value is needed on the very first render of every formatter.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { defaultDigitPreference } from '../utils/arabic-digits';
import { useLanguage } from '../hooks/useLanguage';

export type DigitPreference = 'indic' | 'latin' | 'auto';

interface DigitPreferenceContextValue {
  /** The raw stored preference (or 'auto' if the user hasn't chosen). */
  preference: DigitPreference;
  /** The resolved boolean — what formatters should pass to `arabicIndic`. */
  useArabicIndic: boolean;
  /** Setter — persists to localStorage. */
  setPreference: (next: DigitPreference) => void;
}

const STORAGE_KEY = 'digit_preference';

const Context = createContext<DigitPreferenceContextValue | null>(null);

function _read(): DigitPreference {
  if (typeof window === 'undefined') return 'auto';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'indic' || v === 'latin' || v === 'auto') return v;
  } catch {
    /* localStorage blocked — fall through */
  }
  return 'auto';
}

function _write(value: DigitPreference): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export const DigitPreferenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { language } = useLanguage();
  const [preference, _setPreference] = useState<DigitPreference>(_read);

  const setPreference = useCallback((next: DigitPreference) => {
    _setPreference(next);
    _write(next);
  }, []);

  // Re-emit on cross-tab change so other open windows pick up the new setting.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'indic' || e.newValue === 'latin' || e.newValue === 'auto')) {
        _setPreference(e.newValue as DigitPreference);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const useArabicIndic = useMemo(() => {
    if (preference === 'indic') return true;
    if (preference === 'latin') return false;
    return defaultDigitPreference(language);
  }, [preference, language]);

  const value = useMemo<DigitPreferenceContextValue>(
    () => ({ preference, useArabicIndic, setPreference }),
    [preference, useArabicIndic, setPreference],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
};

/**
 * Hook — returns the resolved digit preference. Safe to call without a
 * provider (falls back to locale-default and a no-op setter).
 */
export function useDigitPreference(): DigitPreferenceContextValue {
  const ctx = useContext(Context);
  // Always-call hooks (Rules of Hooks): compute the fallback even when
  // a provider IS present — React deduplicates the second branch.
  const { language } = useLanguage();
  const fallbackUseArabicIndic = defaultDigitPreference(language);
  if (ctx) return ctx;
  return {
    preference: 'auto',
    useArabicIndic: fallbackUseArabicIndic,
    setPreference: () => {
      /* no-op when provider is absent */
    },
  };
}

export default DigitPreferenceProvider;
