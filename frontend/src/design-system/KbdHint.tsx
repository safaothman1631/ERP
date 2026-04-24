import React from 'react';
import { palette, radius } from '../theme/tokens';
import { useAuthStore } from '../store';

export interface KbdHintProps {
  /** Keys to render, e.g. ['⌘','K'] or ['Ctrl','/']. */
  keys: string[];
  size?: 'sm' | 'md';
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/** Convenience: cross-platform Cmd/Ctrl. */
export const cmdKey = isMac ? '⌘' : 'Ctrl';

/**
 * KbdHint — keyboard shortcut chip group.
 * بۆ command palette، tooltip، menu items.
 */
export const KbdHint: React.FC<KbdHintProps> = ({ keys, size = 'sm' }) => {
  const isDark = useAuthStore((s) => s.theme) === 'dark';
  const fontSize = size === 'sm' ? 11 : 13;
  const padX = size === 'sm' ? 5 : 7;
  const padY = size === 'sm' ? 1 : 3;
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {keys.map((k, i) => (
        <kbd
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: fontSize + padX * 2,
            padding: `${padY}px ${padX}px`,
            borderRadius: radius.sm,
            border: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
            background: isDark ? 'rgba(255,255,255,0.04)' : palette.bg,
            color: isDark ? palette.darkInkMuted : palette.ink500,
            fontFamily: "'JetBrains Mono', 'Menlo', monospace",
            fontSize,
            lineHeight: 1,
          }}
        >
          {k}
        </kbd>
      ))}
    </span>
  );
};

export default KbdHint;
