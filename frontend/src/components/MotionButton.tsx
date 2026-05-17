/**
 * MotionButton — دوگمەی Ant Design لەگەڵ press animation
 *
 * scale down animation لەکاتی کلیک بەپێی دیزاین spec.
 * بەکارهێنانی `pressAnimation` لە animations.ts.
 *
 * Validates: Requirements 4.1, 4.3
 *
 * @example
 * ```tsx
 * // بەجێگرەوەی Button ی AntD
 * <MotionButton type="primary" onClick={handleSave}>
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
import { pressAnimation } from '../utils/animations';

// motion.button wrapper بۆ AntD Button
const MotionButtonBase = motion.create(Button);

export interface MotionButtonProps extends ButtonProps {
  /** ئەگەر false بێت، press animation ناکرێت */
  animated?: boolean;
}

/**
 * MotionButton — AntD Button لەگەڵ press (scale down) animation.
 * هەموو props ی AntD Button پشتگیری دەکات.
 */
export const MotionButton: React.FC<MotionButtonProps> = ({
  animated = true,
  children,
  ...buttonProps
}) => {
  const shouldReduceMotion = useReducedMotion();

  // کاتی reduced motion یان animated=false، ئەنیمەیشن ناکرێت
  const tapAnimation = animated && !shouldReduceMotion ? pressAnimation : undefined;

  return (
    <MotionButtonBase
      whileTap={tapAnimation}
      {...buttonProps}
    >
      {children}
    </MotionButtonBase>
  );
};

export default MotionButton;
