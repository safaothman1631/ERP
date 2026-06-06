/**
 * LoadingSkeleton — Skeleton loading system with shimmer animation.
 *
 * Vertex "Slate & Signal" kit: flat var(--surface) containers on the canvas,
 * 1px var(--border) hairlines, kit radii, and a shimmer that rides on the
 * neutral surface-2 ramp (matching the kit's `.vx-skel`).
 *
 * Variants:
 *  - row:   Horizontal bars matching list-item / table-row dimensions
 *  - card:  Rectangular block matching KPI card / summary card dimensions
 *  - chart: Rectangular block matching recharts area chart dimensions
 *  - table: Header row + N body rows matching DataTable dimensions
 *
 * Shimmer animation is defined in globalStyles.css (.skeleton class), driven by
 * --skeleton-base / --skeleton-highlight which AUTO-FLIP via [data-theme='dark']
 * on <html>. The `isDark` prop additionally forces the dark ramp on demand.
 *
 * Requirements: 7.3, 9.3, 9.4, 11.1–11.7
 */

import React from 'react';
import { useIsDark } from '../hooks/useIsDark';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SkeletonVariant = 'row' | 'card' | 'chart' | 'table';

export interface LoadingSkeletonProps {
  /** Which skeleton shape to render. */
  variant: SkeletonVariant;
  /**
   * Number of body rows to render for the `table` variant.
   * Also controls the number of rows for the `row` variant.
   * @default 5
   */
  rows?: number;
  /**
   * Explicit dark-mode override. When true, forces dark skeleton colours
   * regardless of the [data-theme] attribute on <html>.
   * Implemented by injecting a wrapper with --skeleton-base / --skeleton-highlight
   * CSS variable overrides.
   */
  isDark?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Inline style override for explicit dark-mode prop. */
const darkOverride: React.CSSProperties = {
  // These match the [data-theme='dark'] values in globalStyles.css
  ['--skeleton-base' as string]:      'rgba(255, 255, 255, 0.06)',
  ['--skeleton-highlight' as string]: 'rgba(255, 255, 255, 0.12)',
};

/** A single shimmer bar. Rides the kit's neutral surface ramp via `.skeleton`. */
const Bar: React.FC<{ width?: string | number; height?: string | number; style?: React.CSSProperties }> = ({
  width = '100%',
  height = 16,
  style,
}) => (
  <div
    className="skeleton"
    // 5px == kit `.vx-skel` default radius.
    style={{ width, height, borderRadius: 5, ...style }}
    aria-hidden="true"
  />
);

// ─── Row Variant ──────────────────────────────────────────────────────────────

/**
 * Row skeleton — matches a list item or table row.
 * Each row has a short leading bar (icon/avatar placeholder) + two text bars.
 */
const RowSkeleton: React.FC<{ rows: number }> = ({ rows }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', height: 40 }}
        role="presentation"
      >
        {/* Leading icon/avatar placeholder */}
        <Bar width={32} height={32} style={{ borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
        {/* Text lines */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <Bar width={`${55 + (i % 3) * 15}%`} height={14} />
          <Bar width={`${30 + (i % 4) * 10}%`} height={12} />
        </div>
        {/* Trailing value placeholder */}
        <Bar width={64} height={14} style={{ flexShrink: 0 }} />
      </div>
    ))}
  </div>
);

// ─── Card Variant ─────────────────────────────────────────────────────────────

/**
 * Card skeleton — matches a KPI card or summary card.
 * Dimensions mirror KpiCard: ~200px tall with header, value, and sparkline areas.
 */
const CardSkeleton: React.FC = () => (
  <div
    style={{
      padding: 'var(--space-xl)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)',
      minHeight: 140,
    }}
    role="presentation"
  >
    {/* Header row: icon + title */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
      <Bar width={32} height={32} style={{ borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
      <Bar width="55%" height={14} />
    </div>
    {/* Value */}
    <Bar width="70%" height={28} style={{ marginTop: 'var(--space-xs)' }} />
    {/* Delta badge */}
    <Bar width="30%" height={12} />
    {/* Sparkline area */}
    <Bar width="100%" height={36} style={{ borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-xs)' }} />
  </div>
);

// ─── Chart Variant ────────────────────────────────────────────────────────────

/**
 * Chart skeleton — matches a recharts AreaChart card.
 * Includes a title bar, axis lines, and the chart body area.
 */
const ChartSkeleton: React.FC = () => (
  <div
    style={{
      padding: 'var(--space-xl)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)',
    }}
    role="presentation"
  >
    {/* Card title */}
    <Bar width="40%" height={16} />
    {/* Chart body */}
    <Bar width="100%" height={180} style={{ borderRadius: 'var(--radius-md)', marginTop: 'var(--space-xs)' }} />
    {/* X-axis labels */}
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
      {[40, 32, 36, 28, 40, 32].map((w, i) => (
        <Bar key={i} width={w} height={10} />
      ))}
    </div>
  </div>
);

// ─── Table Variant ────────────────────────────────────────────────────────────

/**
 * Table skeleton — matches a DataTable with a header row + N body rows.
 * Column widths vary to mimic real column proportions.
 */
const TableSkeleton: React.FC<{ rows: number }> = ({ rows }) => {
  // Approximate column widths as percentages (5 columns)
  const colWidths = ['8%', '22%', '18%', '20%', '14%', '10%'];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
      role="presentation"
    >
      {/* Header row — sits on surface-2 with a stronger hairline, echoing the
          kit's uppercase table head. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          padding: 'var(--space-md) var(--space-lg)',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border-strong)',
        }}
      >
        {/* Checkbox placeholder */}
        <Bar width={16} height={16} style={{ borderRadius: 'var(--radius-xs)', flexShrink: 0 }} />
        {colWidths.map((w, i) => (
          <Bar key={i} width={w} height={12} style={{ flexShrink: 0 }} />
        ))}
      </div>

      {/* Body rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-md)',
            padding: 'var(--space-md) var(--space-lg)',
            borderBottom:
              rowIdx === rows - 1 ? 'none' : '1px solid var(--border)',
          }}
        >
          {/* Checkbox placeholder */}
          <Bar width={16} height={16} style={{ borderRadius: 'var(--radius-xs)', flexShrink: 0 }} />
          {colWidths.map((w, colIdx) => (
            <Bar
              key={colIdx}
              // Vary widths slightly per row to look more natural
              width={`calc(${w} - ${(rowIdx + colIdx) % 3}%)`}
              height={14}
              style={{ flexShrink: 0 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * LoadingSkeleton renders the appropriate skeleton variant.
 * React.memo applied per Requirements 18.4.
 *
 * Usage:
 * ```tsx
 * <LoadingSkeleton variant="table" rows={8} />
 * <LoadingSkeleton variant="card" />
 * <LoadingSkeleton variant="chart" />
 * <LoadingSkeleton variant="row" rows={5} />
 * ```
 */
const LoadingSkeletonInner: React.FC<LoadingSkeletonProps> = ({
  variant,
  rows = 5,
  isDark: isDarkProp,
}) => {
  // Default to the live app theme so the skeleton flips for dark mode even when
  // the consumer never threads `isDark` (the common case). Called
  // unconditionally — rules-of-hooks safe.
  const themeDark = useIsDark();
  const isDark = isDarkProp ?? themeDark;

  const wrapperStyle: React.CSSProperties = isDark ? darkOverride : {};

  const content = (() => {
    switch (variant) {
      case 'row':
        return <RowSkeleton rows={rows} />;
      case 'card':
        return <CardSkeleton />;
      case 'chart':
        return <ChartSkeleton />;
      case 'table':
        return <TableSkeleton rows={rows} />;
      default:
        return <TableSkeleton rows={rows} />;
    }
  })();

  return (
    <div
      style={wrapperStyle}
      aria-label="Loading…"
      aria-busy="true"
      role="status"
    >
      {content}
    </div>
  );
};

export const LoadingSkeleton = React.memo(LoadingSkeletonInner);

export default LoadingSkeleton;
