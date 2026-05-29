/**
 * @file EmptyStateIllustration.tsx
 * @description Eight inline SVG illustrations for the empty-state system.
 *
 * Each illustration is ≤ 500 bytes raw; the file as a whole stays well under
 * the 4 KB budget set in design.md §1.2. Illustrations are 2-color via CSS
 * variables (`--empty-illu-fg`, `--empty-illu-bg`) so they respect theme and
 * dark-mode automatically.
 *
 * All paths use `currentColor` + `fill="var(--empty-illu-bg)"` for the back
 * shape, and `stroke="currentColor"` for the foreground geometry.
 *
 * @see design.md §1.2
 */

import { memo } from 'react';
import type { IllustrationKey } from './types';

interface IllustrationProps {
  name: IllustrationKey;
  /** Size in px — defaults to 64; list pages pass 96. */
  size?: number;
  className?: string;
}

const STROKE = 1.6;

/* ---------------------------------------------------------------------------
 * Individual illustrations — kept terse on purpose (≤ 500 B each).
 * ---------------------------------------------------------------------------
 */

const CustomersSvg = () => (
  <>
    <circle cx="32" cy="22" r="9" fill="var(--empty-illu-bg)" />
    <path d="M14 50c2-9 9-13 18-13s16 4 18 13" fill="var(--empty-illu-bg)" />
    <circle cx="32" cy="22" r="9" />
    <path d="M14 50c2-9 9-13 18-13s16 4 18 13" />
  </>
);

const ItemsSvg = () => (
  <>
    <rect x="12" y="20" width="40" height="28" rx="3" fill="var(--empty-illu-bg)" />
    <path d="M12 20l20-10 20 10" fill="var(--empty-illu-bg)" />
    <path d="M12 20l20 10 20-10" />
    <path d="M32 30v22" />
    <path d="M12 20l20-10 20 10v28a3 3 0 01-3 3H15a3 3 0 01-3-3z" />
  </>
);

const DocumentsSvg = () => (
  <>
    <path d="M16 8h22l10 10v36a2 2 0 01-2 2H16a2 2 0 01-2-2V10a2 2 0 012-2z" fill="var(--empty-illu-bg)" />
    <path d="M38 8v10h10" />
    <path d="M22 30h20M22 38h20M22 46h12" />
  </>
);

const MoneySvg = () => (
  <>
    <rect x="8" y="18" width="48" height="28" rx="3" fill="var(--empty-illu-bg)" />
    <circle cx="32" cy="32" r="6" />
    <path d="M14 18v28M50 18v28" />
  </>
);

const InboxSvg = () => (
  <>
    <path d="M10 36l8-18a3 3 0 013-2h22a3 3 0 013 2l8 18" fill="var(--empty-illu-bg)" />
    <path d="M10 36v14a2 2 0 002 2h40a2 2 0 002-2V36H44l-3 5H23l-3-5z" fill="var(--empty-illu-bg)" />
    <path d="M10 36h12l3 5h14l3-5h12" />
  </>
);

const ChartSvg = () => (
  <>
    <rect x="8" y="10" width="48" height="44" rx="3" fill="var(--empty-illu-bg)" />
    <path d="M16 44l10-12 8 6 14-18" />
    <circle cx="50" cy="20" r="2.5" fill="currentColor" />
  </>
);

const BoxSvg = () => (
  <>
    <path d="M12 22l20-10 20 10v24L32 56 12 46z" fill="var(--empty-illu-bg)" />
    <path d="M12 22l20 10 20-10" />
    <path d="M32 32v24" />
  </>
);

const LockSvg = () => (
  <>
    <rect x="14" y="28" width="36" height="26" rx="3" fill="var(--empty-illu-bg)" />
    <path d="M22 28v-7a10 10 0 0120 0v7" />
    <circle cx="32" cy="40" r="3" fill="currentColor" />
    <path d="M32 43v5" />
  </>
);

const SVGS: Record<IllustrationKey, () => JSX.Element> = {
  customers: CustomersSvg,
  items: ItemsSvg,
  documents: DocumentsSvg,
  money: MoneySvg,
  inbox: InboxSvg,
  chart: ChartSvg,
  box: BoxSvg,
  lock: LockSvg,
};

/* ---------------------------------------------------------------------------
 * Public component
 * ---------------------------------------------------------------------------
 */

/**
 * `<EmptyStateIllustration>` — renders one of the 8 canonical empty-state
 * illustrations as an inline 2-color SVG.
 *
 * All illustrations are `aria-hidden="true"`. They are decorative, not informative
 * (per Requirement 11.5).
 */
function EmptyStateIllustrationBase({ name, size = 64, className }: IllustrationProps) {
  const Body = SVGS[name];
  return (
    <svg
      className={['empty-state__illustration', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <Body />
    </svg>
  );
}

export const EmptyStateIllustration = memo(EmptyStateIllustrationBase);
EmptyStateIllustration.displayName = 'EmptyStateIllustration';

/** Re-export for ergonomic single-name imports. */
export { EmptyStateIllustration as Illustration };
