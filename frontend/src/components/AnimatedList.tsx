/**
 * AnimatedList — wrapper بۆ لیستەکان لەگەڵ stagger animation
 *
 * هەر ئایتەمێک بە 100ms دواکەوتن دێت بەپێی دیزاین spec.
 * بەکارهێنانی `listVariants` و `itemVariants` لە animations.ts.
 *
 * Validates: Requirements 4.1, 4.5
 *
 * @example
 * ```tsx
 * // بۆ لیستی سادە
 * <AnimatedList>
 *   {items.map((item) => (
 *     <AnimatedListItem key={item.id}>
 *       <Card>{item.name}</Card>
 *     </AnimatedListItem>
 *   ))}
 * </AnimatedList>
 *
 * // بۆ grid
 * <AnimatedList as="div" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
 *   {items.map((item) => (
 *     <AnimatedListItem key={item.id}>
 *       <KpiCard {...item} />
 *     </AnimatedListItem>
 *   ))}
 * </AnimatedList>
 * ```
 */
import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { listVariants, itemVariants } from '../utils/animations';

type MotionTag = 'div' | 'ul' | 'ol' | 'section' | 'article';

interface AnimatedListProps {
  children: React.ReactNode;
  /** HTML tag بۆ container، default: 'div' */
  as?: MotionTag;
  className?: string;
  style?: React.CSSProperties;
  /** ئەگەر true بێت، AnimatePresence بەکاردێت بۆ exit animations */
  withExitAnimation?: boolean;
}

/**
 * AnimatedList — container کە stagger animation بۆ children ی دیاری دەکات.
 * هەر child کە `AnimatedListItem` بێت بە 100ms دواکەوتن دێت.
 */
export const AnimatedList: React.FC<AnimatedListProps> = ({
  children,
  as: Tag = 'div',
  className,
  style,
  withExitAnimation = false,
}) => {
  const shouldReduceMotion = useReducedMotion();

  // کاتی reduced motion، stagger ناکرێت
  const variants = shouldReduceMotion
    ? { initial: {}, animate: {}, exit: {} }
    : listVariants;

  const MotionTag = motion[Tag] as React.ElementType;

  const content = (
    <MotionTag
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
      style={style}
    >
      {children}
    </MotionTag>
  );

  if (withExitAnimation) {
    return <AnimatePresence mode="popLayout">{content}</AnimatePresence>;
  }

  return content;
};

interface AnimatedListItemProps {
  children: React.ReactNode;
  /** HTML tag بۆ item، default: 'div' */
  as?: MotionTag | 'li';
  className?: string;
  style?: React.CSSProperties;
  /** key بۆ AnimatePresence */
  layoutId?: string;
}

/**
 * AnimatedListItem — هەر ئایتەمێک لە AnimatedList دا.
 * ئەنیمەیشنی fade + slide هەبێت بە 100ms دواکەوتن.
 */
export const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
  children,
  as: Tag = 'div',
  className,
  style,
  layoutId,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const variants = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : itemVariants;

  const MotionTag = motion[Tag as MotionTag] as React.ElementType;

  return (
    <MotionTag
      variants={variants}
      className={className}
      style={style}
      layoutId={layoutId}
    >
      {children}
    </MotionTag>
  );
};

export default AnimatedList;
