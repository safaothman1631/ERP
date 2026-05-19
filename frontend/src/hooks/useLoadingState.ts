/**
 * useLoadingState — Controls skeleton visibility with threshold-based logic.
 *
 * Behaviour:
 *  - If `isLoading` becomes true, wait 300ms before showing the skeleton.
 *    This prevents a flash of skeleton for fast responses (< 300ms).
 *  - When `isLoading` becomes false (data ready), hide the skeleton immediately
 *    (the 200ms fade-out is handled by CSS on the consumer side).
 *  - If loading persists for ≥ 5000ms, expose `isError` so the consumer can
 *    render an error state with a retry button.
 *  - No spinner is ever shown — only skeleton or error state.
 *
 * Requirements: 9.3, 9.4, 11.3, 11.4, 11.7
 *
 * @example
 * ```tsx
 * const { showSkeleton, isError } = useLoadingState(isFetching);
 *
 * if (isError) return <ErrorState onRetry={refetch} />;
 * if (showSkeleton) return <LoadingSkeleton variant="table" />;
 * return <DataTable ... />;
 * ```
 */

import { useState, useEffect, useRef } from 'react';

/** Delay (ms) before the skeleton is shown. */
const SKELETON_DELAY_MS = 300;

/** Timeout (ms) after which an error state is shown. */
const ERROR_TIMEOUT_MS = 5000;

export interface LoadingStateResult {
  /** True when the skeleton should be rendered (loading has exceeded 300ms). */
  showSkeleton: boolean;
  /**
   * True when loading has exceeded 5000ms without completing.
   * Consumers should render an error state with a retry button.
   */
  isError: boolean;
}

/**
 * useLoadingState
 *
 * @param isLoading - Pass the loading boolean from your data-fetching hook.
 * @returns `{ showSkeleton, isError }`
 */
export function useLoadingState(isLoading: boolean): LoadingStateResult {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isError, setIsError] = useState(false);

  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading) {
      // Start the 300ms delay before showing skeleton
      skeletonTimerRef.current = setTimeout(() => {
        setShowSkeleton(true);
      }, SKELETON_DELAY_MS);

      // Start the 5000ms error timeout
      errorTimerRef.current = setTimeout(() => {
        setIsError(true);
      }, ERROR_TIMEOUT_MS);
    } else {
      // Data is ready — clear pending timers
      if (skeletonTimerRef.current !== null) {
        clearTimeout(skeletonTimerRef.current);
        skeletonTimerRef.current = null;
      }
      if (errorTimerRef.current !== null) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }

      // Hide skeleton immediately (CSS fade-out is the consumer's responsibility)
      setShowSkeleton(false);
      setIsError(false);
    }

    return () => {
      if (skeletonTimerRef.current !== null) {
        clearTimeout(skeletonTimerRef.current);
      }
      if (errorTimerRef.current !== null) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, [isLoading]);

  return { showSkeleton, isError };
}

export default useLoadingState;
