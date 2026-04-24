import { create } from 'zustand';
import api from '../api';
import type { ModuleKey } from './industries';
import { ALWAYS_ON } from './industries';

// localStorage cache for instant boot — server is source of truth.
// Per-org key so a shared device with multiple orgs stays correct.
const CACHE_KEY_PREFIX = 'zoho_onboarding_cache_v1:';
const FRESH_FLAG = 'zoho_fresh_signup'; // set by SignUp → forces wizard

interface PrefsShape {
  industryId: string | null;
  enabledModules: ModuleKey[] | null; // null = never configured → show all
  completed: boolean;
}

const EMPTY: PrefsShape = { industryId: null, enabledModules: null, completed: false };

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

interface OnboardingState extends PrefsShape {
  orgId: string | null;
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  forceOpen: boolean;
  // actions
  loadForOrg: (orgId: string | null) => Promise<void>;
  complete: (industryId: string, mods: ModuleKey[]) => Promise<void>;
  reset: () => Promise<void>;
  reopen: () => void;
  markFreshSignup: () => void;
  clearForceOpen: () => void;
  hydrateFromStorageEvent: () => void; // cross-tab sync
}

interface ApiPrefs {
  industry_id: string | null;
  enabled_modules: string[];
  completed: boolean;
}

const fromApi = (p: ApiPrefs): PrefsShape => ({
  industryId: p.industry_id ?? null,
  enabledModules: (p.enabled_modules && p.enabled_modules.length > 0) ? (p.enabled_modules as ModuleKey[]) : (p.completed ? [] : null),
  completed: !!p.completed,
});

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  orgId: null,
  ...EMPTY,
  loaded: false,
  loading: false,
  saving: false,
  forceOpen: false,

  loadForOrg: async (orgId) => {
    // 1. Optimistic load from cache for instant UI.
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

    // 2. Authoritative load from backend.
    try {
      const res = await api.get<ApiPrefs>('/api/onboarding/preferences');
      const server = fromApi(res.data);
      writeCache(orgId, server);
      set({
        ...server,
        loaded: true,
        loading: false,
        // If server says not completed, force open (unless we just unset it).
        forceOpen: fresh ? true : (!server.completed && server.enabledModules === null),
      });
    } catch (err) {
      // Stay with cached data; do not crash UI.
      set({ loading: false, loaded: true });
    }
  },

  complete: async (industryId, mods) => {
    const merged = Array.from(new Set<ModuleKey>([...mods, ...ALWAYS_ON]));
    const next: PrefsShape = { industryId, enabledModules: merged, completed: true };
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
      // Keep local change; cache it so the next load reconciles.
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

  reopen: () => {
    // Don't wipe selection — just force the wizard open again.
    set({ forceOpen: true, completed: false });
  },

  markFreshSignup: () => {
    try { localStorage.setItem(FRESH_FLAG, '1'); } catch { /* ignore */ }
    set({ forceOpen: true });
  },

  clearForceOpen: () => set({ forceOpen: false }),

  hydrateFromStorageEvent: () => {
    const { orgId } = get();
    const cached = readCache(orgId);
    set({ ...cached });
  },
}));

// Module-visibility gate. `null` = not configured → show all (legacy/back-compat).
// Always-on modules (accounting, banking) are forced visible.
export const isModuleEnabled = (key: ModuleKey | undefined, enabled: ModuleKey[] | null): boolean => {
  if (!key) return true;
  if (!enabled) return true;
  if (ALWAYS_ON.includes(key)) return true;
  return enabled.includes(key);
};
