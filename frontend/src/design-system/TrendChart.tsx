import React from 'react';

export interface TrendChartProps {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
  color?: string;
}

/**
 * TrendChart — Sprint 10 — minimal inline svg line+area chart (no external dep).
 *
 * Vertex "Slate & Signal" kit parity (see ui_kits/vertex-next/ui.jsx Sparkline +
 * screens.jsx trend): accent line via `var(--accent-500)`, vertical gradient
 * area fill (0.28 → 0), token hairline gridlines (`var(--border)`), rounded
 * non-scaling stroke, and a fluid `viewBox` so it scales to its container. All
 * colors are CSS var tokens so the chart auto-flips for light + dark themes
 * (no hardcoded light/dark colors).
 *
 * React.memo applied per Requirements 18.4.
 */
const TrendChartInner: React.FC<TrendChartProps> = ({
  data,
  width = 240,
  height = 80,
  color = 'var(--accent-500)',
}) => {
  // Unique gradient id per instance — declared before any early return (rules-of-hooks).
  const gradientId = React.useId().replace(/[:]/g, '');
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  // Inset the curve 2px top/bottom so the stroke never clips at the SVG edge (kit behavior).
  const pad = 2;
  const plot = Math.max(height - pad * 2, 1);
  const points = data.map(
    (d, i) => `${(i * step).toFixed(1)},${(height - pad - ((d.value - min) / range) * plot).toFixed(1)}`,
  );
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="trend"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Hairline baseline + midline gridlines (token-driven, flips with theme). */}
      <line x1={0} x2={width} y1={height - pad} y2={height - pad} stroke="var(--border)" strokeWidth={1} />
      <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="var(--border)" strokeWidth={1} strokeOpacity={0.6} />
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const TrendChart = React.memo(TrendChartInner);

export default TrendChart;
