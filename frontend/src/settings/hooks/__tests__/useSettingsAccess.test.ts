import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSettingsAccess } from '../useSettingsAccess';

const mockOnboardingState = {
  enabledModules: [] as string[] | null,
};

const mockPermissionState = {
  role: 'viewer' as string | null,
  permissions: [] as string[],
  isAuthenticated: true,
  isTenantOrgAdmin: false,
  hasPerm: (permission: string) => mockPermissionState.permissions.includes(permission),
};

vi.mock('../../../onboarding/store', () => ({
  useOnboardingStore: vi.fn((selector?: (state: typeof mockOnboardingState) => unknown) => {
    if (typeof selector === 'function') return selector(mockOnboardingState);
    return mockOnboardingState;
  }),
  isModuleEnabled: vi.fn((key: string | undefined, enabled: string[] | null) => {
    if (!key) return true;
    if (!enabled) return true;
    if (key === 'accounting' || key === 'banking') return true;
    return enabled.includes(key);
  }),
}));

vi.mock('../../../hooks/usePermission', () => ({
  usePermission: vi.fn(() => mockPermissionState),
}));

describe('useSettingsAccess', () => {
  beforeEach(() => {
    mockOnboardingState.enabledModules = [];
    mockPermissionState.role = 'viewer';
    mockPermissionState.permissions = [];
    mockPermissionState.isAuthenticated = true;
    mockPermissionState.isTenantOrgAdmin = false;
    mockPermissionState.hasPerm = (permission: string) => mockPermissionState.permissions.includes(permission);
  });

  it('allows authenticated users to edit personal sections', () => {
    const { result } = renderHook(() => useSettingsAccess('profile'));
    expect(result.current.canView).toBe(true);
    expect(result.current.canEdit).toBe(true);
    expect(result.current.denyReason).toBeNull();
  });

  it('denies unauthenticated users', () => {
    mockPermissionState.isAuthenticated = false;
    const { result } = renderHook(() => useSettingsAccess('profile'));
    expect(result.current.canView).toBe(false);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.denyReason).toBe('unauthenticated');
  });

  it('blocks module-gated sections when module is disabled', () => {
    mockPermissionState.role = 'admin';
    mockPermissionState.isTenantOrgAdmin = true;
    const { result } = renderHook(() => useSettingsAccess('sales'));
    expect(result.current.canView).toBe(false);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.denyReason).toBe('module_disabled');
  });

  it('allows manager to view but not edit org sections', () => {
    mockOnboardingState.enabledModules = ['sales'];
    mockPermissionState.role = 'manager';
    const { result } = renderHook(() => useSettingsAccess('sales'));
    expect(result.current.canView).toBe(true);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.denyReason).toBe('view_only');
  });

  it('allows tenant admin to edit org sections', () => {
    mockOnboardingState.enabledModules = ['sales'];
    mockPermissionState.role = 'admin';
    mockPermissionState.isTenantOrgAdmin = true;
    mockPermissionState.hasPerm = () => true;
    const { result } = renderHook(() => useSettingsAccess('sales'));
    expect(result.current.canView).toBe(true);
    expect(result.current.canEdit).toBe(true);
    expect(result.current.denyReason).toBeNull();
  });

  it('allows specific write permission without admin role', () => {
    mockOnboardingState.enabledModules = ['accounting'];
    mockPermissionState.role = 'accountant';
    mockPermissionState.permissions = ['settings.fiscal'];
    mockPermissionState.hasPerm = (permission: string) =>
      mockPermissionState.permissions.includes(permission);
    const { result } = renderHook(() => useSettingsAccess('fiscal'));
    expect(result.current.canView).toBe(true);
    expect(result.current.canEdit).toBe(true);
    expect(result.current.denyReason).toBeNull();
  });

  it('denies platform-only section in tenant context', () => {
    mockPermissionState.role = 'super_admin';
    mockPermissionState.permissions = ['platform.admin'];
    mockPermissionState.isTenantOrgAdmin = true;
    mockPermissionState.hasPerm = () => true;
    const { result } = renderHook(() => useSettingsAccess('feature_flags'));
    expect(result.current.canView).toBe(false);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.denyReason).toBe('platform_only');
  });

  it('admin cannot edit org_read activity section', () => {
    mockOnboardingState.enabledModules = ['sales'];
    mockPermissionState.role = 'admin';
    mockPermissionState.isTenantOrgAdmin = true;
    mockPermissionState.hasPerm = () => true;
    const { result } = renderHook(() => useSettingsAccess('activity'));
    expect(result.current.canView).toBe(true);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.denyReason).toBe('view_only');
  });

  it('sales specialist can view sales read-only but not crm', () => {
    mockOnboardingState.enabledModules = ['sales', 'crm'];
    mockPermissionState.role = 'sales';
    mockPermissionState.isTenantOrgAdmin = false;
    mockPermissionState.hasPerm = () => false;
    const sales = renderHook(() => useSettingsAccess('sales'));
    const crm = renderHook(() => useSettingsAccess('crm'));
    expect(sales.result.current.canView).toBe(true);
    expect(sales.result.current.canEdit).toBe(false);
    expect(crm.result.current.canView).toBe(false);
  });
});
