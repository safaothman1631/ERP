/**
 * React Bits — Animation component library
 *
 * Local implementations of React Bits animation components.
 * These components are designed to be used with MotionGate HOC
 * which handles prefers-reduced-motion accessibility.
 *
 * All components render their final static state when wrapped in MotionGate
 * and prefers-reduced-motion is enabled.
 *
 * Validates: Requirements 2.1–2.7, 7.1–7.7
 */
export { default as Typewriter } from './Typewriter';
export type { TypewriterProps } from './Typewriter';

export { default as GradientText } from './GradientText';
export type { GradientTextProps } from './GradientText';

export { default as ShimmerText } from './ShimmerText';
export type { ShimmerTextProps } from './ShimmerText';

export { default as CountUp } from './CountUp';
export type { CountUpProps } from './CountUp';

export { default as Particles } from './Particles';
export type { ParticlesProps, ParticleConfig } from './Particles';
