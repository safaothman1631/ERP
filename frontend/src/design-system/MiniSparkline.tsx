import React from 'react';

export interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

/**
 * MiniSparkline — Sprint 10 — tiny inline svg sparkline (no external dep).
 * React.memo applied per Requirements 18.4.
 */
const MiniSparklineInner: React.FC<MiniSparklineProps> = ({ data, width = 80, height = 24, color = '#7B61FF' }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={points} />
    </svg>
  );
};

export const MiniSparkline = React.memo(MiniSparklineInner);

export default MiniSparkline;
