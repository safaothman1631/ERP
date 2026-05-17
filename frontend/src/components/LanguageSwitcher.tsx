/**
 * LanguageSwitcher — reusable language toggle button.
 *
 * Switches between Kurdish (ku) and English (en) without a page reload.
 * The active language is persisted to localStorage via i18n.ts's
 * `languageChanged` listener, and the document direction (RTL/LTR) is
 * updated automatically.
 *
 * Usage:
 *   <LanguageSwitcher />                  — icon + label, default size
 *   <LanguageSwitcher size="small" />     — compact variant
 *   <LanguageSwitcher showLabel={false} /> — icon only
 *
 * Requirements: 18.1, 18.5
 */
import React from 'react';
import { Button, Tooltip } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface LanguageSwitcherProps {
  /** Ant Design button size */
  size?: 'small' | 'middle' | 'large';
  /** Whether to show the language label next to the icon (default: true) */
  showLabel?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Button type */
  type?: 'text' | 'default' | 'primary' | 'dashed' | 'link';
}

const LANG_LABELS: Record<string, { label: string; next: string; nextLabel: string }> = {
  ku: { label: 'کوردی', next: 'en', nextLabel: 'English' },
  en: { label: 'English', next: 'ku', nextLabel: 'کوردی' },
  ar: { label: 'عربی', next: 'en', nextLabel: 'English' },
};

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  size = 'middle',
  showLabel = true,
  className,
  type = 'text',
}) => {
  const { i18n, t } = useTranslation();
  const current = i18n.language || 'ku';
  const info = LANG_LABELS[current] ?? LANG_LABELS['ku'];

  const handleToggle = () => {
    i18n.changeLanguage(info.next);
  };

  return (
    <Tooltip title={`${t('tooltip_language_switch', 'Switch Language')} → ${info.nextLabel}`}>
      <Button
        type={type}
        size={size}
        icon={<GlobalOutlined />}
        onClick={handleToggle}
        aria-label={`${t('tooltip_language_switch', 'Switch Language')} → ${info.nextLabel}`}
        className={className}
      >
        {showLabel && (
          <span style={{ fontSize: size === 'small' ? 11 : 13, fontWeight: 600 }}>
            {info.nextLabel}
          </span>
        )}
      </Button>
    </Tooltip>
  );
};

export default LanguageSwitcher;
