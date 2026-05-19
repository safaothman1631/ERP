/**
 * DelayedSkeleton — Skeleton loader that only renders after a 300ms delay.
 *
 * Prevents flash-of-skeleton for fast loads while ensuring that loading states
 * longer than 300ms show a Skeleton_Loader matching the final content shape
 * (not a blank white screen).
 *
 * Validates: Requirements 1.2 (system-wide-ux-overhaul)
 */

import React, { useState, useEffect } from 'react';
import { LoadingSkeleton, type SkeletonVariant } from '../../design-system/LoadingSkeleton';

export interface DelayedSkeletonProps {
  /** Which skeleton shape to render. */
  variant: SkeletonVariant;
  /** Number of rows for table/row variants. @default 5 */
  rows?: number;
  /** Delay in ms before showing the skeleton. @default 300 */
  delay?: number;
  /** Whether the content is currently loading. */
  loading: boolean;
  /** The content to render when not loading. */
  children: React.ReactNode;
}

/**
 * DelayedSkeleton wraps content with a skeleton loader that appears after
 * a configurable delay (default 300ms). This prevents flash-of-skeleton for
 * fast loads while ensuring slow loads show a proper skeleton.
 *
 * Usage:
 * ```tsx
 * <DelayedSkeleton loading={isLoading} variant="table" rows={8}>
 *   <DataTable ... />
 * </DelayedSkeleton>
 * ```
 */
const DelayedSkeletonInner: React.FC<DelayedSkeletonProps> = ({
  variant,
  rows = 5,
  delay = 300,
  loading,
  children,
}) => {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowSkeleton(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowSkeleton(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [loading, delay]);

  if (!loading) {
    return <>{children}</>;
  }

  if (!showSkeleton) {
    // During the delay period, render nothing (avoids blank white AND flash-of-skeleton)
    return null;
  }

  return <LoadingSkeleton variant={variant} rows={rows} />;
};

export const DelayedSkeleton = React.memo(DelayedSkeletonInner);

export default DelayedSkeleton;
