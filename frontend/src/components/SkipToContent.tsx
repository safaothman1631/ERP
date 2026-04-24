import React from 'react';
import { useTranslation } from 'react-i18next';
import { palette, a11y, zIndex } from '../theme/tokens';

/**
 * SkipToContent — Sprint 1 v2 — a11y skip link.
 * Hidden until focused via keyboard. Jumps to <main id="main-content">.
 */
export const SkipToContent: React.FC = () => {
  const { t } = useTranslation();
  return (
    <a
      href="#main-content"
      style={{
        position: 'absolute',
        insetInlineStart: a11y.focusRingOffset,
        top: a11y.focusRingOffset,
        transform: 'translateY(-150%)',
        background: palette.primary500,
        color: '#fff',
        padding: '8px 16px',
        borderRadius: 6,
        fontSize: 14,
        fontWeight: 600,
        zIndex: zIndex.tooltip + 1,
        textDecoration: 'none',
        transition: 'transform 150ms cubic-bezier(0.2,0,0,1)',
      }}
      onFocus={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
      onBlur={(e) => { e.currentTarget.style.transform = 'translateY(-150%)'; }}
    >
      {t('a11y.skip_to_content', 'بازدان بۆ ناوەڕۆکی سەرەکی')}
    </a>
  );
};

export default SkipToContent;
