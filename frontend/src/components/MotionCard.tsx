/**
 * MotionCard — Card component with hover micro-interaction
 *
 * Implements card hover micro-interaction per spec:
 *   - rest:  y: 0, shadow.sm
 *   - hover: y: -4, shadow.lg, 150ms
 *
 * بەکارهێنانی `useReducedMotion` بۆ دەستگەیشتنپەزیری.
 * کاتی reduced motion: هیچ animation ناکرێت.
 *
 * Validates: Requirements 8.4, 8.8
 *
 * @example
 * ```tsx
 * <MotionCard>
 *   <p>Card content</p>
 * </MotionCard>
 *
 * // With AntD Card props
 * <MotionCard title="KPI" bordered={false}>
 *   <p>Value</p>
 * </MotionCard>
 * ```
 */
import React from 'react';
import { Card, type CardProps } from 'antd';
import { motion, useReducedMotion } from 'framer-motion';
import { cardVariants } from '../utils/animations';

const MotionCardBase = motion.create(Card);

export interface MotionCardProps extends CardProps {
  /** ئەگەر false بێت، animation ناکرێت */
  animated?: boolean;
}

/**
 * MotionCard — AntD Card لەگەڵ hover micro-interaction.
 * هەموو props ی AntD Card پشتگیری دەکات.
 *
 * When prefers-reduced-motion is set, all animations are fully disabled.
 */
export const MotionCard: React.FC<MotionCardProps> = ({
  animated = true,
  children,
  ...cardProps
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (!animated || shouldReduceMotion) {
    return (
      <Card {...cardProps}>
        {children}
      </Card>
    );
  }

  return (
    <MotionCardBase
      variants={cardVariants}
      initial="rest"
      whileHover="hover"
      animate="rest"
      style={{ cursor: 'default', ...cardProps.style }}
      {...cardProps}
    >
      {children}
    </MotionCardBase>
  );
};

export default MotionCard;
