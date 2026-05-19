/**
 * ShimmerText — React Bits shimmer text animation component
 *
 * Metallic sheen sweeps across text. Used for loading states and skeleton labels.
 *
 * Validates: Requirements 7.3, 2.2
 */
import React from 'react';

export interface ShimmerTextProps {
  /** Text content */
  children: React.ReactNode;
  /** Shimmer color (default: silver/white) */
  shimmerColor?: string;
  /** Base text color */
  baseColor?: string;
  /** Animation duration in ms (default: 1400) */
  duration?: number;
  /** CSS class */
  className?: string;
  /** Inline style */
  style?: React.CSSProperties;
}

const ShimmerText: React.FC<ShimmerTextProps> = ({
  children,
  shimmerColor = 'rgba(255,255,255,0.85)',
  baseColor = 'rgba(255,255,255,0.45)',
  duration = 1400,
  className,
  style,
}) => {
  const animationDuration = `${duration}ms`;

  return (
    <span
      className={className}
      style={{
        background: `linear-gradient(90deg, ${baseColor} 25%, ${shimmerColor} 50%, ${baseColor} 75%)`,
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: `shimmerText ${animationDuration} ease-in-out infinite`,
        display: 'inline-block',
        ...style,
      }}
    >
      {children}
      <style>{`
        @keyframes shimmerText {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-shimmer-text] { animation: none !important; }
        }
      `}</style>
    </span>
  );
};

export default ShimmerText;
