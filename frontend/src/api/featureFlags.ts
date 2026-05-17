/**
 * featureFlags — API client for feature flag endpoints.
 *
 * Wraps the backend REST API:
 *   GET /api/feature-flags              — list all flags for the current org
 *   GET /api/feature-flags/{flag_key}   — get a single flag
 *
 * The `is_active` field on each response already accounts for gradual rollout
 * percentage (evaluated server-side for the requesting user).
 *
 * Requirements: 7.4, 7.5, 7.6
 */
import api from '../api';

/** Shape returned by the backend for a single feature flag. */
export interface FeatureFlagResponse {
  key: string;
  enabled: boolean;
  rollout_pct: number;
  description: string;
  org_id: string;
  /**
   * Evaluated value for the requesting user.
   * Accounts for the master `enabled` switch AND gradual rollout percentage.
   * Use this field to decide whether to show/hide a feature.
   */
  is_active: boolean;
}

/**
 * Fetch all feature flags for the authenticated user's organisation.
 *
 * Requirements: 7.4
 */
export async function fetchFeatureFlags(): Promise<FeatureFlagResponse[]> {
  const res = await api.get<FeatureFlagResponse[]>('/api/feature-flags');
  return res.data;
}

/**
 * Fetch a single feature flag by key.
 * Throws an AxiosError with status 404 if the flag does not exist.
 *
 * Requirements: 7.4, 7.5, 7.6
 */
export async function fetchFeatureFlag(flagKey: string): Promise<FeatureFlagResponse> {
  const res = await api.get<FeatureFlagResponse>(`/api/feature-flags/${encodeURIComponent(flagKey)}`);
  return res.data;
}
