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
// CSS-var tokens (defined in theme/vertex-tokens.css) auto-flip for dark mode via
// [data-theme="dark"] on <html>, so the card is correct in BOTH themes with no JS
// palette branching. `primary` matches the kit's accent-soft / accent-400 badge.

const TONE_BG: Record<NonNullable<KpiCardProps['tone']>, string> = {
  primary: 'var(--accent-soft)',
  success: 'var(--success-bg)',
  warning: 'var(--warning-bg)',
  danger:  'var(--danger-bg)',
  info:    'var(--info-bg)',
};

const TONE_COLOR: Record<NonNullable<KpiCardProps['tone']>, string> = {
  primary: 'var(--accent-400)',
  success: 'var(--success-fg)',
  warning: 'var(--warning-fg)',
  danger:  'var(--danger-fg)',
  info:    'var(--info-fg)',
};

const TONE_SPARKLINE: Record<NonNullable<KpiCardProps['tone']>, string> = {
  primary: 'var(--accent-500)',
  success: 'var(--success-500)',
  warning: 'var(--warning-500)',
  danger:  'var(--danger-500)',
  info:    'var(--info-500)',
};

// ─── Sparkline ────────────────────────────────────────────────────────────────

interface SparklineProps {
  data: number[];
  color: string;
}

const Sparkline: React.FC<SparklineProps> = ({ data, color }) => {
  const chartData = data.map((v, i) => ({ i, v }));
  // `color` is a CSS var (e.g. var(--accent-500)) so the SVG fill/stroke flip with
  // the theme. Derive a DOM-safe gradient id from the var name (not a hex string).
  const gradId = `spark-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradId})`}
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
      className="vx-card vx-card-h"
      hoverable={!!onClick}
      onClick={onClick}
      styles={{ body: { padding: 16 } }}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
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
          {/* Header: title + icon badge (kit: accent-soft / accent-400) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <Tooltip title={hint}>
              <span style={{
                color: 'var(--ink-500)',
                fontSize: 12.5,
                fontWeight: 500,
                lineHeight: 1.4,
              }}>
                {title}
              </span>
            </Tooltip>
            {icon && (
              <span style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: TONE_BG[tone],
                color: TONE_COLOR[tone],
                fontSize: 16,
                flexShrink: 0,
              }}>
                {icon}
              </span>
            )}
          </div>

          {/* Value — kit display font, 26px, tabular-nums, ink-900 (flips for dark) */}
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--ink-900)',
            lineHeight: 1.2,
            fontVariantNumeric: 'tabular-nums',
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
                style={{ fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', fontFamily: 'inherit' }}
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

          {/* Delta indicator — success/danger fg tokens (flip for dark) */}
          {typeof resolvedDelta === 'number' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: deltaUp ? 'var(--success-fg)' : 'var(--danger-fg)',
              marginTop: 6,
            }}>
              {deltaUp ? <ArrowUpOutlined aria-hidden /> : <ArrowDownOutlined aria-hidden />}
              <span style={{ fontWeight: 600 }} aria-label={`${deltaUp ? 'up' : 'down'} ${Math.abs(resolvedDelta).toFixed(1)} percent`}>
                {Math.abs(resolvedDelta).toFixed(1)}%
              </span>
              {trendLabel && <span style={{ color: 'var(--ink-500)', fontWeight: 400 }}>· {trendLabel}</span>}
            </div>
          )}

          {/* Sparkline */}
          {sparklineData && sparklineData.length > 1 && (
            <div style={{ marginTop: 10 }} aria-hidden="true">
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
