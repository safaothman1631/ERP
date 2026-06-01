/**
 * LanguageSwitcher — dropdown language selector supporting ku / en / ar.
 *
 * Features:
 * - Always visible in Topbar and Sidebar footer (Requirements 3.2, 3.3)
 * - Visible on login page before authentication (Requirement 3.2)
 * - On language change: calls i18n.changeLanguage(), updates uiStore.language,
 *   sets document dir + lang attributes (Requirements 3.4, 3.5, 3.6)
 * - Persists to localStorage['i18n.language'] (Requirement 3.7)
 * - Falls back to in-memory Zustand value if localStorage unavailable (Requirement 3.7)
 * - Uses resolveLanguage() to guard against invalid codes (Requirement 3.8)
 * - Displays active-language indicator (checkmark) (Requirement 3.9)
 * - Direction change applies with 250ms CSS transition (Requirement 3.4)
 *
 * Usage:
 *   <LanguageSwitcher />                  — icon + label, default size
 *   <LanguageSwitcher size="small" />     — compact variant
 *   <LanguageSwitcher showLabel={false} /> — icon only
 *
 * Requirements: 3.1–3.9, 10.1–10.9
 */
import React from 'react';
import { Button, Dropdown, Tooltip } from 'antd';
import { GlobalOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { resolveLanguage, isRTLLanguage, type Language } from '../utils/language';
import { useUiStore } from '../stores/uiStore';

interface LanguageSwitcherProps {
  /** Ant Design button size */
  size?: 'small' | 'middle' | 'large';
  /** Whether to show the language label next to the icon (default: true) */
  showLabel?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Button type */
  type?: 'text' | 'default' | 'primary' | 'dashed' | 'link';
  /** Dropdown z-index for overlays inside modals */
  dropdownZIndex?: number;
}

/** All supported languages with their display labels */
const LANGUAGES: Array<{ code: Language; label: string; nativeLabel: string }> = [
  { code: 'ku', label: 'Kurdish Sorani', nativeLabel: 'کوردی سۆرانی' },
  { code: 'en', label: 'English',        nativeLabel: 'English' },
  { code: 'ar', label: 'Arabic',         nativeLabel: 'العربية' },
];

/** Short labels shown in the button */
const LANG_SHORT: Record<Language, string> = {
  ku: 'کو',
  en: 'EN',
  ar: 'ع',
};

/**
 * Persist language to localStorage under the spec-required key 'i18n.language'.
 * Falls back silently if localStorage is unavailable (private browsing, etc.).
 * Requirements: 3.7
 */
function persistLanguage(lang: Language): void {
  try {
    localStorage.setItem('i18n.language', lang);
  } catch {
    // localStorage unavailable — in-memory Zustand value is the fallback (Requirement 3.7)
  }
}

/**
 * Apply RTL/LTR direction to the document root element.
 * Uses a 250ms CSS transition (set in globalStyles.css) for smooth direction change.
 * Requirements: 3.4, 3.5, 3.6
 */
function applyDocumentDirection(lang: Language): void {
  const isRTL = isRTLLanguage(lang);
  document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', lang);
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  size = 'middle',
  showLabel = true,
  className,
  type = 'text',
  dropdownZIndex,
}) => {
  const { i18n, t } = useTranslation();
  const setLanguage = useUiStore((s) => s.setLanguage);

  // Resolve current language — guard against invalid codes (Requirement 3.8)
  const rawLang = i18n.language || 'ku';
  const currentLang = resolveLanguage(rawLang);
  const shortLabel = LANG_SHORT[currentLang];

  const handleLanguageChange = (code: Language) => {
    // Guard against invalid codes (Requirement 3.8)
    const resolved = resolveLanguage(code);

    // 1. Call i18n.changeLanguage (triggers i18n.ts languageChanged listener)
    i18n.changeLanguage(resolved);

    // 2. Update uiStore.language (Requirement 3.7 fallback)
    setLanguage(resolved);

    // 3. Apply document direction + lang attribute (Requirements 3.5, 3.6)
    applyDocumentDirection(resolved);

    // 4. Persist to localStorage['i18n.language'] (Requirement 3.7)
    persistLanguage(resolved);
  };

  const menuItems = LANGUAGES.map(({ code, nativeLabel }) => ({
    key: code,
    label: (
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          minWidth: 160,
          fontWeight: code === currentLang ? 600 : 400,
        }}
      >
        <span>{nativeLabel}</span>
        {/* Active-language indicator — checkmark (Requirement 3.9) */}
        {code === currentLang && (
          <CheckOutlined
            style={{ color: '#7B61FF', fontSize: 12 }}
            aria-label={t('language_active', 'Active language')}
          />
        )}
      </span>
    ),
    onClick: () => handleLanguageChange(code),
  }));

  const trigger = (
    <Button
      type={type}
      size={size}
      icon={<GlobalOutlined />}
      aria-label={t('tooltip_language_switch', 'Switch Language')}
      aria-haspopup="listbox"
      aria-expanded={undefined}
      className={className}
    >
      {showLabel && (
        <span
          style={{
            fontSize: size === 'small' ? 11 : 13,
            fontWeight: 600,
            marginInlineStart: 2,
          }}
        >
          {shortLabel}
        </span>
      )}
    </Button>
  );

  return (
    <Tooltip title={t('tooltip_language_switch', 'Switch Language')}>
      <Dropdown
        menu={{ items: menuItems, selectedKeys: [currentLang] }}
        trigger={['click']}
        placement="bottomRight"
        getPopupContainer={() => document.body}
        styles={dropdownZIndex ? { root: { zIndex: dropdownZIndex } } : undefined}
      >
        {trigger}
      </Dropdown>
    </Tooltip>
  );
};

export default LanguageSwitcher;
export { LanguageSwitcher };
