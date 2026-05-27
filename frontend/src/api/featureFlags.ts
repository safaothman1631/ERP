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

/* ---------------------------------------------------------------------------
 * Empty-state v2 per-entity flags (EP-0: empty-state-quick-create §15.1)
 * ---------------------------------------------------------------------------
 *
 * The backend exposes:
 *   - `ui.empty_state_v2`              — parent rollout flag (default OFF)
 *   - `ui.empty_state_v2.<entity>`     — per-entity override (default inherits)
 *
 * Reading nested flags via the existing fetchFeatureFlag API is too chatty for
 * the inline `<SelectWithQuickCreate>` HOC, so we expose a synchronous local
 * cache here. Tenant admins seed it via a single call to
 * `hydrateEmptyStateOverrides(map)` at app boot (typically in the bootstrap
 * code that already fetches a flag bundle). Reads default to `true` (parent
 * flag opt-in is sufficient) so legacy callers that never hydrate do not
 * regress.
 */

const EMPTY_STATE_OVERRIDES = new Map<string, boolean>();

/**
 * Hydrate the in-memory override map. Pass the entries from the bundled flag
 * payload — for example:
 *
 *   hydrateEmptyStateOverrides({
 *     customer: false,
 *     item: true,
 *   })
 */
export function hydrateEmptyStateOverrides(overrides: Record<string, boolean>): void {
  for (const [entity, enabled] of Object.entries(overrides)) {
    EMPTY_STATE_OVERRIDES.set(entity, Boolean(enabled));
  }
}

/**
 * Returns whether the v2 empty-state UI should render for `entity`.
 * The parent flag `ui.empty_state_v2` is read elsewhere (via `useFeatureFlag`)
 * — this helper only applies the per-entity override.
 */
export function isEmptyStateV2Enabled(entity: string): boolean {
  if (EMPTY_STATE_OVERRIDES.has(entity)) {
    return EMPTY_STATE_OVERRIDES.get(entity) ?? true;
  }
  return true;
}

/** Test helper — resets the override cache between cases. */
export function _resetEmptyStateOverridesForTest(): void {
  EMPTY_STATE_OVERRIDES.clear();
}
