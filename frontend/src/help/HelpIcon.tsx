/**
 * HelpIcon — universal Help_Icon button for the system-wide UX overhaul
 * (task 2.7).
 *
 * Renders a `<button>` with a `?` icon adjacent to a Section heading. When
 * activated (click, Enter, Space), it opens the {@link HelpPanel} for the
 * given `sectionId`.
 *
 * Graceful failure (R6.1)
 * -----------------------
 * When `useHelp(sectionId)` returns `unavailable: true` (the Help_Registry
 * chunk failed to load), the icon renders **nothing** — the surrounding
 * Section continues to render normally. A structured `warn` is logged so
 * the failure surfaces in monitoring without blocking the user.
 *
 * The same component is used for non-Settings Sections AND every Settings
 * sub-section, so the visual treatment is identical product-wide (R7.5).
 *
 * _Validates: Requirements 6.1, 6.2, 6.5, 7.5, 14.2_
 */
import React, { useCallback, useRef, useState } from 'react';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import type { TranslationKey } from '../i18n/types';
import { useHelp } from './useHelp';
import { HelpPanel } from './HelpPanel';
import type { SectionId } from './sectionIds';
import { a11y, palette, space } from '../theme/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface HelpIconProps {
  /** Identifier of the Section whose Help_Content this icon triggers. */
  sectionId: SectionId;
  /**
   * When provided, used instead of the default i18n key for the aria-label
   * suffix. Allows overriding the section name displayed in the aria-label
   * (e.g., "Help: Currencies" vs "Help: settings.currencies").
   */
  sectionNameKey?: TranslationKey;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Translation key for the aria-label pattern: "Help: {sectionName}" */
const ARIA_LABEL_KEY = 'helpIcon.ariaLabel';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Universal Help_Icon. Renders a `?` button adjacent to a Section heading.
 * When the Help_Registry is unavailable, renders nothing so the Section
 * continues to function normally (R6.1).
 */
export const HelpIcon: React.FC<HelpIconProps> = ({ sectionId, sectionNameKey }) => {
  const { t } = useTranslation();
  const resolved = useHelp(sectionId);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  // Graceful failure: if the registry is unavailable, render nothing.
  // The surrounding Section continues to render normally (R6.1).
  if (resolved.unavailable) {
    // Log a structured warning for monitoring.
    try {
      // eslint-disable-next-line no-console
      console.warn('[HelpIcon] Help registry unavailable for section:', sectionId);
    } catch {
      /* noop — never crash the section */
    }
    return null;
  }

  // Resolve the aria-label: "Help: {sectionName}"
  const sectionName = sectionNameKey
    ? t(sectionNameKey)
    : t(`${sectionId}.title`, { defaultValue: sectionId });
  const ariaLabel = t(ARIA_LABEL_KEY, {
    defaultValue: `Help: ${sectionName}`,
    sectionName,
  });

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        onClick={handleOpen}
        data-testid={`help-icon-${sectionId}`}
        data-help-section={sectionId}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minBlockSize: a11y.minTouchTarget,
          minInlineSize: a11y.minTouchTarget,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: palette.ink500,
          borderRadius: '50%',
          marginInlineStart: space.xs,
          transition: 'color 150ms ease, background 150ms ease',
        }}
      >
        <QuestionCircleOutlined style={{ fontSize: 16 }} />
      </button>
      {open && buttonRef.current && (
        <HelpPanel
          sectionId={sectionId}
          anchorEl={buttonRef.current}
          open={open}
          onClose={handleClose}
        />
      )}
    </>
  );
};

export default HelpIcon;
