import React from 'react';

export interface TrendChartProps {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
  color?: string;
}

/**
 * TrendChart — Sprint 10 — minimal inline svg line+area chart (no external dep).
 * React.memo applied per Requirements 18.4.
 */
const TrendChartInner: React.FC<TrendChartProps> = ({ data, width = 240, height = 80, color = '#1F6FEB' }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((d, i) => `${(i * step).toFixed(1)},${(height - ((d.value - min) / range) * height).toFixed(1)}`);
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} role="img" aria-label="trend">
      <path d={areaPath} fill={color} fillOpacity={0.12} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
};

export const TrendChart = React.memo(TrendChartInner);

export default TrendChart;
