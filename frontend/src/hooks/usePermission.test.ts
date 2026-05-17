/**
 * usePermission.test.ts
 *
 * Unit tests for the usePermission hook.
 *
 * Tests verify:
 * - Admin role grants settings access (Requirement 12.4)
 * - Owner role grants settings access (Requirement 12.4)
 * - Non-admin roles are denied settings access (Requirement 12.4)
 * - Unauthenticated users are denied settings access
 * - Role extraction from JWT token works correctly
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ---------------------------------------------------------------------------
// We need to control what useAuthStore returns and what localStorage contains.
// ---------------------------------------------------------------------------

// Helper: create a minimal base64url-encoded JWT with a given role claim.
function makeJwt(role: string | undefined): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const payload = btoa(JSON.stringify({ sub: 'user-1', org_id: 'org-1', role }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const sig = 'fakesig';
  return `${header}.${payload}.${sig}`;
}

// ---------------------------------------------------------------------------
// Mock the auth store
// ---------------------------------------------------------------------------
const mockAuthState = {
  token: null as string | null,
  userId: 'user-1' as string | null,
  orgId: 'org-1' as string | null,
  userName: 'Test User' as string | null,
  isAuthenticated: true,
  theme: 'light' as const,
  layoutMode: 'classic-sidebar' as const,
  login: vi.fn(),
  logout: vi.fn(),
  toggleTheme: vi.fn(),
  setLayoutMode: vi.fn(),
};

vi.mock('../store', () => ({
  useAuthStore: vi.fn((selector?: (s: typeof mockAuthState) => unknown) => {
    if (typeof selector === 'function') return selector(mockAuthState);
    return mockAuthState;
  }),
}));

// Import after mocks
import { usePermission, SETTINGS_ALLOWED_ROLES } from './usePermission';

describe('usePermission', () => {
  beforeEach(() => {
    localStorage.clear();
    mockAuthState.isAuthenticated = true;
    mockAuthState.token = null;
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ── SETTINGS_ALLOWED_ROLES constant ──────────────────────────────────────

  it('SETTINGS_ALLOWED_ROLES includes admin and owner', () => {
    expect(SETTINGS_ALLOWED_ROLES).toContain('admin');
    expect(SETTINGS_ALLOWED_ROLES).toContain('owner');
  });

  // ── Admin role ────────────────────────────────────────────────────────────

  it('grants settings access for admin role (Req 12.4)', () => {
    localStorage.setItem('token', makeJwt('admin'));
    const { result } = renderHook(() => usePermission());
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isOwner).toBe(false);
    expect(result.current.hasSettingsAccess).toBe(true);
    expect(result.current.role).toBe('admin');
  });

  // ── Owner role ────────────────────────────────────────────────────────────

  it('grants settings access for owner role (Req 12.4)', () => {
    localStorage.setItem('token', makeJwt('owner'));
    const { result } = renderHook(() => usePermission());
    expect(result.current.isOwner).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.hasSettingsAccess).toBe(true);
    expect(result.current.role).toBe('owner');
  });

  // ── Non-privileged roles ──────────────────────────────────────────────────

  it('denies settings access for viewer role (Req 12.4)', () => {
    localStorage.setItem('token', makeJwt('viewer'));
    const { result } = renderHook(() => usePermission());
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isOwner).toBe(false);
    expect(result.current.hasSettingsAccess).toBe(false);
    expect(result.current.role).toBe('viewer');
  });

  it('denies settings access for accountant role (Req 12.4)', () => {
    localStorage.setItem('token', makeJwt('accountant'));
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasSettingsAccess).toBe(false);
  });

  it('denies settings access for sales role (Req 12.4)', () => {
    localStorage.setItem('token', makeJwt('sales'));
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasSettingsAccess).toBe(false);
  });

  // ── No token ──────────────────────────────────────────────────────────────

  it('returns null role when no token is in localStorage', () => {
    // No token set
    const { result } = renderHook(() => usePermission());
    expect(result.current.role).toBeNull();
  });

  it('denies settings access when not authenticated', () => {
    mockAuthState.isAuthenticated = false;
    localStorage.setItem('token', makeJwt('admin'));
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasSettingsAccess).toBe(false);
  });

  // ── Malformed token ───────────────────────────────────────────────────────

  it('returns null role for a malformed token', () => {
    localStorage.setItem('token', 'not.a.valid.jwt.at.all');
    const { result } = renderHook(() => usePermission());
    expect(result.current.role).toBeNull();
  });

  it('returns null role for a token with only one part', () => {
    localStorage.setItem('token', 'onlyonepart');
    const { result } = renderHook(() => usePermission());
    expect(result.current.role).toBeNull();
  });

  // ── Token without role claim ──────────────────────────────────────────────

  it('returns null role when JWT has no role claim', () => {
    localStorage.setItem('token', makeJwt(undefined));
    const { result } = renderHook(() => usePermission());
    expect(result.current.role).toBeNull();
    expect(result.current.hasSettingsAccess).toBe(false);
  });

  // ── isAuthenticated flag ──────────────────────────────────────────────────

  it('reflects isAuthenticated from the auth store', () => {
    mockAuthState.isAuthenticated = true;
    const { result } = renderHook(() => usePermission());
    expect(result.current.isAuthenticated).toBe(true);
  });
});
