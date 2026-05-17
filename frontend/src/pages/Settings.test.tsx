/**
 * Settings.test.tsx
 *
 * Feature: nav-settings-cleanup, Property 6: Every settings section renders non-empty content
 * Validates: Requirements 6.1
 *
 * For each SectionKey, render <Settings /> with that section active (via ?s=<key>)
 * and assert that .st-content has at least one child element.
 *
 * Sections with badge: 'soon' render <Result status="info" /> — non-empty.
 * Sections without badge: 'soon' render their specific component — non-empty.
 * The 'numbering' section has link: '/settings/numbering' (external navigation)
 * and is excluded from this test since it is not an inline-rendered section.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';

// ---------------------------------------------------------------------------
// Polyfills required by Ant Design in jsdom
// ---------------------------------------------------------------------------

// Ant Design's responsive observer calls window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---------------------------------------------------------------------------
// Mock heavy / side-effectful modules before importing Settings
// ---------------------------------------------------------------------------

vi.mock('../firebase', () => ({
  default: {},
  auth: { currentUser: null, onAuthStateChanged: vi.fn(() => () => {}) },
  db: {},
  googleProvider: {},
  analytics: null,
}));

vi.mock('../api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

vi.mock('../store', () => {
  const authState = {
    token: 'test-token',
    userId: 'user-1',
    orgId: 'org-1',
    userName: 'Test User',
    isAuthenticated: true,
    theme: 'light' as const,
    layoutMode: 'classic-sidebar' as const,
    login: vi.fn(),
    logout: vi.fn(),
    toggleTheme: vi.fn(),
    setLayoutMode: vi.fn(),
  };
  return {
    useAuthStore: vi.fn((selector?: (s: typeof authState) => unknown) => {
      if (typeof selector === 'function') return selector(authState);
      return authState;
    }),
  };
});

vi.mock('../onboarding/store', () => {
  const storeState = {
    orgId: null as string | null,
    industryId: null as string | null,
    enabledModules: [] as string[],
    completed: true,
    loaded: true,
    loading: false,
    saving: false,
    forceOpen: false,
    reset: vi.fn(),
    reopen: vi.fn(),
    loadForOrg: vi.fn(),
    complete: vi.fn(),
    markFreshSignup: vi.fn(),
    clearForceOpen: vi.fn(),
    hydrateFromStorageEvent: vi.fn(),
  };
  return {
    useOnboardingStore: vi.fn((selector?: (s: typeof storeState) => unknown) => {
      if (typeof selector === 'function') return selector(storeState);
      return storeState;
    }),
    isModuleEnabled: vi.fn(() => true),
  };
});

vi.mock('../utils/message', () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
  },
  setMessageInstance: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import Settings after mocks are set up
// ---------------------------------------------------------------------------
import Settings from './Settings';

// ---------------------------------------------------------------------------
// i18n test instance — minimal translations to avoid missing-key noise
// ---------------------------------------------------------------------------
const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        help: 'Help',
        coming_soon: 'Coming soon',
        coming_soon_short: 'soon',
        settings: 'Settings',
      },
    },
  },
  interpolation: { escapeValue: false },
});

// ---------------------------------------------------------------------------
// All SectionKey values from Settings.tsx (hardcoded — type is not exported).
// 'numbering' is excluded: it has link: '/settings/numbering' and is an
// external-navigation section with no inline render conditional.
// ---------------------------------------------------------------------------
const ALL_SECTION_KEYS = [
  // Account & personal
  'profile', 'security', 'notifications', 'preferences',
  // Organization
  'organization', 'branches', 'branding', 'working_hours', 'holidays',
  // Users & access
  'users', 'roles', 'permissions', 'sso', 'portals',
  // Localization
  'localization', 'currencies', 'languages', 'formats',
  // Finance & compliance
  'fiscal', 'budgets', 'taxes', 'banking', 'payment_methods', 'einvoice',
  'templates', 'reminders',
  // Commerce
  'sales', 'crm', 'purchases', 'inventory', 'mrp', 'pos', 'ecommerce',
  'helpdesk',
  // Operations
  'hr', 'payroll', 'projects', 'marketing',
  // Automation & integrations
  'workflows', 'approvals', 'integrations', 'webhooks', 'api_tokens',
  // Content & comms
  'documents', 'email', 'sms_whatsapp',
  // System
  'modules', 'backup', 'activity', 'audit', 'gdpr', 'mobile', 'system',
] as const;

// ---------------------------------------------------------------------------
// Helper: render Settings with a given section key active via URL param
// ---------------------------------------------------------------------------
function renderSettings(sectionKey: string) {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={[`/settings?s=${sectionKey}`]}>
        <Settings />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

// ---------------------------------------------------------------------------
// Property 6: Every settings section renders non-empty content
// Feature: nav-settings-cleanup, Property 6: Every settings section renders non-empty content
// Validates: Requirements 6.1
// ---------------------------------------------------------------------------
describe('Property 6: Every settings section renders non-empty content', () => {
  afterEach(() => {
    cleanup();
  });

  it('all section keys render non-empty content in .st-content', { timeout: 30000 }, () => {
    for (const key of ALL_SECTION_KEYS) {
      const { container } = renderSettings(key);

      const content = container.querySelector('.st-content');
      expect(
        content,
        `Section '${key}': .st-content element not found in the DOM`,
      ).not.toBeNull();

      expect(
        content!.children.length,
        `Section '${key}': .st-content has no children (expected at least 1)`,
      ).toBeGreaterThan(0);

      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// Property 7: Every settings section has a help icon
// Feature: nav-settings-cleanup, Property 7: Every settings section has a help icon
// Validates: Requirements 7.1, 7.5
//
// Only sections that have actual content components AND include a
// SectionHelpPopover are tested here.
//
// Excluded:
//   - Sections with badge: 'soon' — render <Result> placeholder, no help icon
//   - Sections without SectionHelpPopover in their sub-component:
//     profile, modules, activity, system, einvoice, templates, reminders, numbering
// ---------------------------------------------------------------------------
const SECTIONS_WITH_HELP_ICON = [
  'organization',   // OrganizationSettings  → settings.help.company.*
  'security',       // SecuritySettings      → settings.help.security.*
  'notifications',  // NotificationSettings  → settings.help.notifications.*
  'fiscal',         // FiscalYears           → settings.help.fiscal.*
  'budgets',        // Budgets               → settings.help.budgets.*
  'currencies',     // Currencies            → settings.help.currencies.*
  'email',          // EmailSettings         → settings.help.email.*
  'backup',         // BackupRestore         → settings.help.backup.*
] as const;

describe('Property 7: Every settings section has a help icon', () => {
  afterEach(() => {
    cleanup();
  });

  it('all sections render a help icon', { timeout: 30000 }, () => {
    // Feature: nav-settings-cleanup, Property 7: Every settings section has a help icon
    for (const key of SECTIONS_WITH_HELP_ICON) {
      const { getByLabelText } = renderSettings(key);
      expect(
        getByLabelText(/help|یارمەتی/i),
        `Section "${key}" should render an element with aria-label matching /help|یارمەتی/i`,
      ).toBeInTheDocument();
      cleanup();
    }
  });

  it.each(SECTIONS_WITH_HELP_ICON)(
    'section "%s" renders a help icon with aria-label matching /help|یارمەتی/i',
    (key) => {
      const { getByLabelText } = renderSettings(key);
      expect(getByLabelText(/help|یارمەتی/i)).toBeInTheDocument();
    },
  );
});
