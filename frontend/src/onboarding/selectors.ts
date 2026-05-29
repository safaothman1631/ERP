import type { ModuleRequestRow } from './PendingApprovalScreen';

/** User is blocked on the pending-approval gate (no app modules). */
export const selectIsPendingModuleApproval = (s: {
  requireModuleApproval: boolean;
  pendingRequest: ModuleRequestRow | null;
}) => s.requireModuleApproval && s.pendingRequest?.status === 'pending';
