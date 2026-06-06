/**
 * ChartCard — recharts wrapper with skeleton + error state + card hover micro-interaction.
 *
 * Vertex "Slate & Signal" kit chart card (screens.jsx): flat var(--surface) panel,
 * 1px var(--border) hairline, var(--radius-lg) corners, Inter Tight display title,
 * muted var(--ink-500) subtitle, chart slot below. Fully theme-aware — every colour
 * resolves from CSS-var tokens that auto-flip via [data-theme="dark"], so the card is
 * correct in BOTH light and dark themes.
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
import { Card, Alert, Typography } from 'antd';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { space } from '../theme/tokens';
import { cardVariants } from '../utils/animations';
import { useIsDark } from '../hooks/useIsDark';
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
  isDark: isDarkProp,
  height = 280,
  animated = true,
}) => {
  // Auto-flip with the live theme when the consumer doesn't thread isDark down
  // (the common case). Prop override is preserved. Rules-of-hooks safe.
  const themeDark = useIsDark();
  const isDark = isDarkProp ?? themeDark;

  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animated && !prefersReducedMotion;

  // Kit "vx-card": flat surface, hairline border, --radius-lg. Tokens auto-flip
  // for dark mode, so no JS light/dark branching needed.
  const cardStyle: React.CSSProperties = {
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    height: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  };

  const content = (
    <Card
      className="vertex-chart-card"
      styles={{ body: { padding: space.lg } }}
      style={cardStyle}
      title={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'var(--ink-900)',
            }}
          >
            {title}
          </span>
          {subtitle && (
            <Text
              style={{
                fontSize: 12,
                color: 'var(--ink-500)',
                fontWeight: 400,
              }}
            >
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
        <div
          style={{
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: space.md,
          }}
        >
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
                    color: 'var(--accent-500)',
                    cursor: 'pointer',
                    fontSize: 13,
                    paddingBlock: 2,
                    paddingInline: 8,
                  }}
                >
                  {t('retry', 'Retry')}
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
