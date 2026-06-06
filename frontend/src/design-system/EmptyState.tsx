import React from 'react';
import { Empty } from 'antd';
import { motion, useReducedMotion } from 'framer-motion';
import { MotionButton } from '../components/MotionButton';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actionLabel?: React.ReactNode;
  onAction?: () => void;
  secondary?: React.ReactNode;
  /** Optional aria-label for the empty state region */
  ariaLabel?: string;
}

/**
 * EmptyState — Vertex "Slate & Signal" empty pattern: centered, flat (no
 * surface card), muted ink text on the canvas with a soft accent icon chip and
 * an optional accent CTA. Fully theme-aware — every color resolves from the
 * auto-flipping CSS-var tokens (vertex-tokens.css), so it is correct in both
 * light and dark mode without an `isDark` prop.
 *
 * Sprint 7: respects prefers-reduced-motion.
 * Requirements: 17.1, 17.6
 * React.memo applied per Requirements 18.4.
 */
const EmptyStateInner: React.FC<EmptyStateProps> = ({ icon, title, description, actionLabel, onAction, secondary, ariaLabel }) => {
  const reduce = useReducedMotion();
  return (
  <motion.div
    role="region"
    aria-label={ariaLabel ?? (typeof title === 'string' ? title : 'Empty state')}
    // Capture-safe entrance (Vertex rule): animate transform only, never opacity
    // from 0 — keeps screenshot / PDF / PPTX export intact.
    initial={reduce ? false : { scale: 0.97 }}
    animate={reduce ? undefined : { scale: 1 }}
    transition={{ duration: reduce ? 0 : 0.22 }}
    style={{
      padding: 'var(--space-3xl, 48px) var(--space-xl, 24px)',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-md, 12px)',
    }}
  >
    {icon ? (
      <div style={{
        width: 72,
        height: 72,
        borderRadius: 'var(--radius-xl, 16px)',
        background: 'var(--accent-soft, rgba(123,97,255,0.12))',
        color: 'var(--accent-500, #7B61FF)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 32,
      }}>{icon}</div>
    ) : (
      <div style={{ color: 'var(--ink-300, #97A1B0)' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={null} />
      </div>
    )}
    <div>
      <div style={{
        fontFamily: 'var(--font-display, "Inter Tight", "Inter", system-ui, sans-serif)',
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        color: 'var(--ink-900, #11161F)',
        marginBottom: 'var(--space-xs, 4px)',
      }}>{title}</div>
      {description && (
        <div style={{ color: 'var(--ink-500, #6B7585)', fontSize: 14, lineHeight: 1.5, maxWidth: 420 }}>{description}</div>
      )}
    </div>
    {actionLabel && onAction && (
      <MotionButton type="primary" size="large" onClick={onAction}>{actionLabel}</MotionButton>
    )}
    {secondary}
  </motion.div>
  );
};

export const EmptyState = React.memo(EmptyStateInner);

export default EmptyState;
