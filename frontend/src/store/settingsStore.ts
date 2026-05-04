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
  branding: { logo_url: '', primary_color: '#1677ff', secondary_color: '', font_family: 'system-ui', invoice_template: 'default', email_template: 'default' },
  payment_methods: { cash: true, card: true, bank_transfer: true, fib: false, zaincash: false, asiacell: false, default_currency: 'IQD' },
  localization: { country_pack: 'IQ', coa_template: 'iraq_standard', address_format: '{name}\n{line1}\n{line2}\n{city}, {country}', phone_format: '+964 ## ### ####', postal_code_format: '#####', iban_validation: true },
  mobile: { push_enabled: true, biometric_required: false, force_min_version: '1.0.0', deep_link_scheme: 'zoho://', offline_sync_enabled: true, camera_barcode_enabled: true },
  working_hours: { open_time: '09:00', close_time: '17:00', workdays: ['sun', 'mon', 'tue', 'wed', 'thu'] },
  holidays: { items: [] },
  sso: { google: false, microsoft: false, saml: false, ldap: false, two_factor_required: false },
  portals: { customer_portal_enabled: true, vendor_portal_enabled: true, link_expiry_days: 30, require_terms_acceptance: false, terms_url: '' },
  languages: { active: ['ku', 'en', 'ar'], default_lang: 'ku', document_lang: 'en', rtl: true },
};

interface SettingsState {
  config: PublicConfig;
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  setConfig: (cfg: Partial<PublicConfig>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      config: DEFAULTS,
      loaded: false,
      loading: false,
      load: async () => {
        if (get().loading) return;
        set({ loading: true });
        try {
          const r = await api.get('/api/system/public-config');
          const cfg = (r.data || {}) as Partial<PublicConfig>;
          set({
            config: {
              formats: { ...DEFAULTS.formats, ...(cfg.formats || {}) },
              branding: { ...DEFAULTS.branding, ...(cfg.branding || {}) },
              payment_methods: { ...DEFAULTS.payment_methods, ...(cfg.payment_methods || {}) },
              localization: { ...DEFAULTS.localization, ...(cfg.localization || {}) },
              mobile: { ...DEFAULTS.mobile, ...(cfg.mobile || {}) },
              working_hours: { ...DEFAULTS.working_hours, ...(cfg.working_hours || {}) },
              holidays: { ...DEFAULTS.holidays, ...(cfg.holidays || {}) },
              sso: { ...DEFAULTS.sso, ...(cfg.sso || {}) },
              portals: { ...DEFAULTS.portals, ...(cfg.portals || {}) },
              languages: { ...DEFAULTS.languages, ...(cfg.languages || {}) },
            },
            loaded: true,
          });
        } catch {
          /* swallow */
        } finally {
          set({ loading: false });
        }
      },
      refresh: async () => {
        set({ loaded: false });
        await get().load();
      },
      setConfig: (cfg) => set((s) => ({ config: { ...s.config, ...cfg } as PublicConfig })),
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
      partialize: (s) => ({ config: s.config, loaded: s.loaded }),
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
