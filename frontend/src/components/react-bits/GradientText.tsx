/**
 * GradientText — React Bits animated gradient text component
 *
 * Animated gradient sweep across text. Gradient cycle completes within 3 seconds.
 *
 * Validates: Requirements 7.2, 2.2
 */
import React from 'react';

export interface GradientTextProps {
  /** Text content */
  children: React.ReactNode;
  /** Gradient colors (CSS gradient string or array of colors) */
  colors?: string[];
  /** Animation duration in ms (default: 3000) */
  duration?: number;
  /** CSS class */
  className?: string;
  /** Inline style */
  style?: React.CSSProperties;
}

const GradientText: React.FC<GradientTextProps> = ({
  children,
  colors = ['#1F6FEB', '#0EA5E9', '#16A34A', '#1F6FEB'],
  duration = 3000,
  className,
  style,
}) => {
  const gradient = `linear-gradient(90deg, ${colors.join(', ')})`;
  const animationDuration = `${duration}ms`;

  return (
    <span
      className={className}
      style={{
        background: gradient,
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: `gradientShift ${animationDuration} linear infinite`,
        display: 'inline-block',
        ...style,
      }}
    >
      {children}
      <style>{`
        @keyframes gradientShift {
          0%   { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-gradient-text] { animation: none !important; }
        }
      `}</style>
    </span>
  );
};

export default GradientText;
