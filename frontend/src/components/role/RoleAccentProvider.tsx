import React, { useMemo } from 'react';
import { useRoleUx } from '../../hooks/useRoleUx';
import { useIsDark } from '../../hooks/useIsDark';

export const RoleAccentContext = React.createContext<string>('#7B61FF');

/**
 * RoleAccentProvider — owns the role-accent scope for the authenticated shell.
 *
 * The wrapping `.role-accent-root` element re-declares the Vertex kit's full
 * `--accent-*` ramp from the *active role's* accent, so every kit-styled surface
 * inside the shell (buttons, menu, tabs, focus ring, tags, charts, …) reflects
 * the role's colour — owner=violet, accountant=emerald, sales=blue,
 * inventory=cyan, cashier=amber, hr=magenta. The ramp is derived with the exact
 * same `color-mix` formula as `theme/vertexTheme.ts:vertexCssVars`, so the local
 * (scoped) tokens stay 1:1 with the global ones App.tsx injects on :root.
 *
 * Theme-aware: surface/ink/border tokens auto-flip via `[data-theme="dark"]`
 * (vertex-tokens.css), so nothing here hardcodes a light colour. The only
 * theme-dependent tuning is the accent tint/glow strength (soft 16%→18%,
 * glow 40%→45% in dark) to match the kit's dark overrides.
 *
 * Role-resolution logic, public props and i18n are unchanged — this only paints
 * CSS variables onto the scope element.
 */
export const RoleAccentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useRoleUx();
  // Reactive dark flag — drives only the accent tint/glow strength (kit-accurate),
  // never a hardcoded surface colour. Read unconditionally (rules-of-hooks safe).
  const isDark = useIsDark();

  const accent = theme.accent;

  const style = useMemo(() => {
    // color-mix ramp identical to vertexTheme.ts:vertexCssVars so the scoped
    // --accent-* tokens match the global :root ones exactly for every role.
    const mixW = (p: number) => `color-mix(in srgb, ${accent} ${p}%, #fff)`;
    const mixB = (p: number) => `color-mix(in srgb, ${accent} ${p}%, #000)`;
    const softPct = isDark ? 18 : 16; // kit dark bumps --accent-soft to 0.18
    const glowPct = isDark ? 45 : 40; // …and --accent-glow to 45%

    return {
      // ── Kit accent ramp (drives all vertex-kit.css component styling) ──
      '--accent-50': mixW(92),
      '--accent-100': mixW(86),
      '--accent-200': mixW(72),
      '--accent-300': mixW(58),
      '--accent-400': mixW(80),
      '--accent-500': accent,
      '--accent-600': mixB(82),
      '--accent-700': mixB(62),
      '--accent': accent,
      '--accent-contrast': '#FFFFFF',
      '--accent-soft': `color-mix(in srgb, ${accent} ${softPct}%, transparent)`,
      '--accent-glow': `0 8px 30px color-mix(in srgb, ${accent} ${glowPct}%, transparent)`,
      // Focus ring follows the active role too (kit --focus = accent-500).
      '--focus': accent,

      // ── Legacy role-accent vars (premium.css glass/nav/button contract) ──
      '--role-accent': accent,
      '--role-accent-muted': theme.accentMuted,
      '--role-glass-glow': theme.glassBorderGlow,
    } as React.CSSProperties;
  }, [accent, isDark, theme.accentMuted, theme.glassBorderGlow]);

  return (
    <RoleAccentContext.Provider value={accent}>
      <div className="role-accent-root" style={style}>
        {children}
      </div>
    </RoleAccentContext.Provider>
  );
};
