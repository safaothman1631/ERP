/**
 * CountUp — React Bits animated number counter component
 *
 * Counts up from 0 to target value. Animation completes within 800–1200ms.
 *
 * Validates: Requirements 7.4, 2.2
 */
import React, { useEffect, useRef, useState } from 'react';

export interface CountUpProps {
  /** Target value to count up to */
  end: number;
  /** Starting value (default: 0) */
  start?: number;
  /** Animation duration in ms (default: 1000, must be 800–1200) */
  duration?: number;
  /** Number of decimal places */
  decimals?: number;
  /** Prefix string (e.g. '$') */
  prefix?: string;
  /** Suffix string (e.g. '%') */
  suffix?: string;
  /** Separator for thousands (e.g. ',') */
  separator?: string;
  /** CSS class */
  className?: string;
  /** Inline style */
  style?: React.CSSProperties;
  /** Called when animation completes */
  onComplete?: () => void;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const CountUp: React.FC<CountUpProps> = ({
  end,
  start = 0,
  duration = 1000,
  decimals = 0,
  prefix = '',
  suffix = '',
  separator = ',',
  className,
  style,
  onComplete,
}) => {
  const [value, setValue] = useState(start);
  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Clamp duration to 800–1200ms per spec
    const clampedDuration = Math.min(1200, Math.max(800, duration));
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / clampedDuration, 1);
      const easedProgress = easeOutCubic(progress);
      const current = start + (end - start) * easedProgress;

      setValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setValue(end);
        onComplete?.();
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [end, start, duration, onComplete]);

  const formatted = value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, separator);

  return (
    <span className={className} style={style} aria-live="polite" aria-atomic="true">
      {prefix}{formatted}{suffix}
    </span>
  );
};

export default CountUp;
