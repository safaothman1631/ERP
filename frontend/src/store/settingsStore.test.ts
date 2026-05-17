/**
 * Unit tests for settingsStore.ts
 *
 * Validates Requirements 11.1–11.5:
 *  11.1 — localStorage used for client-side persistence
 *  11.3 — syncFromServer() syncs server settings to client on login
 *  11.4 — Settings are organisation-scoped (orgId is tracked)
 *  11.5 — Server takes precedence on conflicts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the store so Vitest hoists them
// ---------------------------------------------------------------------------

// Mock the api module so we can control what the "server" returns
vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock firebase so the store module can be imported without a real Firebase app
vi.mock('../firebase', () => ({
  auth: {},
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import api from '../api';
import { useSettingsStore } from './settingsStore';
import type { PublicConfig } from './settingsStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULTS_FORMATS = {
  date_format: 'YYYY-MM-DD',
  time_format: '24h',
  thousand_sep: ',',
  decimal_sep: '.',
  first_day_of_week: 'sun',
  units: 'metric',
  paper_size: 'A4',
};

/** Reset the Zustand store to its initial state between tests. */
function resetStore() {
  useSettingsStore.setState({
    config: {
      formats: { ...DEFAULTS_FORMATS } as PublicConfig['formats'],
      branding: { logo_url: '', primary_color: '#1677ff', secondary_color: '', font_family: 'system-ui', invoice_template: 'default', email_template: 'default' },
      payment_methods: { cash: true, card: true, bank_transfer: true, fib: false, zaincash: false, asiacell: false, default_currency: 'IQD' },
      localization: { country_pack: 'IQ', coa_template: 'iraq_standard', address_format: '{name}\n{line1}\n{line2}\n{city}, {country}', phone_format: '+964 ## ### ####', postal_code_format: '#####', iban_validation: true },
      mobile: { push_enabled: true, biometric_required: false, force_min_version: '1.0.0', deep_link_scheme: 'zoho://', offline_sync_enabled: true, camera_barcode_enabled: true },
      working_hours: { open_time: '09:00', close_time: '17:00', workdays: ['sun', 'mon', 'tue', 'wed', 'thu'] },
      holidays: { items: [] },
      sso: { google: false, microsoft: false, saml: false, ldap: false, two_factor_required: false },
      portals: { customer_portal_enabled: true, vendor_portal_enabled: true, link_expiry_days: 30, require_terms_acceptance: false, terms_url: '' },
      languages: { active: ['ku', 'en', 'ar'], default_lang: 'ku', document_lang: 'en', rtl: true },
    },
    loaded: false,
    loading: false,
    syncedOrgId: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('settingsStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Requirement 11.1: localStorage persistence ──────────────────────────

  describe('Requirement 11.1 — localStorage persistence', () => {
    it('persists config and loaded flag to localStorage after load()', async () => {
      const serverResponse: Partial<PublicConfig> = {
        formats: { ...DEFAULTS_FORMATS as PublicConfig['formats'], date_format: 'DD/MM/YYYY' },
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: serverResponse });

      await act(async () => {
        await useSettingsStore.getState().load();
      });

      const raw = localStorage.getItem('settings-config-cache');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.state.config.formats.date_format).toBe('DD/MM/YYYY');
      expect(parsed.state.loaded).toBe(true);
    });

    it('persists syncedOrgId to localStorage after syncFromServer()', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} });

      await act(async () => {
        await useSettingsStore.getState().syncFromServer('org-123');
      });

      const raw = localStorage.getItem('settings-config-cache');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.state.syncedOrgId).toBe('org-123');
    });
  });

  // ── Requirement 11.3: sync on login ─────────────────────────────────────

  describe('Requirement 11.3 — sync server settings to client on login', () => {
    it('syncFromServer() calls /api/system/public-config', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} });

      await act(async () => {
        await useSettingsStore.getState().syncFromServer('org-abc');
      });

      expect(api.get).toHaveBeenCalledWith('/api/system/public-config');
    });

    it('syncFromServer() sets loaded=true after a successful sync', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} });

      await act(async () => {
        await useSettingsStore.getState().syncFromServer('org-abc');
      });

      expect(useSettingsStore.getState().loaded).toBe(true);
    });

    it('syncFromServer() does nothing when orgId is empty', async () => {
      await act(async () => {
        await useSettingsStore.getState().syncFromServer('');
      });

      expect(api.get).not.toHaveBeenCalled();
    });

    it('syncFromServer() keeps existing config when the API call fails', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'));

      // Set a known local value first
      useSettingsStore.setState((s) => ({
        config: { ...s.config, formats: { ...s.config.formats, date_format: 'local-value' } },
      }));

      await act(async () => {
        await useSettingsStore.getState().syncFromServer('org-abc');
      });

      expect(useSettingsStore.getState().config.formats.date_format).toBe('local-value');
    });

    it('syncFromServer() resets loading to false even when the API call fails', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'));

      await act(async () => {
        await useSettingsStore.getState().syncFromServer('org-abc');
      });

      expect(useSettingsStore.getState().loading).toBe(false);
    });
  });

  // ── Requirement 11.4: organisation-scoped settings ──────────────────────

  describe('Requirement 11.4 — organisation-scoped settings', () => {
    it('syncFromServer() records the orgId that was synced', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} });

      await act(async () => {
        await useSettingsStore.getState().syncFromServer('org-xyz');
      });

      expect(useSettingsStore.getState().syncedOrgId).toBe('org-xyz');
    });

    it('syncedOrgId updates when syncing for a different org', async () => {
      (api.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: {} });

      await act(async () => {
        await useSettingsStore.getState().syncFromServer('org-1');
      });
      expect(useSettingsStore.getState().syncedOrgId).toBe('org-1');

      await act(async () => {
        await useSettingsStore.getState().syncFromServer('org-2');
      });
      expect(useSettingsStore.getState().syncedOrgId).toBe('org-2');
    });
  });

  // ── Requirement 11.5: server takes precedence on conflicts ───────────────

  describe('Requirement 11.5 — server takes precedence on conflicts', () => {
    it('server value overrides local value for the same key', async () => {
      // Set a local value that differs from the server
      useSettingsStore.setState((s) => ({
        config: { ...s.config, formats: { ...s.config.formats, date_format: 'local-format' } },
      }));

      const serverResponse: Partial<PublicConfig> = {
        formats: { ...DEFAULTS_FORMATS as PublicConfig['formats'], date_format: 'server-format' },
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: serverResponse });

      await act(async () => {
        await useSettingsStore.getState().syncFromServer('org-abc');
      });

      // Server wins
      expect(useSettingsStore.getState().config.formats.date_format).toBe('server-format');
    });

    it('local value is preserved when the server does not provide that key', async () => {
      // Set a local value
      useSettingsStore.setState((s) => ({
        config: { ...s.config, formats: { ...s.config.formats, date_format: 'local-only' } },
      }));

      // Server returns an empty formats bag (key absent)
      const serverResponse: Partial<PublicConfig> = { formats: {} as PublicConfig['formats'] };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: serverResponse });

      await act(async () => {
        await useSettingsStore.getState().syncFromServer('org-abc');
      });

      // Local value is preserved because server didn't override it
      expect(useSettingsStore.getState().config.formats.date_format).toBe('local-only');
    });

    it('server value overrides local value across multiple bags simultaneously', async () => {
      useSettingsStore.setState((s) => ({
        config: {
          ...s.config,
          formats: { ...s.config.formats, date_format: 'local-date' },
          branding: { ...s.config.branding, primary_color: '#local' },
        },
      }));

      const serverResponse: Partial<PublicConfig> = {
        formats: { ...DEFAULTS_FORMATS as PublicConfig['formats'], date_format: 'server-date' },
        branding: {
          logo_url: '', secondary_color: '', font_family: 'system-ui',
          invoice_template: 'default', email_template: 'default',
          primary_color: '#server',
        },
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: serverResponse });

      await act(async () => {
        await useSettingsStore.getState().syncFromServer('org-abc');
      });

      expect(useSettingsStore.getState().config.formats.date_format).toBe('server-date');
      expect(useSettingsStore.getState().config.branding.primary_color).toBe('#server');
    });

    it('DEFAULTS fill keys absent from both local and server', async () => {
      // Server returns a partial formats bag (missing most keys)
      const serverResponse: Partial<PublicConfig> = {
        formats: { date_format: 'server-date' } as PublicConfig['formats'],
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: serverResponse });

      await act(async () => {
        await useSettingsStore.getState().syncFromServer('org-abc');
      });

      // Keys not in server response fall back to DEFAULTS
      expect(useSettingsStore.getState().config.formats.time_format).toBe('24h');
      expect(useSettingsStore.getState().config.formats.paper_size).toBe('A4');
    });

    it('load() also applies server-wins merge against DEFAULTS', async () => {
      const serverResponse: Partial<PublicConfig> = {
        formats: { ...DEFAULTS_FORMATS as PublicConfig['formats'], date_format: 'server-load-format' },
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: serverResponse });

      await act(async () => {
        await useSettingsStore.getState().load();
      });

      expect(useSettingsStore.getState().config.formats.date_format).toBe('server-load-format');
    });
  });
});
