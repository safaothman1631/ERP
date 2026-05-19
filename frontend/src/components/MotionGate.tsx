/**
 * MotionGate — HOC that gates animation components behind prefers-reduced-motion
 *
 * When `prefers-reduced-motion: reduce` is set, renders the `fallback` prop
 * (or null) immediately — fully disabling the animation, not merely reducing it.
 *
 * Usage:
 * ```tsx
 * // Wrap any React Bits component
 * <MotionGate
 *   Component={Typewriter}
 *   text="Hello World"
 *   fallback={<span>Hello World</span>}
 * />
 *
 * // Or use the render-prop variant
 * <MotionGate fallback={<span>Hello World</span>}>
 *   <Typewriter text="Hello World" />
 * </MotionGate>
 * ```
 *
 * Validates: Requirements 2.5, 7.6, 9.7
 */
import React from 'react';
import { useReducedMotion } from 'framer-motion';

// ─── Generic HOC variant ────────────────────────────────────────────────────

export interface MotionGateHOCProps<P extends object> {
  /** The animated component to render when motion is allowed */
  Component: React.ComponentType<P>;
  /** Fallback to render when prefers-reduced-motion is set (renders final static state) */
  fallback?: React.ReactNode;
  /** Props forwarded to Component */
  [key: string]: unknown;
}

/**
 * MotionGate HOC variant — wraps a component class/function.
 *
 * When reduced motion is preferred, renders `fallback` (or null).
 * When motion is allowed, renders `<Component {...props} />`.
 */
export function MotionGate<P extends object>({
  Component,
  fallback = null,
  ...props
}: MotionGateHOCProps<P>): React.ReactElement | null {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return fallback as React.ReactElement | null;
  }

  return <Component {...(props as P)} />;
}

// ─── Children variant ───────────────────────────────────────────────────────

export interface MotionGateChildrenProps {
  /** Animated content to render when motion is allowed */
  children: React.ReactNode;
  /** Fallback to render when prefers-reduced-motion is set (renders final static state) */
  fallback?: React.ReactNode;
}

/**
 * MotionGateChildren — render-prop variant.
 *
 * When reduced motion is preferred, renders `fallback` (or null).
 * When motion is allowed, renders `children`.
 *
 * @example
 * ```tsx
 * <MotionGateChildren fallback={<span>Hello</span>}>
 *   <Typewriter text="Hello" />
 * </MotionGateChildren>
 * ```
 */
export const MotionGateChildren: React.FC<MotionGateChildrenProps> = ({
  children,
  fallback = null,
}) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default MotionGate;
