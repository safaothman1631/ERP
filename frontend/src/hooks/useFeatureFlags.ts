/**
 * useFeatureFlags — React hook for fetching all feature flags for the org.
 *
 * Returns the full list of flags, each with an `is_active` field that reflects
 * whether the flag is currently active for the requesting user (taking gradual
 * rollout percentage into account — evaluated server-side).
 *
 * Usage:
 *   const { flags, isLoading, error } = useFeatureFlags();
 *   const newDashboard = flags.find(f => f.key === 'new-dashboard');
 *   if (newDashboard?.is_active) { ... }
 *
 * Requirements: 7.4, 7.5, 7.6
 */
import { useState, useEffect } from 'react';
import { fetchFeatureFlags, type FeatureFlagResponse } from '../api/featureFlags';

export interface UseFeatureFlagsReturn {
  /** All feature flags for the current organisation. */
  flags: FeatureFlagResponse[];
  /** True while the flags are being fetched. */
  isLoading: boolean;
  /** Non-null if the fetch failed. */
  error: Error | null;
}

/**
 * Fetch all feature flags for the authenticated user's organisation.
 *
 * - Returns an empty array until the flags are resolved.
 * - On error, `flags` remains empty and `error` is populated.
 */
export function useFeatureFlags(): UseFeatureFlagsReturn {
  const [flags, setFlags] = useState<FeatureFlagResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    fetchFeatureFlags()
      .then((data) => {
        if (!cancelled) {
          setFlags(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFlags([]);
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { flags, isLoading, error };
}
