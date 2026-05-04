import React from 'react';
import { palette, space, fontSize } from '../../theme/tokens';
import { useAuthStore } from '../../store';

/**
 * SettingsRow — Linear/Stripe-style settings row.
 * Label + description on the start side, control on the end side.
 * Stack vertically on small screens.
 */
export interface SettingsRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  divider?: boolean;
  align?: 'center' | 'start';
  controlWidth?: number | string;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  label, description, htmlFor, children, divider = true,
  align = 'center', controlWidth,
}) => {
  const isDark = useAuthStore(s => s.theme) === 'dark';
  const ink = isDark ? palette.darkInk : palette.ink900;
  const inkMuted = isDark ? palette.darkInkMuted : palette.ink500;
  const border = isDark ? palette.darkBorder : palette.border;

  return (
    <div
      className="sc-row"
      style={{
        display: 'flex',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        gap: space.lg,
        padding: `${space.md}px 0`,
        borderBottom: divider ? `1px solid ${border}` : 'none',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <label
          htmlFor={htmlFor}
          style={{
            display: 'block',
            fontSize: fontSize.base,
            fontWeight: 500,
            color: ink,
            cursor: htmlFor ? 'pointer' : 'default',
          }}
        >
          {label}
        </label>
        {description && (
          <div style={{ marginTop: 2, fontSize: fontSize.sm, color: inkMuted, lineHeight: 1.5 }}>
            {description}
          </div>
        )}
      </div>
      <div
        style={{
          flexShrink: 0,
          width: controlWidth,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SettingsRow;
