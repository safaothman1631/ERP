/**
 * LoadingSkeleton — Skeleton loading system with shimmer animation.
 *
 * Variants:
 *  - row:   Horizontal bars matching list-item / table-row dimensions
 *  - card:  Rectangular block matching KPI card / summary card dimensions
 *  - chart: Rectangular block matching recharts area chart dimensions
 *  - table: Header row + N body rows matching DataTable dimensions
 *
 * Shimmer animation is defined in globalStyles.css (.skeleton class).
 * Light/dark CSS variables (--skeleton-base, --skeleton-highlight) are also
 * defined in globalStyles.css and toggled via [data-theme='dark'].
 *
 * Requirements: 7.3, 9.3, 9.4, 11.1–11.7
 */

import React from 'react';

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

/** A single shimmer bar. */
const Bar: React.FC<{ width?: string | number; height?: string | number; style?: React.CSSProperties }> = ({
  width = '100%',
  height = 16,
  style,
}) => (
  <div
    className="skeleton"
    style={{ width, height, borderRadius: 4, ...style }}
    aria-hidden="true"
  />
);

// ─── Row Variant ──────────────────────────────────────────────────────────────

/**
 * Row skeleton — matches a list item or table row.
 * Each row has a short leading bar (icon/avatar placeholder) + two text bars.
 */
const RowSkeleton: React.FC<{ rows: number }> = ({ rows }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        style={{ display: 'flex', alignItems: 'center', gap: 12, height: 40 }}
        role="presentation"
      >
        {/* Leading icon/avatar placeholder */}
        <Bar width={32} height={32} style={{ borderRadius: 6, flexShrink: 0 }} />
        {/* Text lines */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
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
      padding: 20,
      borderRadius: 12,
      border: '1px solid var(--color-border, #E5E7EB)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minHeight: 140,
    }}
    role="presentation"
  >
    {/* Header row: icon + title */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Bar width={32} height={32} style={{ borderRadius: 8, flexShrink: 0 }} />
      <Bar width="55%" height={14} />
    </div>
    {/* Value */}
    <Bar width="70%" height={28} style={{ marginTop: 4 }} />
    {/* Delta badge */}
    <Bar width="30%" height={12} />
    {/* Sparkline area */}
    <Bar width="100%" height={36} style={{ borderRadius: 6, marginTop: 4 }} />
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
      padding: 20,
      borderRadius: 12,
      border: '1px solid var(--color-border, #E5E7EB)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}
    role="presentation"
  >
    {/* Card title */}
    <Bar width="40%" height={16} />
    {/* Chart body */}
    <Bar width="100%" height={180} style={{ borderRadius: 8, marginTop: 4 }} />
    {/* X-axis labels */}
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
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
      style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
      role="presentation"
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border, #E5E7EB)',
        }}
      >
        {/* Checkbox placeholder */}
        <Bar width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} />
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
            gap: 12,
            padding: '14px 16px',
            borderBottom: '1px solid var(--color-border, #E5E7EB)',
          }}
        >
          {/* Checkbox placeholder */}
          <Bar width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} />
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
  isDark = false,
}) => {
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
