/**
 * MotionModal — wrapper بۆ هەموو مۆداڵەکان
 *
 * scale + fade animation، 200ms بەپێی دیزاین spec.
 * بەکارهێنانی `AnimatePresence` بۆ exit animation.
 *
 * Validates: Requirements 4.1, 4.4
 *
 * @example
 * ```tsx
 * <MotionModal open={open}>
 *   <Modal open={open} onCancel={onClose} ...>
 *     ...
 *   </Modal>
 * </MotionModal>
 * ```
 *
 * یان بۆ ناوەڕۆکی مۆداڵ بە تەنها:
 * ```tsx
 * <Modal open={open} modalRender={(node) => (
 *   <MotionModalContent>{node}</MotionModalContent>
 * )}>
 * ```
 */
import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { modalVariants, reducedModalVariants } from '../utils/animations';

interface MotionModalProps {
  /** کاتێک open=true ئەنیمەیشنی داخڵبوون دەکرێت، کاتێک false ئەنیمەیشنی دەرچوون */
  open: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * MotionModal — AnimatePresence wrapper بۆ مۆداڵ ئەنیمەیشن.
 * ئەم کۆمپۆنێنتە ناوەڕۆکی مۆداڵ پێچاوپێچ دەکات بۆ ئەوەی
 * scale+fade animation هەبێت لەکاتی کردنەوە و داخستن.
 */
export const MotionModal: React.FC<MotionModalProps> = ({ open, children, className, style }) => {
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion ? reducedModalVariants : modalVariants;

  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.div
          key="modal-content"
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={className}
          style={style}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * MotionModalContent — بەکاردێت لەگەڵ AntD Modal's `modalRender` prop
 * بۆ ئەوەی ناوەڕۆکی مۆداڵ ئەنیمەیشن هەبێت.
 *
 * @example
 * ```tsx
 * <Modal
 *   open={open}
 *   modalRender={(node) => <MotionModalContent>{node}</MotionModalContent>}
 * >
 *   ...
 * </Modal>
 * ```
 */
export const MotionModalContent: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, className, style }) => {
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion ? reducedModalVariants : modalVariants;

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

export default MotionModal;
