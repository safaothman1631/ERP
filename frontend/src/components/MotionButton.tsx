/**
 * MotionButton — دوگمەی Ant Design لەگەڵ micro-interaction animations
 *
 * Implements button micro-interaction variants per spec:
 *   - rest:    y: 0, shadow.sm
 *   - hover:   y: -2, shadow.md, 150ms
 *   - pressed: y: 1, shadow.none, 50ms
 *
 * Loading state: shows AntD spinner + disables button; restores on completion.
 * بەکارهێنانی `useReducedMotion` بۆ دەستگەیشتنپەزیری.
 * کاتی reduced motion: هیچ animation ناکرێت (duration: 0).
 *
 * Validates: Requirements 8.1, 8.2, 8.5, 8.8
 *
 * @example
 * ```tsx
 * // بەجێگرەوەی Button ی AntD
 * <MotionButton type="primary" onClick={handleSave}>
 *   پاشەکەوتکردن
 * </MotionButton>
 *
 * // لەگەڵ loading state
 * <MotionButton type="primary" loading={isSaving}>
 *   پاشەکەوتکردن
 * </MotionButton>
 *
 * // لەگەڵ هەموو props ی AntD Button
 * <MotionButton type="default" icon={<PlusOutlined />} size="large">
 *   زیادکردن
 * </MotionButton>
 * ```
 */
import React from 'react';
import { Button, type ButtonProps } from 'antd';
import { motion, useReducedMotion } from 'framer-motion';
import { buttonVariants } from '../utils/animations';

// motion.button wrapper بۆ AntD Button
const MotionButtonBase = motion.create(Button);

export interface MotionButtonProps extends ButtonProps {
  /** ئەگەر false بێت، animation ناکرێت */
  animated?: boolean;
}

/**
 * MotionButton — AntD Button لەگەڵ rest/hover/pressed micro-interaction variants.
 * هەموو props ی AntD Button پشتگیری دەکات.
 *
 * - When `loading` is true: AntD shows spinner + disables button; hover/press animations are paused.
 * - When `disabled` is true: hover/press animations are paused.
 * - When prefers-reduced-motion is set: all animations are fully disabled (duration: 0).
 */
export const MotionButton: React.FC<MotionButtonProps> = ({
  animated = true,
  children,
  loading,
  disabled,
  ...buttonProps
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Disable animation when loading, disabled, or reduced motion is preferred
  const shouldAnimate = animated && !shouldReduceMotion && !loading && !disabled;

  // کاتی reduced motion یان animated=false یان loading/disabled، ئەنیمەیشن ناکرێت
  if (!shouldAnimate) {
    return (
      <Button loading={loading} disabled={disabled} {...buttonProps}>
        {children}
      </Button>
    );
  }

  return (
    <MotionButtonBase
      variants={buttonVariants}
      initial="rest"
      whileHover="hover"
      whileTap="pressed"
      animate="rest"
      loading={loading}
      disabled={disabled}
      {...buttonProps}
    >
      {children}
    </MotionButtonBase>
  );
};

export default MotionButton;
