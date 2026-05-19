/**
 * Typewriter — React Bits text animation component
 *
 * Reveals text character-by-character at configurable interval.
 * Each character reveals at 40–60ms intervals; total animation ≤ 3 seconds.
 *
 * Validates: Requirements 7.1, 2.2
 */
import React, { useEffect, useState } from 'react';

export interface TypewriterProps {
  /** Text to animate */
  text: string;
  /** Delay per character in ms (default: 50) */
  speed?: number;
  /** CSS class for the wrapper span */
  className?: string;
  /** Inline style */
  style?: React.CSSProperties;
  /** Called when animation completes */
  onComplete?: () => void;
}

/**
 * Typewriter — animates text character by character.
 * When used inside MotionGate with reduced motion, the full text is shown immediately.
 */
const Typewriter: React.FC<TypewriterProps> = ({
  text,
  speed = 50,
  className,
  style,
  onComplete,
}) => {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    if (!text) return;

    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      setDisplayed(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <span className={className} style={style} aria-label={text}>
      {displayed}
      <span aria-hidden="true" style={{ borderInlineEnd: '2px solid currentColor', animation: 'blink 1s step-end infinite' }} />
    </span>
  );
};

export default Typewriter;
