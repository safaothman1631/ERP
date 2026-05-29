/**
 * @file StateSwitch.tsx
 * @description Deterministic state machine for collection-bound surfaces.
 *
 * Renders exactly one of: `loadingState`, `errorState`, `emptyState`, or
 * `populated`. The order is fixed (Requirement 7.2):
 *
 *   loading → error → empty → populated
 *
 * Direct rendering of `<EmptyState>` outside this component is forbidden
 * (the `local/state-switch-required` ESLint rule enforces this).
 */

import { memo, type ReactNode } from 'react';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import type { StateSwitchProps } from './types';

function StateSwitchBase({
  loading,
  error,
  empty,
  populated,
  loadingState,
  errorState,
  emptyState,
}: StateSwitchProps): ReactNode {
  // 1. loading wins — Requirement 7.2.
  if (loading) {
    return loadingState ?? <LoadingState />;
  }

  // 2. error next — if present, never show empty or populated.
  if (error) {
    return errorState ?? <ErrorState error={error} />;
  }

  // 3. empty — collection has zero items.
  if (empty) {
    return emptyState;
  }

  // 4. populated — default.
  return populated;
}

export const StateSwitch = memo(StateSwitchBase);
StateSwitch.displayName = 'StateSwitch';

export default StateSwitch;
