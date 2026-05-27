import { create } from 'zustand';
import api from '../api';
import type { ModuleKey } from './industries';
import { ALWAYS_ON } from './industries';
import type { BundleId } from './bundles';
import type { ModuleRequestRow } from './PendingApprovalScreen';

const CACHE_KEY_PREFIX = 'zoho_onboarding_cache_v1:';
const FRESH_FLAG = 'zoho_fresh_signup';

interface PrefsShape {
  industryId: string | null;
  enabledModules: ModuleKey[] | null;
  completed: boolean;
  requireModuleApproval: boolean;
}

interface LicenseShape {
  allowedModules: ModuleKey[] | null;
  bundleId: BundleId | string | null;
  expiresAt: string | null;
}

const EMPTY: PrefsShape = {
  industryId: null,
  enabledModules: null,
  completed: false,
  requireModuleApproval: true,
};

const cacheKey = (orgId: string | null) => CACHE_KEY_PREFIX + (orgId || 'anon');

const readCache = (orgId: string | null): PrefsShape => {
  try {
    const raw = localStorage.getItem(cacheKey(orgId));
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw);
    return {
      industryId: p.industryId ?? null,
      enabledModules: Array.isArray(p.enabledModules) ? p.enabledModules : null,
      completed: !!p.completed,
      requireModuleApproval: p.requireModuleApproval !== false,
    };
  } catch { return { ...EMPTY }; }
};

const writeCache = (orgId: string | null, p: PrefsShape) => {
  try { localStorage.setItem(cacheKey(orgId), JSON.stringify(p)); } catch { /* ignore */ }
};

const consumeFreshFlag = (): boolean => {
  try {
    if (localStorage.getItem(FRESH_FLAG) === '1') {
      localStorage.removeItem(FRESH_FLAG);
      return true;
    }
  } catch { /* ignore */ }
  return false;
};

export interface LoadForOrgOptions {
  canManageSettings?: boolean;
}

interface OnboardingState extends PrefsShape {
  orgId: string | null;
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  forceOpen: boolean;
  license: LicenseShape;
  pendingRequest: ModuleRequestRow | null;
  pendingAdminCount: number;
  loadForOrg: (orgId: string | null, options?: LoadForOrgOptions) => Promise<void>;
  loadLicense: () => Promise<void>;
  loadMyRequest: () => Promise<void>;
  loadPendingAdminCount: (canManageSettings?: boolean) => Promise<void>;
  submitModuleRequest: (industryId: string | null, mods: ModuleKey[], note?: string) => Promise<void>;
  complete: (industryId: string, mods: ModuleKey[]) => Promise<void>;
  reset: () => Promise<void>;
  reopen: () => void;
  markFreshSignup: () => void;
  clearForceOpen: () => void;
  hydrateFromStorageEvent: () => void;
}

interface ApiPrefs {
  industry_id: string | null;
  enabled_modules: string[];
  completed: boolean;
  require_module_approval?: boolean;
  is_demo_org?: boolean;
}

interface ApiLicense {
  allowed_modules: string[] | null;
  bundle_id: string | null;
  expires_at: string | null;
  require_module_approval: boolean;
  enabled_modules: string[] | null;
}

const fromApi = (p: ApiPrefs): PrefsShape => ({
  industryId: p.industry_id ?? null,
  enabledModules: (p.enabled_modules && p.enabled_modules.length > 0)
    ? (p.enabled_modules as ModuleKey[])
    : (p.completed ? [] : null),
  completed: !!p.completed,
  requireModuleApproval: p.require_module_approval !== false,
});

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  orgId: null,
  ...EMPTY,
  loaded: false,
  loading: false,
  saving: false,
  forceOpen: false,
  license: { allowedModules: null, bundleId: null, expiresAt: null },
  pendingRequest: null,
  pendingAdminCount: 0,

  loadLicense: async () => {
    try {
      const res = await api.get<ApiLicense>('/api/onboarding/license');
      set({
        license: {
          allowedModules: res.data.allowed_modules as ModuleKey[] | null,
          bundleId: res.data.bundle_id,
          expiresAt: res.data.expires_at,
        },
        requireModuleApproval: res.data.require_module_approval !== false,
      });
    } catch { /* keep defaults */ }
  },

  loadMyRequest: async () => {
    try {
      const res = await api.get<{ items: ModuleRequestRow[] }>('/api/onboarding/module-requests/mine');
      const items = res.data.items || [];
      const open = items.find(r => r.status === 'pending')
        || items.find(r => r.status === 'rejected')
        || items[0]
        || null;
      set({ pendingRequest: open });
    } catch {
      set({ pendingRequest: null });
    }
  },

  loadPendingAdminCount: async (canManageSettings) => {
    if (canManageSettings === false) {
      set({ pendingAdminCount: 0 });
      return;
    }
    try {
      const res = await api.get<{ total: number }>('/api/onboarding/module-requests', { params: { status: 'pending' } });
      set({ pendingAdminCount: res.data.total ?? (res.data as { items?: unknown[] }).items?.length ?? 0 });
    } catch {
      set({ pendingAdminCount: 0 });
    }
  },

  loadForOrg: async (orgId, options) => {
    const cached = readCache(orgId);
    const fresh = consumeFreshFlag();
    set({
      orgId,
      ...cached,
      loaded: false,
      loading: true,
      forceOpen: fresh ? true : (!cached.completed && cached.enabledModules === null),
    });

    if (!orgId) { set({ loading: false, loaded: true }); return; }

    try {
      const [prefsRes] = await Promise.all([
        api.get<ApiPrefs>('/api/onboarding/preferences'),
        get().loadLicense(),
        get().loadMyRequest(),
      ]);
      const server = fromApi(prefsRes.data);
      writeCache(orgId, server);
      const isDemoOrg = Boolean(prefsRes.data.is_demo_org);
      set({
        ...server,
        loaded: true,
        loading: false,
        forceOpen: isDemoOrg
          ? false
          : fresh
            ? true
            : (!server.completed && server.enabledModules === null && !get().pendingRequest),
      });
      await get().loadPendingAdminCount(options?.canManageSettings);
    } catch {
      set({ loading: false, loaded: true });
    }
  },

  submitModuleRequest: async (industryId, mods, note) => {
    const merged = Array.from(new Set<ModuleKey>([...mods, ...ALWAYS_ON]));
    set({ saving: true });
    try {
      await api.post('/api/onboarding/module-requests', {
        industry_id: industryId,
        requested_modules: merged.filter(m => !ALWAYS_ON.includes(m)),
        note,
      });
      await get().loadMyRequest();
      set({ saving: false, industryId, forceOpen: true });
    } catch (err) {
      set({ saving: false });
      throw err;
    }
  },

  complete: async (industryId, mods) => {
    const merged = Array.from(new Set<ModuleKey>([...mods, ...ALWAYS_ON]));
    const next: PrefsShape = {
      industryId,
      enabledModules: merged,
      completed: true,
      requireModuleApproval: get().requireModuleApproval,
    };
    set({ ...next, saving: true });
    try {
      await api.put('/api/onboarding/preferences', {
        industry_id: industryId,
        enabled_modules: merged,
        completed: true,
      });
      writeCache(get().orgId, next);
      set({ saving: false, forceOpen: false });
    } catch (err) {
      writeCache(get().orgId, next);
      set({ saving: false, forceOpen: false });
      throw err;
    }
  },

  reset: async () => {
    const next: PrefsShape = { ...EMPTY };
    set({ ...next, saving: true, forceOpen: false });
    try {
      await api.delete('/api/onboarding/preferences');
    } catch { /* ignore */ }
    writeCache(get().orgId, next);
    set({ saving: false });
  },

  reopen: () => set({ forceOpen: true, completed: false }),

  markFreshSignup: () => {
    try { localStorage.setItem(FRESH_FLAG, '1'); } catch { /* ignore */ }
    set({ forceOpen: true });
  },

  clearForceOpen: () => set({ forceOpen: false }),

  hydrateFromStorageEvent: () => {
    const { orgId } = get();
    set({ ...readCache(orgId) });
  },
}));

export const isModuleEnabled = (key: ModuleKey | undefined, enabled: ModuleKey[] | null): boolean => {
  if (!key) return true;
  if (!enabled) return true;
  if (ALWAYS_ON.includes(key)) return true;
  return enabled.includes(key);
};

export const isModuleInLicensePool = (key: ModuleKey, allowed: ModuleKey[] | null): boolean => {
  if (!allowed) return true;
  if (ALWAYS_ON.includes(key)) return true;
  return allowed.includes(key);
};
