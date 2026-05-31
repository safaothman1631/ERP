/**
 * KpiCard — کارتی متریک بۆ داشبۆرد
 *
 * Features:
 *  - Animated value via <CountUp> (React Bits) wrapped in MotionGate
 *  - Delta % indicator with up/down arrow
 *  - Sparkline via recharts <AreaChart>
 *  - LoadingSkeleton variant="card" when loading
 *  - Navigate to filtered list page on click
 *  - Card hover micro-interaction (upward shift + increased shadow, 150ms)
 *
 * Requirements: 8.4, 8.8, 13.1, 13.2, 13.4, 13.7
 */
import React from 'react';
import { Card, Tooltip } from 'antd';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts';
import { palette, radius, shadow, space, fontSize, fontWeight } from '../theme/tokens';
import { cardVariants } from '../utils/animations';
import { LoadingSkeleton } from './LoadingSkeleton';
import { MotionGate } from '../components/MotionGate';
import CountUp from '../components/react-bits/CountUp';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface KpiCardProps {
  /** Card title */
  title: React.ReactNode;
  /** Numeric value — animated via CountUp when a number; displayed as-is when a string */
  value: number | string;
  /** Delta percentage (positive = up, negative = down) */
  delta?: number;
  /**
   * @deprecated Use `delta` instead. Kept for backward compatibility.
   * Trend percentage (positive = up, negative = down)
   */
  trend?: number;
  /** @deprecated Use `delta` instead. Label shown next to trend. */
  trendLabel?: string;
  /** Sparkline data points (array of numbers) */
  sparklineData?: number[];
  /** Icon rendered in the top-right corner */
  icon?: React.ReactNode;
  /** Currency label shown after the value */
  currency?: 'IQD' | 'USD';
  /** Prefix rendered before the value (legacy compat) */
  prefix?: React.ReactNode;
  /** Suffix rendered after the value (legacy compat) */
  suffix?: React.ReactNode;
  /** Show skeleton loader when true */
  loading?: boolean;
  /** Navigate to filtered list page on click */
  onClick?: () => void;
  /** Tone for icon background */
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  /** Optional hint shown in tooltip on title hover */
  hint?: string;
}

// ─── Tone maps ────────────────────────────────────────────────────────────────

const TONE_BG: Record<NonNullable<KpiCardProps['tone']>, string> = {
  primary: palette.primary50,
  success: palette.successBg,
  warning: palette.warningBg,
  danger:  palette.dangerBg,
  info:    palette.infoBg,
};

const TONE_COLOR: Record<NonNullable<KpiCardProps['tone']>, string> = {
  primary: palette.primary600,
  success: palette.success,
  warning: palette.warning,
  danger:  palette.danger,
  info:    palette.info,
};

const TONE_SPARKLINE: Record<NonNullable<KpiCardProps['tone']>, string> = {
  primary: palette.primary400,
  success: palette.success,
  warning: palette.warning,
  danger:  palette.danger,
  info:    palette.info,
};

// ─── Sparkline ────────────────────────────────────────────────────────────────

interface SparklineProps {
  data: number[];
  color: string;
}

const Sparkline: React.FC<SparklineProps> = ({ data, color }) => {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${color.replace('#', '')})`}
          dot={false}
          isAnimationActive={false}
        />
        <RechartsTooltip
          contentStyle={{ display: 'none' }}
          cursor={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

// ─── KpiCard ──────────────────────────────────────────────────────────────────

/**
 * KpiCard — animated KPI metric card for the Dashboard.
 *
 * Shows LoadingSkeleton variant="card" when loading.
 * Navigates to filtered list page on click.
 * Applies card hover micro-interaction (upward shift + increased shadow, 150ms).
 *
 * Requirements: 13.1, 13.4, 13.7
 */
const KpiCardInner: React.FC<KpiCardProps> = ({
  title,
  value,
  delta,
  trend,
  trendLabel,
  sparklineData,
  icon,
  currency,
  prefix,
  suffix,
  loading = false,
  onClick,
  tone = 'primary',
  hint,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // Resolve delta: prefer explicit `delta`, fall back to legacy `trend`
  const resolvedDelta = delta ?? trend;
  const deltaUp = (resolvedDelta ?? 0) >= 0;
  const sparkColor = TONE_SPARKLINE[tone];

  // Determine if value is numeric (for CountUp animation)
  const isNumericValue = typeof value === 'number';

  // Format suffix: currency label or legacy suffix
  const valueSuffix = currency ? ` ${currency}` : (typeof suffix === 'string' ? suffix : '');
  const valuePrefix = typeof prefix === 'string' ? prefix : '';

  const cardContent = (
    <Card
      className="premium-card"
      hoverable={!!onClick}
      onClick={onClick}
      styles={{ body: { padding: space.lg } }}
      style={{
        borderRadius: radius.lg,
        boxShadow: shadow.sm,
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        minHeight: 160,
      }}
      aria-label={`${title}: ${isNumericValue ? new Intl.NumberFormat('en-US').format(value as number) : value}${valueSuffix}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {loading ? (
        <LoadingSkeleton variant="card" />
      ) : (
        <>
          {/* Header: title + icon */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: space.sm,
          }}>
            <Tooltip title={hint}>
              <span style={{
                color: palette.ink500,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                lineHeight: 1.4,
              }}>
                {title}
              </span>
            </Tooltip>
            {icon && (
              <div style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: TONE_BG[tone],
                color: TONE_COLOR[tone],
                fontSize: 18,
                flexShrink: 0,
              }}>
                {icon}
              </div>
            )}
          </div>

          {/* Value with CountUp animation */}
          <div style={{
            fontSize: fontSize['3xl'],
            fontWeight: fontWeight.bold,
            color: palette.ink900,
            lineHeight: 1.2,
            marginBottom: space.xs,
          }}>
            {prefix && typeof prefix !== 'string' && prefix}
            {isNumericValue ? (
              <MotionGate
                Component={CountUp}
                end={value as number}
                duration={1000}
                separator=","
                prefix={valuePrefix}
                suffix={valueSuffix}
                style={{ fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}
                fallback={
                  <span>
                    {valuePrefix}{new Intl.NumberFormat('en-US').format(value as number)}{valueSuffix}
                  </span>
                }
              />
            ) : (
              <span>
                {valuePrefix}{value}{valueSuffix}
              </span>
            )}
            {suffix && typeof suffix !== 'string' && suffix}
          </div>

          {/* Delta indicator */}
          {typeof resolvedDelta === 'number' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: fontSize.xs,
              color: deltaUp ? palette.success : palette.danger,
              marginBottom: sparklineData && sparklineData.length > 0 ? space.sm : 0,
            }}>
              {deltaUp ? <ArrowUpOutlined aria-hidden /> : <ArrowDownOutlined aria-hidden />}
              <span aria-label={`${deltaUp ? 'up' : 'down'} ${Math.abs(resolvedDelta).toFixed(1)} percent`}>
                {Math.abs(resolvedDelta).toFixed(1)}%
              </span>
              {trendLabel && <span style={{ color: palette.ink500 }}>· {trendLabel}</span>}
            </div>
          )}

          {/* Sparkline */}
          {sparklineData && sparklineData.length > 1 && (
            <div style={{ marginTop: space.xs }} aria-hidden="true">
              <Sparkline data={sparklineData} color={sparkColor} />
            </div>
          )}
        </>
      )}
    </Card>
  );

  if (prefersReducedMotion) {
    return <div style={{ height: '100%' }}>{cardContent}</div>;
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="rest"
      whileHover="hover"
      animate="rest"
      style={{ height: '100%' }}
    >
      {cardContent}
    </motion.div>
  );
};

/**
 * KpiCard — memoized to prevent unnecessary re-renders.
 * React.memo applied per Requirements 18.4 (render time ≥ 50ms components).
 */
export const KpiCard = React.memo(KpiCardInner);

export default KpiCard;
