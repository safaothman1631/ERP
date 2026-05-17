/**
 * useLanguage — React hook for language persistence and switching.
 *
 * Wraps i18next so components get a reactive `language` value and a
 * `changeLanguage` function without importing i18n directly.
 *
 * On every call to `changeLanguage`:
 *   - i18next switches the active language
 *   - localStorage["app_language"] is updated (via i18n.on('languageChanged'))
 *   - document.documentElement.dir is set to "rtl" for Kurdish/Arabic, "ltr" otherwise
 *   - document.documentElement.lang is set to the language code
 *
 * Requirements: 4.3, 4.4, 4.5
 */
import { useState, useEffect, useCallback } from 'react';
import i18n, { RTL_LANGS } from '../i18n';

export type SupportedLanguage = 'ku' | 'ar' | 'en';

export interface UseLanguageReturn {
  /** The currently active language code (e.g. "ku", "ar", "en"). */
  language: SupportedLanguage;
  /** Whether the current language is RTL (Kurdish or Arabic). */
  isRTL: boolean;
  /**
   * Switch to a new language.
   * Persists to localStorage, updates document dir/lang attributes.
   */
  changeLanguage: (lang: SupportedLanguage) => Promise<void>;
}

export function useLanguage(): UseLanguageReturn {
  const [language, setLanguage] = useState<SupportedLanguage>(
    (i18n.language as SupportedLanguage) || 'ku'
  );

  useEffect(() => {
    const handler = (lng: string) => {
      setLanguage(lng as SupportedLanguage);
    };
    i18n.on('languageChanged', handler);
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, []);

  const changeLanguage = useCallback(async (lang: SupportedLanguage) => {
    await i18n.changeLanguage(lang);
  }, []);

  return {
    language,
    isRTL: RTL_LANGS.has(language),
    changeLanguage,
  };
}
