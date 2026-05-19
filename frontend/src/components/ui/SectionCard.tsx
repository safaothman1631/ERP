import React from 'react';
import { palette, radius, space, shadow, fontSize } from '../../theme/tokens';
import { useAuthStore } from '../../store';
import { HelpIcon } from '../../help/HelpIcon';
import type { SectionId } from '../../help/sectionIds';

/**
 * SectionCard — Premium card primitive for Settings & Detail pages.
 * Linear/Notion/Stripe-inspired: subtle border, generous padding, optional
 * icon header with title + description + actions slot. Consistent radius
 * and shadow tokens across light/dark modes.
 */
export interface SectionCardProps {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  loading?: boolean;
  noPadding?: boolean;
  accent?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  /** When provided, renders a HelpIcon adjacent to the title (R6.1, R7.1, R7.5). */
  sectionId?: SectionId;
}

const accentColor: Record<NonNullable<SectionCardProps['accent']>, string> = {
  default: palette.primary500,
  success: palette.success,
  warning: palette.warning,
  danger:  palette.danger,
  info:    palette.info,
};

const SectionCard: React.FC<SectionCardProps> = ({
  icon, title, description, actions, footer, loading, noPadding,
  accent = 'default', children, style, className, sectionId,
}) => {
  const isDark = useAuthStore(s => s.theme) === 'dark';

  const surface = isDark ? palette.darkSurface : palette.surface;
  const border  = isDark ? palette.darkBorder  : palette.border;
  const ink     = isDark ? palette.darkInk     : palette.ink900;
  const inkMuted = isDark ? palette.darkInkMuted : palette.ink500;

  const hasHeader = Boolean(icon || title || description || actions);

  return (
    <div
      className={['sc-card', className].filter(Boolean).join(' ')}
      data-section-id={sectionId || undefined}
      style={{
        position: 'relative',
        background: surface,
        border: `1px solid ${border}`,
        borderRadius: radius.lg,
        boxShadow: isDark ? '0 1px 0 rgba(255,255,255,0.02) inset' : shadow.sm,
        overflow: 'hidden',
        transition: 'box-shadow 200ms cubic-bezier(0.2,0,0,1), border-color 200ms',
        opacity: loading ? 0.6 : 1,
        ...style,
      }}
    >
      {/* Accent rail */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          insetInlineStart: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: `linear-gradient(180deg, ${accentColor[accent]}, transparent)`,
          opacity: 0.45,
        }}
      />

      {hasHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: space.md,
            padding: `${space.lg}px ${space.xl}px`,
            borderBottom: `1px solid ${border}`,
            background: isDark
              ? 'linear-gradient(180deg, rgba(255,255,255,0.02), transparent)'
              : 'linear-gradient(180deg, rgba(15,23,42,0.015), transparent)',
          }}
        >
          {icon && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: radius.md,
                background: isDark ? 'rgba(31,111,235,0.16)' : 'rgba(31,111,235,0.10)',
                color: accentColor[accent],
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              {icon}
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && (
              <div style={{ fontSize: fontSize.md, fontWeight: 600, color: ink, lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 4 }}>
                {title}
                {sectionId && <HelpIcon sectionId={sectionId} />}
              </div>
            )}
            {description && (
              <div style={{ marginTop: 2, fontSize: fontSize.sm, color: inkMuted, lineHeight: 1.5 }}>
                {description}
              </div>
            )}
          </div>
          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, flexShrink: 0 }}>
              {actions}
            </div>
          )}
        </div>
      )}

      {children !== undefined && (
        <div style={{ padding: noPadding ? 0 : `${space.xl}px ${space.xl}px` }}>
          {children}
        </div>
      )}

      {footer && (
        <div
          style={{
            padding: `${space.md}px ${space.xl}px`,
            borderTop: `1px solid ${border}`,
            background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(15,23,42,0.015)',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
};

export default SectionCard;
