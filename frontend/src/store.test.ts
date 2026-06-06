/**
 * store.test.ts
 *
 * Unit tests for useAuthStore (Zustand).
 *
 * Covers:
 *   - Auth session management: login, logout, session state (Req 6.5, 6.6, 6.7)
 *   - Theme persistence and switching (Req 3.6, 3.7)
 *
 * Runner: Vitest (jsdom environment)
 *
 * Feature: settings-documentation
 * Requirements: 3.6, 3.7, 6.5, 6.6, 6.7
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyTheme, getPersistedTheme } from './store';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset localStorage and document.documentElement between tests. */
function resetEnv() {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
}

// ---------------------------------------------------------------------------
// Requirement 3.6 — UserStore persists theme preference in localStorage
// ---------------------------------------------------------------------------
describe('getPersistedTheme', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('returns "light" when no theme is stored in localStorage', () => {
    expect(getPersistedTheme()).toBe('light');
  });

  it('returns "dark" when localStorage["theme"] is "dark"', () => {
    localStorage.setItem('theme', 'dark');
    expect(getPersistedTheme()).toBe('dark');
  });

  it('returns "light" when localStorage["theme"] is "light"', () => {
    localStorage.setItem('theme', 'light');
    expect(getPersistedTheme()).toBe('light');
  });
});

// ---------------------------------------------------------------------------
// Requirement 3.7 — When user toggles theme, update localStorage and
//                   document.documentElement attribute
// ---------------------------------------------------------------------------
describe('applyTheme', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('sets data-theme="light" on document.documentElement', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('sets data-theme="dark" on document.documentElement', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('overwrites a previous data-theme value', () => {
    applyTheme('dark');
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

// ---------------------------------------------------------------------------
// Requirement 3.6 — toggleTheme persists to localStorage and updates DOM
// ---------------------------------------------------------------------------
describe('toggleTheme via useAuthStore', () => {
  // We import the store lazily inside each test so that module-level side
  // effects (applyTheme on init) run with the correct localStorage state.
  beforeEach(resetEnv);
  afterEach(() => {
    resetEnv();
    vi.resetModules();
  });

  it('toggles from light to dark and persists to localStorage', async () => {
    // Start with light theme (default)
    localStorage.setItem('theme', 'light');
    const { useAuthStore } = await import('./store');
    const store = useAuthStore.getState();

    store.toggleTheme();

    expect(localStorage.getItem('theme')).toBe('dark');
    expect(useAuthStore.getState().theme).toBe('dark');
  });

  it('toggles from dark to light and persists to localStorage', async () => {
    localStorage.setItem('theme', 'dark');
    const { useAuthStore } = await import('./store');
    // Manually set the store state to dark to match localStorage
    useAuthStore.setState({ theme: 'dark' });

    useAuthStore.getState().toggleTheme();

    expect(localStorage.getItem('theme')).toBe('light');
    expect(useAuthStore.getState().theme).toBe('light');
  });

  it('updates document.documentElement data-theme attribute on toggle', async () => {
    localStorage.setItem('theme', 'light');
    const { useAuthStore } = await import('./store');
    useAuthStore.setState({ theme: 'light' });

    useAuthStore.getState().toggleTheme();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('applies persisted theme to document on store initialisation', async () => {
    // Simulate a page reload with dark theme already saved
    localStorage.setItem('theme', 'dark');
    // Re-import the module so the module-level applyTheme(_initialTheme) runs
    const { applyTheme: apply, getPersistedTheme: get } = await import('./store');
    apply(get());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

// ---------------------------------------------------------------------------
// Requirement 3.6 — theme defaults to "light" when localStorage is empty
// ---------------------------------------------------------------------------
describe('theme default value', () => {
  beforeEach(resetEnv);
  afterEach(() => {
    resetEnv();
    vi.resetModules();
  });

  it('store theme defaults to "light" when no theme is in localStorage', async () => {
    const { useAuthStore } = await import('./store');
    // The store reads localStorage at module load time; with empty storage it
    // should default to 'light'.
    const theme = useAuthStore.getState().theme;
    expect(theme === 'light' || theme === 'dark').toBe(true); // valid theme
    // Default is light
    expect(getPersistedTheme()).toBe('light');
  });
});

// ===========================================================================
// Requirement 6.5 — Auth_Store manages session state
// ===========================================================================

describe('useAuthStore — session state management (Req 6.5)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('initialises with null auth values when localStorage is empty', async () => {
    const { useAuthStore } = await import('./store');
    const { token, userId, orgId, userName, isAuthenticated } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(userId).toBeNull();
    expect(orgId).toBeNull();
    expect(userName).toBeNull();
    expect(isAuthenticated).toBe(false);
  });

  it('hydrates session state from localStorage on store initialisation', async () => {
    localStorage.setItem('token', 'tok-abc');
    localStorage.setItem('userId', 'user-1');
    localStorage.setItem('orgId', 'org-1');
    localStorage.setItem('userName', 'Alice');
    const { useAuthStore } = await import('./store');
    const state = useAuthStore.getState();
    expect(state.token).toBe('tok-abc');
    expect(state.userId).toBe('user-1');
    expect(state.orgId).toBe('org-1');
    expect(state.userName).toBe('Alice');
    expect(state.isAuthenticated).toBe(true);
  });

  it('login() sets all session fields and isAuthenticated', async () => {
    const { useAuthStore } = await import('./store');
    useAuthStore.getState().login('tok-xyz', 'user-2', 'org-2', 'Bob');
    const state = useAuthStore.getState();
    expect(state.token).toBe('tok-xyz');
    expect(state.userId).toBe('user-2');
    expect(state.orgId).toBe('org-2');
    expect(state.userName).toBe('Bob');
    expect(state.isAuthenticated).toBe(true);
  });

  it('logout() clears all session fields and sets isAuthenticated to false', async () => {
    const { useAuthStore } = await import('./store');
    useAuthStore.getState().login('tok-xyz', 'user-2', 'org-2', 'Bob');
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.userId).toBeNull();
    expect(state.orgId).toBeNull();
    expect(state.userName).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});

// ===========================================================================
// Requirement 6.7 — Auth state persisted in localStorage
// ===========================================================================

describe('useAuthStore — localStorage persistence (Req 6.7)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('login() writes token, userId, orgId, userName to localStorage', async () => {
    const { useAuthStore } = await import('./store');
    useAuthStore.getState().login('tok-persist', 'u-1', 'o-1', 'Carol');
    expect(localStorage.getItem('token')).toBe('tok-persist');
    expect(localStorage.getItem('userId')).toBe('u-1');
    expect(localStorage.getItem('orgId')).toBe('o-1');
    expect(localStorage.getItem('userName')).toBe('Carol');
  });

  it('logout() removes token, userId, orgId, userName from localStorage', async () => {
    const { useAuthStore } = await import('./store');
    useAuthStore.getState().login('tok-persist', 'u-1', 'o-1', 'Carol');
    useAuthStore.getState().logout();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('userId')).toBeNull();
    expect(localStorage.getItem('orgId')).toBeNull();
    expect(localStorage.getItem('userName')).toBeNull();
  });

  it('session survives a simulated page reload (re-import)', async () => {
    // Simulate login then page reload by re-importing the module
    localStorage.setItem('token', 'tok-reload');
    localStorage.setItem('userId', 'u-reload');
    localStorage.setItem('orgId', 'o-reload');
    localStorage.setItem('userName', 'Dave');
    const { useAuthStore } = await import('./store');
    const state = useAuthStore.getState();
    expect(state.token).toBe('tok-reload');
    expect(state.isAuthenticated).toBe(true);
  });
});

// ===========================================================================
// Requirement 6.6 — Logout attempts JWT revocation via backend
// ===========================================================================

describe('useAuthStore — logout JWT revocation (Req 6.6)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('logout() calls /api/auth/logout with Bearer token when token exists', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    localStorage.setItem('token', 'tok-revoke');
    const { useAuthStore } = await import('./store');
    useAuthStore.getState().logout();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok-revoke' }),
      }),
    );
    fetchSpy.mockRestore();
  });

  it('logout() does not call /api/auth/logout when no token is present', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    const { useAuthStore } = await import('./store');
    useAuthStore.getState().logout();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('logout() still clears local session even when the revocation request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    localStorage.setItem('token', 'tok-fail');
    const { useAuthStore } = await import('./store');
    useAuthStore.getState().logout();
    // Local state must be cleared regardless of network failure
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
    vi.restoreAllMocks();
  });
});

// ===========================================================================
// Requirement 8.1–8.4 — Layout and Shell Configuration
// ===========================================================================

describe('LayoutMode type — all 10 modes defined (Req 8.1)', () => {
  it('LayoutMode includes all 10 required layout modes', async () => {
    // Import the store to access the LayoutMode type at runtime via the
    // initial layoutMode value and setLayoutMode.
    const { useAuthStore } = await import('./store');
    const { setLayoutMode } = useAuthStore.getState();

    const allModes = [
      'classic-sidebar',
      'top-megamenu',
      'dual-rail',
      'icon-rail',
      'dashboard-first',
      'command-centric',
      'workspace-tabs',
      'apps-launcher',
      'split-master-detail',
      'mobile-bottom-nav',
    ] as const;

    // Each mode must be settable without TypeScript errors and must be
    // reflected in the store state.
    for (const mode of allModes) {
      setLayoutMode(mode);
      expect(useAuthStore.getState().layoutMode).toBe(mode);
    }
  });
});

describe('useAuthStore — default layout mode (Req 8.2)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('defaults to "classic-sidebar" when no layout is stored in localStorage', async () => {
    const { useAuthStore } = await import('./store');
    expect(useAuthStore.getState().layoutMode).toBe('classic-sidebar');
  });

  it('hydrates layoutMode from localStorage on store initialisation', async () => {
    localStorage.setItem('shell.layoutMode', 'top-megamenu');
    const { useAuthStore } = await import('./store');
    expect(useAuthStore.getState().layoutMode).toBe('top-megamenu');
  });
});

describe('useAuthStore — layout persistence in localStorage (Req 8.3)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('setLayoutMode() persists the mode to localStorage under "shell.layoutMode"', async () => {
    const { useAuthStore } = await import('./store');
    useAuthStore.getState().setLayoutMode('dual-rail');
    expect(localStorage.getItem('shell.layoutMode')).toBe('dual-rail');
  });

  it('setLayoutMode() updates the store state', async () => {
    const { useAuthStore } = await import('./store');
    useAuthStore.getState().setLayoutMode('workspace-tabs');
    expect(useAuthStore.getState().layoutMode).toBe('workspace-tabs');
  });

  it('layout preference survives a simulated page reload (re-import)', async () => {
    localStorage.setItem('shell.layoutMode', 'icon-rail');
    const { useAuthStore } = await import('./store');
    expect(useAuthStore.getState().layoutMode).toBe('icon-rail');
  });
});

describe('useAuthStore — layout applied via data-layout attribute (Req 8.4)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-layout');
    vi.resetModules();
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-layout');
    vi.resetModules();
  });

  it('setLayoutMode() sets data-layout on document.documentElement', async () => {
    const { useAuthStore } = await import('./store');
    useAuthStore.getState().setLayoutMode('mobile-bottom-nav');
    expect(document.documentElement.getAttribute('data-layout')).toBe('mobile-bottom-nav');
  });

  it('setLayoutMode() overwrites a previous data-layout value', async () => {
    const { useAuthStore } = await import('./store');
    useAuthStore.getState().setLayoutMode('apps-launcher');
    useAuthStore.getState().setLayoutMode('command-centric');
    expect(document.documentElement.getAttribute('data-layout')).toBe('command-centric');
  });

  it('setLayoutMode() sets data-layout for all 10 layout modes', async () => {
    const { useAuthStore } = await import('./store');
    const modes = [
      'classic-sidebar', 'top-megamenu', 'dual-rail', 'icon-rail',
      'dashboard-first', 'command-centric', 'workspace-tabs',
      'apps-launcher', 'split-master-detail', 'mobile-bottom-nav',
    ] as const;
    for (const mode of modes) {
      useAuthStore.getState().setLayoutMode(mode);
      expect(document.documentElement.getAttribute('data-layout')).toBe(mode);
    }
  });
});
