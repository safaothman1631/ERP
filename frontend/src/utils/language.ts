/**
 * language.ts — Language resolution utilities
 *
 * Provides:
 *   - resolveLanguage() — resolves a language code to a supported Language type,
 *     falling back to Kurdish Sorani ('ku') for any unsupported code.
 *
 * Requirements: 3.8, 20.3
 */

export const VALID_LANGUAGES = ['ku', 'en', 'ar'] as const;
export type Language = typeof VALID_LANGUAGES[number];

/**
 * Resolves a language code string to a supported Language.
 * Returns 'ku' (Kurdish Sorani) for any code not in ['ku', 'en', 'ar'].
 *
 * @param code - Any string language code
 * @returns    - A valid Language ('ku' | 'en' | 'ar'), defaulting to 'ku'
 *
 * Requirements: 3.8
 */
export function resolveLanguage(code: string): Language {
  if ((VALID_LANGUAGES as readonly string[]).includes(code)) {
    return code as Language;
  }
  return 'ku';
}

/**
 * Returns true if the given language is RTL (right-to-left).
 * Kurdish Sorani and Arabic are RTL; English is LTR.
 */
export function isRTLLanguage(lang: Language): boolean {
  return lang === 'ku' || lang === 'ar';
}
