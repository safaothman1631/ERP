import type { CSSProperties } from 'react';
import { glass, palette, type GlassSurface } from './tokens';
import { useAuthStore } from '../store';

export function getGlassStyle(surface: GlassSurface = 'modal', accent = false): CSSProperties {
  const isDark = useAuthStore.getState().theme === 'dark';
  const tokens = isDark ? glass[surface].dark : glass[surface].light;
  const fallback = isDark ? palette.darkSurface : palette.surface;

  return {
    background: tokens.bg,
    backdropFilter: tokens.blur,
    WebkitBackdropFilter: tokens.blur,
    border: `1px solid ${tokens.border}`,
    boxShadow: accent ? 'var(--role-glass-glow, 0 8px 32px rgba(123,97,255,0.12))' : '0 8px 32px rgba(15,23,42,0.06)',
    // @supports fallback applied via class in global CSS
    ...(typeof document !== 'undefined' &&
    !CSS.supports('backdrop-filter', 'blur(1px)')
      ? { background: fallback, backdropFilter: 'none', WebkitBackdropFilter: 'none' }
      : {}),
  };
}
