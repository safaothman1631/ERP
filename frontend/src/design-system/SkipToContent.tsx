/**
 * SkipToContent — "Skip to main content" link for keyboard users.
 *
 * Renders a visually hidden link that becomes visible on focus.
 * Allows keyboard users to bypass navigation and jump directly to main content.
 *
 * Requirements: 17.2 — full keyboard navigation support
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { palette } from '../theme/tokens';

export interface SkipToContentProps {
  /** The id of the main content element to skip to. Defaults to "main-content". */
  targetId?: string;
}

/**
 * SkipToContent — renders a visually hidden "Skip to main content" link.
 * Becomes visible when focused via keyboard (Tab key).
 *
 * Usage: Place at the very top of the page layout, before any navigation.
 *
 * @example
 *   <SkipToContent />
 *   <SideNav ... />
 *   <main id="main-content">...</main>
 */
export const SkipToContent: React.FC<SkipToContentProps> = ({ targetId = 'main-content' }) => {
  const { t } = useTranslation();

  return (
    <a
      href={`#${targetId}`}
      style={{
        position: 'absolute',
        top: -9999,
        insetInlineStart: -9999,
        zIndex: 9999,
        padding: '8px 16px',
        background: palette.primary500,
        color: '#fff',
        fontWeight: 600,
        fontSize: 14,
        borderRadius: 4,
        textDecoration: 'none',
        // Becomes visible on focus
        transition: 'top 0.1s, left 0.1s',
      }}
      onFocus={(e) => {
        e.currentTarget.style.top = '8px';
        e.currentTarget.style.insetInlineStart = '8px';
      }}
      onBlur={(e) => {
        e.currentTarget.style.top = '-9999px';
        e.currentTarget.style.insetInlineStart = '-9999px';
      }}
    >
      {t('a11y.skipToContent', 'Skip to main content')}
    </a>
  );
};

export default SkipToContent;
