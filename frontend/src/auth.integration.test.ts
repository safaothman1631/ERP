/**
 * auth.integration.test.ts
 *
 * Integration tests for the authentication system.
 *
 * Tests the full auth lifecycle as a cohesive system:
 *   1. Login/logout flow — store state + localStorage + JWT revocation call
 *   2. JWT validation and expiration — token structure and expiry behaviour
 *   3. Session persistence — localStorage hydration on simulated page reload
 *
 * Runner: Vitest (jsdom environment)
 *
 * Feature: settings-documentation
 * Requirements: 6.5, 6.6, 6.7
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset localStorage and module registry between tests. */
function resetEnv() {
  localStorage.clear();
  vi.resetModules();
}

// ---------------------------------------------------------------------------
// 1. Login / Logout Flow
//    Validates: Requirements 6.5, 6.6, 6.7
// ---------------------------------------------------------------------------

describe('Login / Logout flow — full pipeline (Req 6.5, 6.6, 6.7)', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('login() transitions isAuthenticated from false to true', async () => {
    const { useAuthStore } = await import('./store');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    useAuthStore.getState().login('tok-abc', 'user-1', 'org-1', 'Alice');

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('login() stores all four session fields in the store', async () => {
    const { useAuthStore } = await import('./store');

    useAuthStore.getState().login('tok-abc', 'user-1', 'org-1', 'Alice');

    const { token, userId, orgId, userName } = useAuthStore.getState();
    expect(token).toBe('tok-abc');
    expect(userId).toBe('user-1');
    expect(orgId).toBe('org-1');
    expect(userName).toBe('Alice');
  });

  it('login() persists all four session fields to localStorage (Req 6.7)', async () => {
    const { useAuthStore } = await import('./store');

    useAuthStore.getState().login('tok-persist', 'u-1', 'o-1', 'Bob');

    expect(localStorage.getItem('token')).toBe('tok-persist');
    expect(localStorage.getItem('userId')).toBe('u-1');
    expect(localStorage.getItem('orgId')).toBe('o-1');
    expect(localStorage.getItem('userName')).toBe('Bob');
  });

  it('logout() clears all session fields in the store', async () => {
    const { useAuthStore } = await import('./store');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

    useAuthStore.getState().login('tok-abc', 'user-1', 'org-1', 'Alice');
    useAuthStore.getState().logout();

    const { token, userId, orgId, userName, isAuthenticated } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(userId).toBeNull();
    expect(orgId).toBeNull();
    expect(userName).toBeNull();
    expect(isAuthenticated).toBe(false);

    vi.restoreAllMocks();
  });

  it('logout() removes all four session keys from localStorage (Req 6.7)', async () => {
    const { useAuthStore } = await import('./store');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

    useAuthStore.getState().login('tok-abc', 'user-1', 'org-1', 'Alice');
    useAuthStore.getState().logout();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('userId')).toBeNull();
    expect(localStorage.getItem('orgId')).toBeNull();
    expect(localStorage.getItem('userName')).toBeNull();

    vi.restoreAllMocks();
  });

  it('logout() calls POST /api/auth/logout with Bearer token (Req 6.6)', async () => {
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

  it('logout() does NOT call /api/auth/logout when no token is present (Req 6.6)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

    const { useAuthStore } = await import('./store');
    useAuthStore.getState().logout();

    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('logout() clears local session even when the revocation request fails (Req 6.6)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    localStorage.setItem('token', 'tok-fail');

    const { useAuthStore } = await import('./store');
    useAuthStore.getState().logout();

    // Local state must be cleared regardless of network failure
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();

    vi.restoreAllMocks();
  });

  it('full login → logout → login cycle restores authenticated state', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

    const { useAuthStore } = await import('./store');

    // First login
    useAuthStore.getState().login('tok-1', 'user-1', 'org-1', 'Alice');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // Logout
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    // Second login
    useAuthStore.getState().login('tok-2', 'user-2', 'org-2', 'Bob');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe('tok-2');
    expect(useAuthStore.getState().userName).toBe('Bob');

    fetchSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 2. JWT Validation and Expiration (frontend perspective)
//    Validates: Requirements 6.5, 6.7
//
//    The frontend does not decode JWTs itself — it stores the opaque token
//    string and sends it as a Bearer header. These tests verify that the
//    store correctly handles token presence/absence and that the token value
//    is faithfully preserved and cleared.
// ---------------------------------------------------------------------------

describe('JWT token handling in AuthStore (Req 6.5, 6.7)', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('stores the exact JWT string returned by the backend', async () => {
    const { useAuthStore } = await import('./store');

    // Simulate a realistic JWT-shaped string (header.payload.signature)
    const jwtToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
      '.eyJzdWIiOiJ1c2VyLTEiLCJvcmdfaWQiOiJvcmctMSIsImV4cCI6OTk5OTk5OTk5OX0' +
      '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    useAuthStore.getState().login(jwtToken, 'user-1', 'org-1', 'Alice');

    expect(useAuthStore.getState().token).toBe(jwtToken);
    expect(localStorage.getItem('token')).toBe(jwtToken);
  });

  it('isAuthenticated is true when a token string is present', async () => {
    const { useAuthStore } = await import('./store');

    useAuthStore.getState().login('any-token-string', 'user-1', 'org-1', 'Alice');

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('isAuthenticated is false when token is null (logged out)', async () => {
    const { useAuthStore } = await import('./store');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

    useAuthStore.getState().login('tok', 'user-1', 'org-1', 'Alice');
    useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();

    vi.restoreAllMocks();
  });

  it('isAuthenticated is false on fresh store with empty localStorage', async () => {
    // No token in localStorage — simulates first visit or post-logout reload
    const { useAuthStore } = await import('./store');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('logout() sends the exact stored token in the Authorization header', async () => {
    const specificToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1In0.sig';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

    localStorage.setItem('token', specificToken);
    const { useAuthStore } = await import('./store');
    useAuthStore.getState().logout();

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${specificToken}`,
        }),
      }),
    );

    fetchSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 3. Session Persistence — localStorage hydration on reload
//    Validates: Requirement 6.7
// ---------------------------------------------------------------------------

describe('Session persistence across simulated page reloads (Req 6.7)', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('hydrates token from localStorage on store initialisation', async () => {
    localStorage.setItem('token', 'tok-reload');
    localStorage.setItem('userId', 'u-reload');
    localStorage.setItem('orgId', 'o-reload');
    localStorage.setItem('userName', 'Dave');

    const { useAuthStore } = await import('./store');

    expect(useAuthStore.getState().token).toBe('tok-reload');
    expect(useAuthStore.getState().userId).toBe('u-reload');
    expect(useAuthStore.getState().orgId).toBe('o-reload');
    expect(useAuthStore.getState().userName).toBe('Dave');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('isAuthenticated is true after reload when token is in localStorage', async () => {
    localStorage.setItem('token', 'tok-persisted');

    const { useAuthStore } = await import('./store');

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('isAuthenticated is false after reload when localStorage has no token', async () => {
    // Ensure no token key exists
    localStorage.removeItem('token');

    const { useAuthStore } = await import('./store');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('session survives a login → reload sequence', async () => {
    // Step 1: login in "first session"
    const { useAuthStore: store1 } = await import('./store');
    store1.getState().login('tok-session', 'u-session', 'o-session', 'Eve');

    // Verify localStorage was written
    expect(localStorage.getItem('token')).toBe('tok-session');

    // Step 2: simulate reload by re-importing the module
    vi.resetModules();
    const { useAuthStore: store2 } = await import('./store');

    expect(store2.getState().token).toBe('tok-session');
    expect(store2.getState().userId).toBe('u-session');
    expect(store2.getState().orgId).toBe('o-session');
    expect(store2.getState().userName).toBe('Eve');
    expect(store2.getState().isAuthenticated).toBe(true);
  });

  it('session is gone after logout → reload sequence', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

    // Step 1: login then logout in "first session"
    const { useAuthStore: store1 } = await import('./store');
    store1.getState().login('tok-gone', 'u-gone', 'o-gone', 'Frank');
    store1.getState().logout();

    // Verify localStorage was cleared
    expect(localStorage.getItem('token')).toBeNull();

    // Step 2: simulate reload
    vi.resetModules();
    const { useAuthStore: store2 } = await import('./store');

    expect(store2.getState().token).toBeNull();
    expect(store2.getState().isAuthenticated).toBe(false);

    fetchSpy.mockRestore();
  });

  it('partial localStorage (only token) still sets isAuthenticated to true', async () => {
    // Edge case: only token key is present (other keys may have been cleared)
    localStorage.setItem('token', 'tok-partial');

    const { useAuthStore } = await import('./store');

    // isAuthenticated is derived from token presence
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe('tok-partial');
    // Other fields default to null
    expect(useAuthStore.getState().userId).toBeNull();
    expect(useAuthStore.getState().orgId).toBeNull();
    expect(useAuthStore.getState().userName).toBeNull();
  });

  it('all four localStorage keys are written atomically on login', async () => {
    const { useAuthStore } = await import('./store');

    useAuthStore.getState().login('tok-atomic', 'u-atomic', 'o-atomic', 'Grace');

    // All four keys must be present immediately after login
    expect(localStorage.getItem('token')).toBe('tok-atomic');
    expect(localStorage.getItem('userId')).toBe('u-atomic');
    expect(localStorage.getItem('orgId')).toBe('o-atomic');
    expect(localStorage.getItem('userName')).toBe('Grace');
  });

  it('all four localStorage keys are removed atomically on logout', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

    const { useAuthStore } = await import('./store');
    useAuthStore.getState().login('tok-atomic', 'u-atomic', 'o-atomic', 'Grace');
    useAuthStore.getState().logout();

    // All four keys must be absent immediately after logout
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('userId')).toBeNull();
    expect(localStorage.getItem('orgId')).toBeNull();
    expect(localStorage.getItem('userName')).toBeNull();

    fetchSpy.mockRestore();
  });
});
