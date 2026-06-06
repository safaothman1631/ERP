import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../api';

export interface FormatsBag {
  date_format: string;
  time_format: '12h' | '24h';
  thousand_sep: string;
  decimal_sep: string;
  first_day_of_week: 'sat' | 'sun' | 'mon';
  units: 'metric' | 'imperial';
  paper_size: 'A4' | 'Letter';
}

export interface BrandingBag {
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  invoice_template: string;
  email_template: string;
}

export interface PaymentMethodsBag {
  cash: boolean;
  card: boolean;
  bank_transfer: boolean;
  fib: boolean;
  zaincash: boolean;
  asiacell: boolean;
  default_currency: string;
}

export interface LocalizationBag {
  country_pack: string;
  coa_template: string;
  address_format: string;
  phone_format: string;
  postal_code_format: string;
  iban_validation: boolean;
}

export interface WorkingHoursBag {
  open_time: string;
  close_time: string;
  workdays: string[];
}

export interface HolidaysBag {
  items: Array<{ date: string; name: string; recurring?: boolean }>;
}

export interface SsoBag {
  google: boolean;
  microsoft: boolean;
  saml: boolean;
  ldap: boolean;
  two_factor_required: boolean;
}

export interface PortalsBag {
  customer_portal_enabled: boolean;
  vendor_portal_enabled: boolean;
  link_expiry_days: number;
  require_terms_acceptance: boolean;
  terms_url: string;
}

export interface LanguagesBag {
  active: string[];
  default_lang: string;
  document_lang: string;
  rtl: boolean;
}

export interface MobileBag {
  push_enabled: boolean;
  biometric_required: boolean;
  force_min_version: string;
  deep_link_scheme: string;
  offline_sync_enabled: boolean;
  camera_barcode_enabled: boolean;
}

export interface PublicConfig {
  formats: FormatsBag;
  branding: BrandingBag;
  payment_methods: PaymentMethodsBag;
  localization: LocalizationBag;
  mobile: MobileBag;
  working_hours: WorkingHoursBag;
  holidays: HolidaysBag;
  sso: SsoBag;
  portals: PortalsBag;
  languages: LanguagesBag;
}

const DEFAULTS: PublicConfig = {
  formats: { date_format: 'YYYY-MM-DD', time_format: '24h', thousand_sep: ',', decimal_sep: '.', first_day_of_week: 'sun', units: 'metric', paper_size: 'A4' },
  branding: { logo_url: '', primary_color: '#7B61FF', secondary_color: '', font_family: 'system-ui', invoice_template: 'default', email_template: 'default' },
  payment_methods: { cash: true, card: true, bank_transfer: true, fib: false, zaincash: false, asiacell: false, default_currency: 'IQD' },
  localization: { country_pack: 'IQ', coa_template: 'iraq_standard', address_format: '{name}\n{line1}\n{line2}\n{city}, {country}', phone_format: '+964 ## ### ####', postal_code_format: '#####', iban_validation: true },
  mobile: { push_enabled: true, biometric_required: false, force_min_version: '1.0.0', deep_link_scheme: 'zoho://', offline_sync_enabled: true, camera_barcode_enabled: true },
  working_hours: { open_time: '09:00', close_time: '17:00', workdays: ['sun', 'mon', 'tue', 'wed', 'thu'] },
  holidays: { items: [] },
  sso: { google: false, microsoft: false, saml: false, ldap: false, two_factor_required: false },
  portals: { customer_portal_enabled: true, vendor_portal_enabled: true, link_expiry_days: 30, require_terms_acceptance: false, terms_url: '' },
  languages: { active: ['ku', 'en', 'ar'], default_lang: 'ku', document_lang: 'en', rtl: true },
};

/**
 * Conflict resolution strategy (Requirement 11.5):
 *
 * When local (localStorage) settings conflict with server settings, the server
 * always takes precedence.  The merge is performed at the "bag" level:
 *
 *   merged = { ...DEFAULTS, ...localBag, ...serverBag }
 *
 * This means:
 *  1. DEFAULTS fill any key absent from both sources.
 *  2. Local values override defaults (so offline edits are not lost until sync).
 *  3. Server values override local values (server is the source of truth).
 *
 * `syncFromServer()` is called after login (Requirement 11.3) and accepts the
 * orgId for traceability, even though the actual org-scoping is enforced by the
 * backend via the JWT claim.  The function fetches `/api/system/public-config`
 * which returns the full org-scoped config blob, then applies the server-wins
 * merge and persists the result to localStorage via Zustand persist middleware.
 */
interface SettingsState {
  config: PublicConfig;
  loaded: boolean;
  loading: boolean;
  /** orgId that was last synced from the server, or null if not yet synced. */
  syncedOrgId: string | null;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  setConfig: (cfg: Partial<PublicConfig>) => void;
  /**
   * Sync server settings to the client after login (Requirement 11.3).
   *
   * Fetches the org-scoped public config from the backend and merges it with
   * the current local config using server-wins conflict resolution
   * (Requirement 11.5).  The `orgId` parameter is used to tag the sync so
   * callers can detect stale data when the user switches organisations
   * (Requirement 11.4).
   *
   * @param orgId - The organisation ID of the logged-in user.
   */
  syncFromServer: (orgId: string) => Promise<void>;
}

/**
 * Merge a server config bag over the current local config using server-wins
 * conflict resolution (Requirement 11.5).
 *
 * For each category bag the precedence order is:
 *   DEFAULTS  <  local (current store value)  <  server
 *
 * This ensures:
 * - Missing keys are filled from DEFAULTS.
 * - Local-only edits (e.g. offline changes) are preserved until the server
 *   provides an explicit value.
 * - Any key present in the server response overrides the local value.
 */
function mergeServerWins(
  local: PublicConfig,
  server: Partial<PublicConfig>,
): PublicConfig {
  return {
    formats:         { ...DEFAULTS.formats,         ...local.formats,         ...(server.formats         || {}) },
    branding:        { ...DEFAULTS.branding,        ...local.branding,        ...(server.branding        || {}) },
    payment_methods: { ...DEFAULTS.payment_methods, ...local.payment_methods, ...(server.payment_methods || {}) },
    localization:    { ...DEFAULTS.localization,    ...local.localization,    ...(server.localization    || {}) },
    mobile:          { ...DEFAULTS.mobile,          ...local.mobile,          ...(server.mobile          || {}) },
    working_hours:   { ...DEFAULTS.working_hours,   ...local.working_hours,   ...(server.working_hours   || {}) },
    holidays:        { ...DEFAULTS.holidays,        ...local.holidays,        ...(server.holidays        || {}) },
    sso:             { ...DEFAULTS.sso,             ...local.sso,             ...(server.sso             || {}) },
    portals:         { ...DEFAULTS.portals,         ...local.portals,         ...(server.portals         || {}) },
    languages:       { ...DEFAULTS.languages,       ...local.languages,       ...(server.languages       || {}) },
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      config: DEFAULTS,
      loaded: false,
      loading: false,
      syncedOrgId: null,

      load: async () => {
        if (get().loading) return;
        set({ loading: true });
        try {
          const r = await api.get('/api/system/public-config');
          const cfg = (r.data || {}) as Partial<PublicConfig>;
          // Server-wins merge against DEFAULTS (no prior local state on initial load)
          set({
            config: mergeServerWins(DEFAULTS, cfg),
            loaded: true,
          });
        } catch {
          /* swallow — keep cached/default config */
        } finally {
          set({ loading: false });
        }
      },

      refresh: async () => {
        set({ loaded: false });
        await get().load();
      },

      setConfig: (cfg) => set((s) => ({ config: { ...s.config, ...cfg } as PublicConfig })),

      /**
       * Sync server settings to the client after login (Requirement 11.3).
       *
       * Fetches `/api/system/public-config` which is scoped to the
       * authenticated user's organisation via the JWT claim (Requirement 11.4).
       * Applies server-wins conflict resolution against the current local
       * config (Requirement 11.5) and persists the result to localStorage via
       * the Zustand persist middleware (Requirement 11.1).
       *
       * @param orgId - The organisation ID of the logged-in user.  Used to
       *   tag the last-synced org so callers can detect stale data when the
       *   user switches organisations.
       */
      syncFromServer: async (orgId: string) => {
        if (!orgId) return;
        if (get().loading) return;
        set({ loading: true });
        try {
          const r = await api.get('/api/system/public-config');
          const serverCfg = (r.data || {}) as Partial<PublicConfig>;
          const localCfg = get().config;
          // Server takes precedence on conflicts (Requirement 11.5)
          const merged = mergeServerWins(localCfg, serverCfg);
          set({ config: merged, loaded: true, syncedOrgId: orgId });
        } catch {
          /* swallow — keep existing local config; sync will retry on next login */
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'settings-config-cache',
      storage: createJSONStorage(() => {
        try {
          return typeof window !== 'undefined' ? window.localStorage : (undefined as any);
        } catch {
          return undefined as any;
        }
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          try { window.localStorage.removeItem('settings-config-cache'); } catch { /* noop */ }
        }
      },
      partialize: (s) => ({ config: s.config, loaded: s.loaded, syncedOrgId: s.syncedOrgId }),
      version: 1,
    }
  )
);

// ── Auto-refresh on settings mutation events ─────────────────────────
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('api:mutation', (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail || {};
        const url: string = detail.url || '';
        if (url.includes('/api/system/settings')) {
          // Debounce-ish: reload after a short delay so write is visible
          setTimeout(() => { useSettingsStore.getState().refresh(); }, 250);
        }
      } catch { /* noop */ }
    });
  } catch { /* noop */ }
}
