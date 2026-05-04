import React from 'react';
import { palette, radius, space, fontSize } from '../../theme/tokens';
import { useAuthStore } from '../../store';

/**
 * PremiumPageHeader — Polished page header with title, subtitle,
 * optional eyebrow/breadcrumb, and actions slot. Subtle gradient
 * underline. Used at the top of Settings & detail pages.
 */
export interface PremiumPageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}

const PremiumPageHeader: React.FC<PremiumPageHeaderProps> = ({
  eyebrow, title, subtitle, icon, actions, meta,
}) => {
  const isDark = useAuthStore(s => s.theme) === 'dark';
  const ink = isDark ? palette.darkInk : palette.ink900;
  const inkMuted = isDark ? palette.darkInkMuted : palette.ink500;
  const border = isDark ? palette.darkBorder : palette.border;

  return (
    <div
      className="pph"
      style={{
        position: 'relative',
        padding: `${space.lg}px ${space.xl}px ${space.lg}px`,
        borderBottom: `1px solid ${border}`,
        marginBottom: space.xl,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: space.md }}>
        {icon && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44, height: 44,
              borderRadius: radius.md,
              background: 'linear-gradient(135deg, rgba(31,111,235,0.16), rgba(31,111,235,0.06))',
              color: palette.primary500,
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {eyebrow && (
            <div
              style={{
                fontSize: fontSize.xs,
                fontWeight: 600,
                color: palette.primary500,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              {eyebrow}
            </div>
          )}
          <div style={{ fontSize: fontSize.h3, fontWeight: 700, color: ink, lineHeight: 1.15 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ marginTop: 6, fontSize: fontSize.md, color: inkMuted, lineHeight: 1.5 }}>
              {subtitle}
            </div>
          )}
          {meta && (
            <div style={{ marginTop: space.sm, fontSize: fontSize.sm, color: inkMuted }}>
              {meta}
            </div>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>

      {/* Gradient underline */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          insetInlineStart: 0,
          insetInlineEnd: 0,
          bottom: -1,
          height: 2,
          background: `linear-gradient(90deg, ${palette.primary500} 0%, ${palette.primary300} 30%, transparent 70%)`,
          opacity: 0.6,
        }}
      />
    </div>
  );
};

export default PremiumPageHeader;
