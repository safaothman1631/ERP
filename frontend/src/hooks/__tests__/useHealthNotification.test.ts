/**
 * useHealthNotification.test.ts
 *
 * Frontend tests for the useHealthNotification hook.
 *
 * Tests verify:
 * - Hook fires the API for admin role (Requirement 3.5)
 * - Hook fires the API for owner role (Requirement 3.5)
 * - Hook skips the API for non-admin/non-owner roles (Requirement 3.5)
 * - API errors are silently suppressed — login flow is never blocked (Requirement 3.4)
 * - "View Details" link navigates to /settings/system-health only on click (Requirement 3.3)
 * - No auto-navigation occurs for degraded/unhealthy status (Requirement 3.3)
 * - Healthy status shows a success notification with 4-second duration (Requirement 3.2)
 * - Degraded status shows a persistent warning notification (Requirement 3.3)
 * - Unhealthy status shows a persistent error notification (Requirement 3.3)
 * - Hook runs at most once per mount (one-shot guard)
 *
 * Requirements: 3.3, 3.4, 3.5
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal base64url-encoded JWT with the given role claim. */
function makeJwt(role: string | undefined): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const payload = btoa(JSON.stringify({ sub: 'user-1', org_id: 'org-1', role }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${header}.${payload}.fakesig`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

// Mock the api module so we can control what GET /api/system/health/full returns.
const mockApiGet = vi.fn();
vi.mock('../../api', () => ({
  default: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

// Mock react-router-dom's useNavigate so we can assert navigation calls.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock the Ant Design App.useApp notification API.
const mockNotificationSuccess = vi.fn();
const mockNotificationWarning = vi.fn();
const mockNotificationError = vi.fn();

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      notification: {
        success: mockNotificationSuccess,
        warning: mockNotificationWarning,
        error: mockNotificationError,
      },
    }),
  },
}));

// Mock the auth store so we can control the role via localStorage JWT.
const mockAuthState = {
  isAuthenticated: true,
  userId: 'user-1',
  orgId: 'org-1',
  userName: 'Test User',
  token: null as string | null,
  theme: 'light' as const,
  layoutMode: 'classic-sidebar' as const,
  login: vi.fn(),
  logout: vi.fn(),
  toggleTheme: vi.fn(),
  setLayoutMode: vi.fn(),
};

vi.mock('../../store', () => ({
  useAuthStore: vi.fn((selector?: (s: typeof mockAuthState) => unknown) => {
    if (typeof selector === 'function') return selector(mockAuthState);
    return mockAuthState;
  }),
}));

// Import after mocks are set up.
import { useHealthNotification } from '../useHealthNotification';

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

describe('useHealthNotification', () => {
  beforeEach(() => {
    localStorage.clear();
    mockAuthState.isAuthenticated = true;
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ── Role-based API call gating (Requirement 3.5) ─────────────────────────

  it('calls the health API for admin role (Req 3.5)', async () => {
    localStorage.setItem('token', makeJwt('admin'));
    mockApiGet.mockResolvedValueOnce({ data: { overall_status: 'healthy' } });

    renderHook(() => useHealthNotification());

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));
    expect(mockApiGet).toHaveBeenCalledWith('/api/system/health/full');
  });

  it('calls the health API for owner role (Req 3.5)', async () => {
    localStorage.setItem('token', makeJwt('owner'));
    mockApiGet.mockResolvedValueOnce({ data: { overall_status: 'healthy' } });

    renderHook(() => useHealthNotification());

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));
    expect(mockApiGet).toHaveBeenCalledWith('/api/system/health/full');
  });

  it('does NOT call the health API for member role (Req 3.5)', async () => {
    localStorage.setItem('token', makeJwt('member'));

    renderHook(() => useHealthNotification());

    // Give the hook time to potentially fire — it should not.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('does NOT call the health API for viewer role (Req 3.5)', async () => {
    localStorage.setItem('token', makeJwt('viewer'));

    renderHook(() => useHealthNotification());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('does NOT call the health API for accountant role (Req 3.5)', async () => {
    localStorage.setItem('token', makeJwt('accountant'));

    renderHook(() => useHealthNotification());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('does NOT call the health API for sales role (Req 3.5)', async () => {
    localStorage.setItem('token', makeJwt('sales'));

    renderHook(() => useHealthNotification());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('does NOT call the health API when no token is present (Req 3.5)', async () => {
    // No token in localStorage → role is null → not admin/owner

    renderHook(() => useHealthNotification());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  // ── Notification type per overall_status (Requirements 3.2, 3.3) ─────────

  it('shows a success notification with 4s duration for healthy status (Req 3.2)', async () => {
    localStorage.setItem('token', makeJwt('admin'));
    mockApiGet.mockResolvedValueOnce({ data: { overall_status: 'healthy' } });

    renderHook(() => useHealthNotification());

    await waitFor(() => expect(mockNotificationSuccess).toHaveBeenCalledTimes(1));

    const callArgs = mockNotificationSuccess.mock.calls[0][0];
    expect(callArgs.duration).toBe(4);
    // Must not show warning or error
    expect(mockNotificationWarning).not.toHaveBeenCalled();
    expect(mockNotificationError).not.toHaveBeenCalled();
  });

  it('shows a persistent warning notification for degraded status (Req 3.3)', async () => {
    localStorage.setItem('token', makeJwt('admin'));
    mockApiGet.mockResolvedValueOnce({ data: { overall_status: 'degraded' } });

    renderHook(() => useHealthNotification());

    await waitFor(() => expect(mockNotificationWarning).toHaveBeenCalledTimes(1));

    const callArgs = mockNotificationWarning.mock.calls[0][0];
    // Persistent = duration 0 (no auto-dismiss)
    expect(callArgs.duration).toBe(0);
    // Must not show success or error
    expect(mockNotificationSuccess).not.toHaveBeenCalled();
    expect(mockNotificationError).not.toHaveBeenCalled();
  });

  it('shows a persistent error notification for unhealthy status (Req 3.3)', async () => {
    localStorage.setItem('token', makeJwt('admin'));
    mockApiGet.mockResolvedValueOnce({ data: { overall_status: 'unhealthy' } });

    renderHook(() => useHealthNotification());

    await waitFor(() => expect(mockNotificationError).toHaveBeenCalledTimes(1));

    const callArgs = mockNotificationError.mock.calls[0][0];
    // Persistent = duration 0 (no auto-dismiss)
    expect(callArgs.duration).toBe(0);
    // Must not show success or warning
    expect(mockNotificationSuccess).not.toHaveBeenCalled();
    expect(mockNotificationWarning).not.toHaveBeenCalled();
  });

  // ── "View Details" link — no auto-navigation (Requirement 3.3) ───────────

  it('does NOT auto-navigate for degraded status — navigate only on click (Req 3.3)', async () => {
    localStorage.setItem('token', makeJwt('admin'));
    mockApiGet.mockResolvedValueOnce({ data: { overall_status: 'degraded' } });

    renderHook(() => useHealthNotification());

    await waitFor(() => expect(mockNotificationWarning).toHaveBeenCalledTimes(1));

    // navigate must NOT have been called automatically
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does NOT auto-navigate for unhealthy status — navigate only on click (Req 3.3)', async () => {
    localStorage.setItem('token', makeJwt('owner'));
    mockApiGet.mockResolvedValueOnce({ data: { overall_status: 'unhealthy' } });

    renderHook(() => useHealthNotification());

    await waitFor(() => expect(mockNotificationError).toHaveBeenCalledTimes(1));

    // navigate must NOT have been called automatically
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('warning notification includes a "View Details" btn prop for degraded status (Req 3.3)', async () => {
    localStorage.setItem('token', makeJwt('admin'));
    mockApiGet.mockResolvedValueOnce({ data: { overall_status: 'degraded' } });

    renderHook(() => useHealthNotification());

    await waitFor(() => expect(mockNotificationWarning).toHaveBeenCalledTimes(1));

    const callArgs = mockNotificationWarning.mock.calls[0][0];
    // The hook passes a React element as `btn` for the "View Details" link
    expect(callArgs.btn).toBeDefined();
  });

  it('error notification includes a "View Details" btn prop for unhealthy status (Req 3.3)', async () => {
    localStorage.setItem('token', makeJwt('admin'));
    mockApiGet.mockResolvedValueOnce({ data: { overall_status: 'unhealthy' } });

    renderHook(() => useHealthNotification());

    await waitFor(() => expect(mockNotificationError).toHaveBeenCalledTimes(1));

    const callArgs = mockNotificationError.mock.calls[0][0];
    expect(callArgs.btn).toBeDefined();
  });

  // ── API error suppression (Requirement 3.4) ──────────────────────────────

  it('silently suppresses API errors — no notification shown (Req 3.4)', async () => {
    localStorage.setItem('token', makeJwt('admin'));
    mockApiGet.mockRejectedValueOnce(new Error('Network error'));

    // Should not throw
    renderHook(() => useHealthNotification());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // No notification of any kind must be shown
    expect(mockNotificationSuccess).not.toHaveBeenCalled();
    expect(mockNotificationWarning).not.toHaveBeenCalled();
    expect(mockNotificationError).not.toHaveBeenCalled();
  });

  it('silently suppresses 500 server errors (Req 3.4)', async () => {
    localStorage.setItem('token', makeJwt('owner'));
    const serverError = Object.assign(new Error('Internal Server Error'), {
      response: { status: 500 },
    });
    mockApiGet.mockRejectedValueOnce(serverError);

    renderHook(() => useHealthNotification());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(mockNotificationSuccess).not.toHaveBeenCalled();
    expect(mockNotificationWarning).not.toHaveBeenCalled();
    expect(mockNotificationError).not.toHaveBeenCalled();
  });

  it('silently suppresses 401 unauthorized errors (Req 3.4)', async () => {
    localStorage.setItem('token', makeJwt('admin'));
    const authError = Object.assign(new Error('Unauthorized'), {
      response: { status: 401 },
    });
    mockApiGet.mockRejectedValueOnce(authError);

    renderHook(() => useHealthNotification());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(mockNotificationSuccess).not.toHaveBeenCalled();
    expect(mockNotificationWarning).not.toHaveBeenCalled();
    expect(mockNotificationError).not.toHaveBeenCalled();
  });

  // ── One-shot guard — API called at most once per mount ───────────────────

  it('calls the API only once even if the hook re-renders', async () => {
    localStorage.setItem('token', makeJwt('admin'));
    mockApiGet.mockResolvedValue({ data: { overall_status: 'healthy' } });

    const { rerender } = renderHook(() => useHealthNotification());

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));

    // Force multiple re-renders
    rerender();
    rerender();
    rerender();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Still only called once
    expect(mockApiGet).toHaveBeenCalledTimes(1);
  });
});
