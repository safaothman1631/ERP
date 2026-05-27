/**
 * @file motion.ts
 * @description Framer Motion tokens and variants for the empty-state system.
 *
 * All variants are SPRING-based. Every consumer MUST check `useReducedMotion()`
 * and fall back to a 120ms crossfade per Requirement 6.6.
 *
 * @see design.md §5
 */

import type { Transition, Variants } from 'framer-motion';

/* ---------------------------------------------------------------------------
 * Spring tokens
 * ---------------------------------------------------------------------------
 */

/** Gentle spring — used for empty states, modal/drawer entrances. */
export const SPRING_GENTLE: Transition = {
  type: 'spring',
  stiffness: 240,
  damping: 22,
} as const;

/** Tactile spring — used for button-press feedback. */
export const SPRING_TACTILE: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 26,
} as const;

/* ---------------------------------------------------------------------------
 * Duration tokens (seconds)
 * ---------------------------------------------------------------------------
 */

/** Fast — for reduced-motion crossfade and hover. */
export const DURATION_FAST = 0.12;
/** Normal — empty-state entrance, modal scale-in. */
export const DURATION_NORMAL = 0.22;
/** Slow — toast and highlight-pulse total. */
export const DURATION_SLOW = 0.32;

/* ---------------------------------------------------------------------------
 * Stagger tokens
 * ---------------------------------------------------------------------------
 */

/** Delay between staggered children (seconds). */
export const STAGGER_DELAY = 0.03;
/** Beyond this index, rows render without stagger to cap total animation time. */
export const STAGGER_MAX_INDEX = 16;

/* ---------------------------------------------------------------------------
 * Variants
 * ---------------------------------------------------------------------------
 */

/** Fade + scale entrance for empty-state container. */
export const emptyStateEnter: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: SPRING_GENTLE },
};

/** Reduced-motion fallback — pure crossfade. */
export const emptyStateEnterReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION_FAST } },
};

/** Modal entrance: dialog slides + scales from below. */
export const modalEnter: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING_GENTLE },
};

/** Drawer entrance: slides in from the inline-end edge. */
export const drawerEnter: Variants = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: SPRING_GENTLE },
};

/** Highlight pulse — flashes a newly-created selected option. */
export const highlightPulse: Variants = {
  initial: { backgroundColor: 'rgba(24,144,255,0)' },
  pulse: {
    backgroundColor: [
      'rgba(24,144,255,0)',
      'rgba(24,144,255,0.18)',
      'rgba(24,144,255,0)',
    ],
    transition: { duration: 0.6, ease: 'easeInOut' },
  },
};

/**
 * Build per-row stagger variants. Rows beyond `STAGGER_MAX_INDEX` use the same
 * delay as the last index, capping total animation time at ~480ms.
 */
export function rowStaggerVariants(index: number): Variants {
  const cappedIndex = Math.min(index, STAGGER_MAX_INDEX);
  return {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { delay: cappedIndex * STAGGER_DELAY, ...SPRING_GENTLE },
    },
  };
}

/**
 * Resolve the entrance variants to use, honoring `prefers-reduced-motion`.
 * Pass the `useReducedMotion()` boolean from Framer's hook.
 */
export function entranceVariants(reduce: boolean | null): Variants {
  return reduce ? emptyStateEnterReduced : emptyStateEnter;
}

/** CTA hover/press scale tokens. */
export const CTA_HOVER_SCALE = 1.03;
export const CTA_PRESS_SCALE = 0.97;
export const CTA_HOVER_DURATION = 0.12;
