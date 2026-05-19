/**
 * PageTransition — wrapper بۆ هەموو پەیجەکان
 *
 * fade + 8px slide animation، 200ms بەپێی دیزاین spec.
 * بەکارهێنانی `useReducedMotion` بۆ دەستگەیشتنپەزیری.
 * کاتی reduced motion: instant transition بەبێ animation یان delay.
 *
 * Variants:
 *   initial: { opacity: 0, y: 8 }
 *   animate: { opacity: 1, y: 0 }
 *   exit:    { opacity: 0, y: -8 }
 *   transition: { duration: 0.2, ease: [0.2, 0, 0, 1] }
 *
 * Validates: Requirements 9.1, 9.2, 9.7
 */
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  /** Optional CSS class for the wrapper div */
  className?: string;
  /** Optional inline style for the wrapper div */
  style?: React.CSSProperties;
}

/**
 * Page transition variants per spec:
 * - initial: opacity 0, y 8px
 * - animate: opacity 1, y 0
 * - exit:    opacity 0, y -8px
 * - duration: 0.2s, ease: [0.2, 0, 0, 1]
 */
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.2, 0, 0, 1] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
      ease: [0.2, 0, 0, 1] as [number, number, number, number],
    },
  },
};

/**
 * Reduced-motion variant — instant, no animation, no delay.
 * Per spec: prefers-reduced-motion fully disables all animations (duration: 0).
 */
const reducedPageVariants = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0, transition: { duration: 0 } },
  exit: { opacity: 1, y: 0, transition: { duration: 0 } },
};

const PageTransition: React.FC<PageTransitionProps> = ({ children, className, style }) => {
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion ? reducedPageVariants : pageVariants;

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
