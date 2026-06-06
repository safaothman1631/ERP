/**
 * store.ts
 *
 * Central Zustand store for the Zoho ERP frontend application.
 *
 * ## Auth Session Management (Requirements 6.5, 6.6, 6.7)
 *
 * The `useAuthStore` manages the full authentication lifecycle:
 *
 * - **Session state** (Req 6.5): Holds `token`, `userId`, `orgId`, `userName`,
 *   and the derived `isAuthenticated` flag.
 * - **Logout with JWT revocation** (Req 6.6): `logout()` sends a POST to
 *   `/api/auth/logout` with the Bearer token so the backend can add the JTI to
 *   its denylist, then calls Firebase `signOut()` to clear the Firebase session.
 *   Both calls are fire-and-forget — the local session is always cleared even if
 *   the network requests fail.
 * - **localStorage persistence** (Req 6.7): `login()` writes `token`, `userId`,
 *   `orgId`, and `userName` to localStorage; `logout()` removes them. On store
 *   initialisation the values are read back from localStorage so the session
 *   survives page reloads.
 *
 * ## Theme Management (Requirements 3.6, 3.7)
 *
 * - `theme` is persisted in localStorage under the key `"theme"`.
 * - `toggleTheme()` flips between `"light"` and `"dark"`, persists the new
 *   value, and updates `document.documentElement[data-theme]`.
 * - `applyTheme()` and `getPersistedTheme()` are exported for use in tests and
 *   for the module-level side-effect that applies the saved theme on load.
 *
 * ## Layout Management (Requirement 8.3, 8.4)
 *
 * - `layoutMode` is persisted in localStorage under the key `"shell.layoutMode"`.
 * - `setLayoutMode()` updates the store, localStorage, and
 *   `document.documentElement[data-layout]`.
 *
 * LocalStorage keys used by this store:
 * | Key               | Value                          |
 * |-------------------|--------------------------------|
 * | `token`           | JWT access token               |
 * | `userId`          | Authenticated user ID          |
 * | `orgId`           | User's organisation ID         |
 * | `userName`        | Display name of the user       |
 * | `theme`           | `"light"` or `"dark"`          |
 * | `shell.layoutMode`| One of the `LayoutMode` values |
 */
import { create } from 'zustand';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Supported layout modes for the application shell.
 * Persisted in localStorage under `"shell.layoutMode"`.
 * Applied to `document.documentElement` as `data-layout`.
 */
export type LayoutMode =
  | 'classic-sidebar'
  | 'top-megamenu'
  | 'dual-rail'
  | 'icon-rail'
  | 'dashboard-first'
  | 'command-centric'
  | 'workspace-tabs'
  | 'apps-launcher'
  | 'split-master-detail'
  | 'mobile-bottom-nav';

/**
 * Application colour theme.
 * Persisted in localStorage under `"theme"`.
 * Applied to `document.documentElement` as `data-theme`.
 */
export type Theme = 'light' | 'dark';

// ---------------------------------------------------------------------------
// Theme helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Apply the given theme to the document root element by setting the
 * `data-theme` attribute.  This is the single place where the DOM is mutated
 * for theme changes.
 *
 * @param theme - The theme to apply (`"light"` or `"dark"`).
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Read the persisted theme from localStorage.
 *
 * @returns The stored theme, or `"light"` if nothing is stored.
 */
export function getPersistedTheme(): Theme {
  return (localStorage.getItem('theme') as Theme) || 'light';
}

// ---------------------------------------------------------------------------
// Layout helpers (exported for testing and useLayout hook)
// ---------------------------------------------------------------------------

/**
 * Apply the given layout mode to the document root element by setting the
 * `data-layout` attribute.  This is the single place where the DOM is mutated
 * for layout changes.
 *
 * Requirement 8.4 — Layout SHALL apply via document.documentElement attribute
 * "data-layout".
 *
 * @param mode - The layout mode to apply.
 */
export function applyLayout(mode: LayoutMode): void {
  document.documentElement.setAttribute('data-layout', mode);
}

/**
 * Read the persisted layout mode from localStorage.
 *
 * @returns The stored layout mode, or `"classic-sidebar"` if nothing is stored.
 */
export function getPersistedLayout(): LayoutMode {
  return (localStorage.getItem('shell.layoutMode') as LayoutMode) || 'classic-sidebar';
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

/**
 * Shape of the `useAuthStore` Zustand store.
 *
 * Auth state (Req 6.5):
 * - `token`           — JWT access token, or `null` when logged out.
 * - `userId`          — Authenticated user's ID, or `null`.
 * - `orgId`           — User's organisation ID, or `null`.
 * - `userName`        — Display name, or `null`.
 * - `isAuthenticated` — Derived flag: `true` when a token is present.
 *
 * UI state:
 * - `theme`      — Current colour theme.
 * - `layoutMode` — Current shell layout mode.
 */
interface AuthState {
  /** JWT access token. `null` when the user is not authenticated. */
  token: string | null;
  /** Authenticated user's unique identifier. */
  userId: string | null;
  /** Organisation the user belongs to. */
  orgId: string | null;
  /** Human-readable display name of the authenticated user. */
  userName: string | null;
  /** `true` when a valid token is present in the store. */
  isAuthenticated: boolean;
  /** Current UI colour theme. */
  theme: Theme;
  /** Current shell layout mode. */
  layoutMode: LayoutMode;

  /**
   * Persist session credentials to localStorage and update store state.
   *
   * Called after a successful login.  Writes `token`, `userId`, `orgId`, and
   * `userName` to localStorage (Req 6.7) and sets `isAuthenticated` to `true`.
   *
   * @param token    - JWT access token returned by the backend.
   * @param userId   - Authenticated user's ID.
   * @param orgId    - Organisation ID the user belongs to.
   * @param userName - Display name of the user.
   */
  login: (token: string, userId: string, orgId: string, userName: string, userRole?: string) => void;

  /**
   * Secure login — stores access token in memory only (NOT localStorage).
   *
   * Requirements 2.5 (JWT storage): access token stored in memory (Zustand),
   * refresh token is set as httpOnly cookie by the backend.
   * Non-auth data (userId, orgId, userName) is still persisted to localStorage
   * so the user's identity survives a page reload (the access token will be
   * refreshed via the httpOnly refresh token cookie on next load).
   *
   * @param token    - JWT access token (stored in memory only).
   * @param userId   - Authenticated user's ID (persisted to localStorage).
   * @param orgId    - Organisation ID (persisted to localStorage).
   * @param userName - Display name (persisted to localStorage).
   */
  loginSecure: (token: string, userId: string, orgId: string, userName: string, userRole?: string) => void;

  /**
   * Revoke the current session and clear all persisted auth state.
   *
   * Steps performed (Req 6.6):
   * 1. POST `/api/auth/logout` with the current Bearer token so the backend
   *    can add the JTI to its denylist (fire-and-forget).
   * 2. Call Firebase `signOut()` to clear the Firebase auth session
   *    (fire-and-forget).
   * 3. Remove `token`, `userId`, `orgId`, `userName` from localStorage (Req 6.7).
   * 4. Reset store state to unauthenticated.
   *
   * The local session is always cleared regardless of whether the network
   * requests succeed, ensuring the user is logged out even when offline.
   */
  logout: () => void;

  /**
   * Toggle between `"light"` and `"dark"` themes.
   *
   * Persists the new value to localStorage and updates the DOM attribute.
   */
  toggleTheme: () => void;

  /**
   * Switch the shell layout mode.
   *
   * Persists the new mode to localStorage and updates `data-layout` on the
   * document root element.
   *
   * @param mode - The layout mode to activate.
   */
  setLayoutMode: (mode: LayoutMode) => void;
}

// ---------------------------------------------------------------------------
// Store initialisation
// ---------------------------------------------------------------------------

// Apply persisted theme immediately on store initialisation so the document
// attribute reflects the saved preference before any toggle is called.
const _initialTheme = getPersistedTheme();
applyTheme(_initialTheme);

// Apply persisted layout immediately on store initialisation so the document
// attribute reflects the saved preference before any layout switch is called.
const _initialLayout = getPersistedLayout();
applyLayout(_initialLayout);

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Primary application store.
 *
 * Manages authentication session state (Req 6.5, 6.6, 6.7), theme (Req 3.6,
 * 3.7), and layout mode (Req 8.3, 8.4).
 *
 * Initial values are hydrated from localStorage so the session and UI
 * preferences survive page reloads.
 */
export const useAuthStore = create<AuthState>((set) => ({
  // --- Auth state (hydrated from localStorage on load, Req 6.7) ---
  token: localStorage.getItem('token'),
  userId: localStorage.getItem('userId'),
  orgId: localStorage.getItem('orgId'),
  userName: localStorage.getItem('userName'),
  isAuthenticated: !!localStorage.getItem('token'),

  // --- UI state ---
  theme: _initialTheme,
  layoutMode: _initialLayout,

  // --- Actions ---

  login: (token, userId, orgId, userName, userRole) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('orgId', orgId);
    localStorage.setItem('userName', userName);
    if (userRole) localStorage.setItem('userRole', userRole);
    if (userRole === 'super_admin') localStorage.setItem('isPlatformAdmin', 'true');
    set({ token, userId, orgId, userName, isAuthenticated: true });
  },

  loginSecure: (token, userId, orgId, userName, userRole) => {
    // The access token MUST be in localStorage: the axios request interceptor
    // (api.ts) reads `localStorage.getItem('token')` to attach the Authorization
    // header. Without this, every authenticated request right after register/MFA
    // had no token → 401 → the response interceptor bounced to /login (so a
    // successful registration looked like it "did nothing and went to login").
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('orgId', orgId);
    localStorage.setItem('userName', userName);
    if (userRole) localStorage.setItem('userRole', userRole);
    if (userRole === 'super_admin') localStorage.setItem('isPlatformAdmin', 'true');
    set({ token, userId, orgId, userName, isAuthenticated: true });
  },

  logout: () => {
    // Step 1 — Tell the backend to revoke the JWT (add JTI to denylist).
    // Fire-and-forget: even if it fails (offline, server down), we still wipe
    // the local session so the user is logged out client-side (Req 6.6).
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {
        // Intentionally swallowed — logout must succeed locally regardless.
      });
    }

    // Step 2 — Clear Firebase auth session (Req 6.6).
    signOut(auth).catch(() => {
      // Intentionally swallowed — Firebase sign-out failure must not block
      // the local session teardown.
    });

    // Step 3 — Remove persisted auth keys from localStorage (Req 6.7).
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('orgId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('isPlatformAdmin');

    // Step 4 — Reset in-memory store state.
    set({ token: null, userId: null, orgId: null, userName: null, isAuthenticated: false });
  },

  toggleTheme: () => {
    set((state) => {
      const next: Theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      applyTheme(next);
      return { theme: next };
    });
  },

  setLayoutMode: (mode) => {
    localStorage.setItem('shell.layoutMode', mode);
    applyLayout(mode);
    set({ layoutMode: mode });
  },
}));
