/**
 * PageTransition — wrapper بۆ هەموو پەیجەکان
 *
 * fade + slide animation، 300ms بەپێی دیزاین spec.
 * بەکارهێنانی `useReducedMotion` بۆ دەستگەیشتنپەزیری.
 *
 * Validates: Requirements 4.1, 4.2
 */
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { pageVariants, reducedPageVariants } from '../utils/animations';

interface PageTransitionProps {
  children: React.ReactNode;
  /** Optional CSS class for the wrapper div */
  className?: string;
  /** Optional inline style for the wrapper div */
  style?: React.CSSProperties;
}

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
