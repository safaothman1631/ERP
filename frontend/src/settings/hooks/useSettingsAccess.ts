import { useMemo } from 'react';
import type { ModuleKey } from '../../onboarding/industries';
import { isModuleEnabled } from '../../onboarding/store';
import { useOnboardingStore } from '../../onboarding/store';
import { usePermission } from '../../hooks/usePermission';
import { canEditBinding, getBinding, getVisibleBindings } from '../registry/moduleSettingsRegistry';
import {
  bindingMatchesAccountantScope,
  bindingMatchesSpecialistScope,
  isAccountantRole,
  isSpecialistRole,
} from '../registry/roleModuleScope';
import type { SectionBinding, SectionKey } from '../registry/types';

export type SettingsDenyReason =
  | 'unauthenticated'
  | 'unknown_section'
  | 'platform_only'
  | 'module_disabled'
  | 'permission_denied'
  | 'view_only'
  | null;

function hasModuleAccess(binding: SectionBinding, enabledModules: ModuleKey[] | null): boolean {
  if (!binding.moduleGate || binding.moduleGate.length === 0) return true;
  const normalized = enabledModules ?? [];
  return binding.moduleGate.some((moduleKey) => isModuleEnabled(moduleKey, normalized));
}

export function useSettingsAccess(sectionKey: SectionKey): {
  canView: boolean;
  canEdit: boolean;
  denyReason: SettingsDenyReason;
} {
  const enabledModules = useOnboardingStore((state) => state.enabledModules);
  const { role, permissions, hasPerm, isAuthenticated, isTenantOrgAdmin } = usePermission();

  return useMemo(() => {
    const binding = getBinding(sectionKey);
    if (!isAuthenticated) {
      return { canView: false, canEdit: false, denyReason: 'unauthenticated' as const };
    }
    if (!binding) {
      return { canView: false, canEdit: false, denyReason: 'unknown_section' as const };
    }
    if (binding.tier === 'platform_only') {
      return { canView: false, canEdit: false, denyReason: 'platform_only' as const };
    }
    if (!hasModuleAccess(binding, enabledModules)) {
      return { canView: false, canEdit: false, denyReason: 'module_disabled' as const };
    }

    const visible = getVisibleBindings(enabledModules, role, permissions, true);
    const canView = visible.some((section) => section.key === sectionKey);
    if (!canView) {
      return { canView: false, canEdit: false, denyReason: 'permission_denied' as const };
    }

    if (binding.tier === 'personal') {
      return { canView: true, canEdit: true, denyReason: null };
    }

    // org_read sections are immutable for everyone (including admin).
    if (binding.tier === 'org_read') {
      return { canView: true, canEdit: false, denyReason: 'view_only' as const };
    }

    // Specialist scoped read — view module settings, never edit.
    if (isSpecialistRole(role) && !isAccountantRole(role)) {
      if (bindingMatchesSpecialistScope(role, binding, enabledModules)) {
        return { canView: true, canEdit: false, denyReason: 'view_only' as const };
      }
    }

    // Accountant — finance write only with matching permission.
    if (isAccountantRole(role) && bindingMatchesAccountantScope(binding)) {
      const canEditFinance =
        canEditBinding(binding, role, permissions) ||
        hasPerm(binding.permission || 'settings.update');
      return {
        canView: true,
        canEdit: canEditFinance,
        denyReason: canEditFinance ? null : ('view_only' as const),
      };
    }

    // Manager and other read-only org viewers.
    const canEdit =
      canEditBinding(binding, role, permissions) ||
      (isTenantOrgAdmin && binding.tier === 'org_write');

    if (!canEdit) {
      return { canView: true, canEdit: false, denyReason: 'view_only' as const };
    }

    return { canView: true, canEdit: true, denyReason: null };
  }, [enabledModules, hasPerm, isAuthenticated, isTenantOrgAdmin, permissions, role, sectionKey]);
}

/** Default landing section per role (requirements v2 §2). */
export function getDefaultSettingsSection(
  role: string | null,
  enabledModules: ModuleKey[] | null,
  permissions: Iterable<string> | null | undefined,
): SectionKey {
  const visible = getVisibleBindings(enabledModules, role, permissions, true);
  if (visible.length === 0) return 'profile';
  if (role === 'admin' || role === 'owner') {
    const org = visible.find((s) => s.key === 'organization' || s.key === 'general');
    if (org) return org.key;
  }
  return visible[0]?.key ?? 'profile';
}
