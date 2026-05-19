/**
 * ChartCard — recharts wrapper with skeleton + error state + card hover micro-interaction.
 *
 * Applies card hover micro-interaction (upward shift + increased shadow, 150ms).
 * Requirements: 8.4, 8.8, 13.3, 13.7
 *
 * @example
 * ```tsx
 * <ChartCard title="Revenue Trend" loading={isLoading}>
 *   <AreaChart data={data} width={400} height={200}>
 *     <Area dataKey="value" />
 *   </AreaChart>
 * </ChartCard>
 * ```
 */
import React from 'react';
import { Card, Skeleton, Alert, Typography } from 'antd';
import { motion, useReducedMotion } from 'framer-motion';
import { palette, radius, shadow, space } from '../theme/tokens';
import { cardVariants } from '../utils/animations';
import LoadingSkeleton from './LoadingSkeleton';

const { Text } = Typography;

export interface ChartCardProps {
  /** Card title */
  title: React.ReactNode;
  /** Optional subtitle / description */
  subtitle?: React.ReactNode;
  /** Extra content rendered in the top-right corner */
  extra?: React.ReactNode;
  /** Chart content */
  children?: React.ReactNode;
  /** Show skeleton loader when true */
  loading?: boolean;
  /** Show error state when set */
  error?: string | null;
  /** Retry callback shown in error state */
  onRetry?: () => void;
  /** Dark mode */
  isDark?: boolean;
  /** Card height in px (default: 280) */
  height?: number;
  /** Disable hover animation */
  animated?: boolean;
}

/**
 * ChartCard — wraps recharts charts with a consistent card shell.
 * Includes skeleton loading, error state, and card hover micro-interaction.
 * React.memo applied per Requirements 18.4.
 */
const ChartCardInner: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  extra,
  children,
  loading = false,
  error = null,
  onRetry,
  isDark = false,
  height = 280,
  animated = true,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animated && !prefersReducedMotion;

  const cardStyle: React.CSSProperties = {
    borderRadius: radius.lg,
    boxShadow: shadow.sm,
    height: '100%',
    background: isDark ? palette.darkSurface : palette.surface,
    border: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
  };

  const content = (
    <Card
      styles={{ body: { padding: space.lg } }}
      style={cardStyle}
      title={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: isDark ? palette.darkInk : palette.ink900,
          }}>
            {title}
          </span>
          {subtitle && (
            <Text style={{
              fontSize: 12,
              color: isDark ? palette.darkInkMuted : palette.ink500,
              fontWeight: 400,
            }}>
              {subtitle}
            </Text>
          )}
        </div>
      }
      extra={extra}
    >
      {loading ? (
        <LoadingSkeleton variant="chart" isDark={isDark} />
      ) : error ? (
        <div style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: space.md,
        }}>
          <Alert
            type="error"
            message={error}
            action={
              onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: palette.primary500,
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: '2px 8px',
                  }}
                >
                  Retry
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div style={{ height, width: '100%', overflow: 'hidden' }}>
          {children}
        </div>
      )}
    </Card>
  );

  if (!shouldAnimate) {
    return content;
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="rest"
      whileHover="hover"
      animate="rest"
      style={{ height: '100%' }}
    >
      {content}
    </motion.div>
  );
};

export const ChartCard = React.memo(ChartCardInner);

export default ChartCard;
