import React from 'react';
import { palette, space, fontSize } from '../../theme/tokens';
import { useAuthStore } from '../../store';

/**
 * SettingsRow — Linear/Stripe-style settings row.
 * Label + description on the start side, control on the end side.
 * Stack vertically on small screens (< 600px).
 */
export interface SettingsRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  divider?: boolean;
  align?: 'center' | 'start';
  controlWidth?: number | string;
  /** Force inline layout (label + control side by side). Use for Switch/Toggle. */
  inline?: boolean;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  label, description, htmlFor, children, divider = true,
  align: _align = 'center', controlWidth, inline = false,
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
        flexDirection: 'column',
        gap: space.sm,
        padding: `${space.md}px 0`,
        borderBottom: divider ? `1px solid ${border}` : 'none',
      }}
    >
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minWidth: 0 }}>
        <label
          htmlFor={htmlFor}
          style={{
            display: 'block',
            fontSize: fontSize.base,
            fontWeight: 500,
            color: ink,
            cursor: htmlFor ? 'pointer' : 'default',
            flex: 1,
            minWidth: 0,
          }}
        >
          {label}
        </label>
        {/* Inline control — Switch/Toggle or explicitly inline */}
        {inline && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {children}
          </div>
        )}
      </div>
      {description && (
        <div style={{ fontSize: fontSize.sm, color: inkMuted, lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {/* Full-width control */}
      {!inline && (
        <div
          style={{
            width: controlWidth ?? '100%',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default SettingsRow;
