import React from 'react';
import { Empty, Button } from 'antd';
import { motion, useReducedMotion } from 'framer-motion';
import { palette, space } from '../theme/tokens';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actionLabel?: React.ReactNode;
  onAction?: () => void;
  secondary?: React.ReactNode;
}

/**
 * EmptyState — جیاوازی لە AntD Empty: رەنگەکانی tokenی + CTA + animation.
 * Sprint 7: respects prefers-reduced-motion.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, actionLabel, onAction, secondary }) => {
  const reduce = useReducedMotion();
  return (
  <motion.div
    initial={reduce ? false : { opacity: 0, scale: 0.97 }}
    animate={reduce ? undefined : { opacity: 1, scale: 1 }}
    transition={{ duration: reduce ? 0 : 0.22 }}
    style={{
      padding: `${space.xxxl}px ${space.xl}px`,
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: space.md,
    }}
  >
    {icon ? (
      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: palette.primary50, color: palette.primary500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32,
      }}>{icon}</div>
    ) : (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={null} />
    )}
    <div>
      <div style={{ fontSize: 16, fontWeight: 600, color: palette.ink900, marginBottom: 4 }}>{title}</div>
      {description && <div style={{ color: palette.ink500, fontSize: 14, maxWidth: 420 }}>{description}</div>}
    </div>
    {actionLabel && onAction && (
      <Button type="primary" size="large" onClick={onAction}>{actionLabel}</Button>
    )}
    {secondary}
  </motion.div>
  );
};

export default EmptyState;
