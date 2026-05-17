/**
 * useFeatureFlag — React hook for querying a single feature flag.
 *
 * Fetches the flag by key from the backend and returns its evaluated state.
 * The `isEnabled` value reflects the `is_active` field from the API, which
 * already accounts for the master on/off switch AND gradual rollout percentage
 * (evaluated server-side for the requesting user).
 *
 * Usage:
 *   const { isEnabled, isLoading, error } = useFeatureFlag('new-dashboard');
 *   if (isLoading) return <Spinner />;
 *   if (!isEnabled) return null;
 *   return <NewDashboard />;
 *
 * Requirements: 7.4, 7.5, 7.6
 */
import { useState, useEffect } from 'react';
import { fetchFeatureFlag } from '../api/featureFlags';

export interface UseFeatureFlagReturn {
  /** Whether the feature is active for the current user (accounts for gradual rollout). */
  isEnabled: boolean;
  /** True while the flag is being fetched. */
  isLoading: boolean;
  /** Non-null if the fetch failed (e.g. network error or 404). */
  error: Error | null;
}

/**
 * Fetch a single feature flag by key.
 *
 * - Defaults to `isEnabled: false` until the flag is resolved.
 * - If the flag does not exist (404) or any other error occurs, `isEnabled`
 *   remains false and `error` is populated — features are off-by-default on
 *   failure, which is the safe fallback.
 *
 * @param flagKey  The feature flag key (e.g. "new-dashboard").
 */
export function useFeatureFlag(flagKey: string): UseFeatureFlagReturn {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!flagKey) {
      setIsEnabled(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    setIsLoading(true);
    setError(null);

    fetchFeatureFlag(flagKey)
      .then((flag) => {
        if (!cancelled) {
          setIsEnabled(flag.is_active);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setIsEnabled(false);
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [flagKey]);

  return { isEnabled, isLoading, error };
}
