/**
 * animations.ts — Framer Motion variant definitions
 *
 * ئەم فایلە هەموو animation variants ی سیستەمەکە دیاری دەکات بەپێی دیزاین spec:
 *   - pageVariants:    fade + 8px slide، 200ms بۆ هەموو پەیجەکان (Req 9.1)
 *   - buttonVariants:  rest / hover / pressed micro-interactions (Req 8.1, 8.2)
 *   - cardVariants:    hover upward shift + shadow (Req 8.4)
 *   - modalVariants:   scale + fade، 200ms بۆ هەموو مۆداڵەکان
 *   - listVariants:    stagger container، 100ms بۆ هەر ئایتەمێک
 *   - itemVariants:    تایبەتمەندی هەر ئایتەمێک لە لیستدا
 *   - pressAnimation:  scale down بۆ دوگمەکان (legacy)
 *
 * Validates: Requirements 8.1, 8.2, 8.4, 8.8, 9.1, 9.2, 9.7
 */

import type { Variants, TargetAndTransition } from 'framer-motion';
import { shadow } from '../theme/tokens';

// ---------------------------------------------------------------------------
// Page Transition — fade + 8px slide، 200ms (Requirement 9.1)
// ---------------------------------------------------------------------------
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.2, 0, 0, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
      ease: [0.2, 0, 0, 1],
    },
  },
};

// ---------------------------------------------------------------------------
// Button micro-interaction variants (Requirement 8.1, 8.2, 8.8)
// rest → hover: y -2px, shadow.md, 150ms
// hover → pressed: y +1px, shadow.none, 50ms
// All complete within 150ms maximum
// ---------------------------------------------------------------------------
export const buttonVariants: Variants = {
  rest: {
    y: 0,
    boxShadow: shadow.sm,
    transition: {
      duration: 0.15,
      ease: [0.2, 0, 0, 1],
    },
  },
  hover: {
    y: -2,
    boxShadow: shadow.md,
    transition: {
      duration: 0.15,
      ease: [0.2, 0, 0, 1],
    },
  },
  pressed: {
    y: 1,
    boxShadow: shadow.none,
    transition: {
      duration: 0.05,
      ease: [0.2, 0, 0, 1],
    },
  },
};

// ---------------------------------------------------------------------------
// Card hover micro-interaction (Requirement 8.4)
// Upward shift + increased shadow within 150ms
// ---------------------------------------------------------------------------
export const cardVariants: Variants = {
  rest: {
    y: 0,
    boxShadow: shadow.sm,
    transition: {
      duration: 0.15,
      ease: [0.2, 0, 0, 1],
    },
  },
  hover: {
    y: -4,
    boxShadow: shadow.lg,
    transition: {
      duration: 0.15,
      ease: [0.2, 0, 0, 1],
    },
  },
};

// ---------------------------------------------------------------------------
// Modal — scale + fade، 200ms (Requirement 4.4)
// ---------------------------------------------------------------------------
export const modalVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: [0.2, 0, 0, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 1, 1],
    },
  },
};

// ---------------------------------------------------------------------------
// List stagger container — هەر ئایتەمێک 100ms دواکەوتن (Requirement 4.5)
// ---------------------------------------------------------------------------
export const listVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

// ---------------------------------------------------------------------------
// List item — تایبەتمەندی هەر ئایتەمێک لە لیستدا
// ---------------------------------------------------------------------------
export const itemVariants: Variants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.2, 0, 0, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 1, 1],
    },
  },
};

// ---------------------------------------------------------------------------
// Press animation — scale down بۆ دوگمەکان (Requirement 4.3)
// ---------------------------------------------------------------------------
export const pressAnimation: TargetAndTransition = {
  scale: 0.96,
  transition: {
    duration: 0.1,
    ease: [0.4, 0, 0.2, 1],
  },
};

// ---------------------------------------------------------------------------
// Hover animation — subtle lift بۆ کارتەکان
// ---------------------------------------------------------------------------
export const hoverLift: TargetAndTransition = {
  y: -2,
  transition: {
    duration: 0.18,
    ease: [0.2, 0, 0, 1],
  },
};

// ---------------------------------------------------------------------------
// Reduced-motion safe variants — بۆ بەکارهێنەرانی prefers-reduced-motion
// ---------------------------------------------------------------------------
export const reducedPageVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export const reducedModalVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};
