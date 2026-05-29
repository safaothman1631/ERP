/**
 * SystemHealthPage.test.tsx
 *
 * Frontend tests for SystemHealthPage and its sub-components.
 *
 * Covers:
 *   - Component cards render for each of 8 components (Req 2.3)
 *   - Banner color matches overall_status (Req 2.4, 2.5, 2.6, 2.7)
 *   - Recommendations section visible when non-empty (Req 2.8)
 *   - "Refresh" button triggers new API call with force=true (Req 2.9)
 *   - API failure path: error Alert renders, banner shows "Health check unavailable" (Req 2.10)
 *   - RTL layout direction applied (Req 2.12)
 *
 * Requirements: 2.2, 2.3, 2.4, 2.9, 2.10, 2.12
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';

// ---------------------------------------------------------------------------
// Polyfills required by Ant Design in jsdom
// ---------------------------------------------------------------------------

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
// Mock heavy / side-effectful modules
// ---------------------------------------------------------------------------

vi.mock('../../../firebase', () => ({
  default: {},
  auth: { currentUser: null, onAuthStateChanged: vi.fn(() => () => {}) },
  db: {},
  googleProvider: {},
  analytics: null,
}));

// Mock the api module — we control responses per test via mockResolvedValue
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock('../../../api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

vi.mock('../../../utils/message', () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
  },
  setMessageInstance: vi.fn(),
}));

// Mock usePermission — default to admin access; individual tests can override
const mockHasSettingsAccess = { value: true };

vi.mock('../../../hooks/usePermission', () => ({
  usePermission: () => ({
    role: 'admin',
    isAdmin: true,
    isOwner: false,
    hasSettingsAccess: mockHasSettingsAccess.value,
    isAuthenticated: true,
  }),
  SETTINGS_ALLOWED_ROLES: ['admin', 'owner'],
}));

// Mock store
vi.mock('../../../store', () => {
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

// ---------------------------------------------------------------------------
// Import components after mocks
// ---------------------------------------------------------------------------
import SystemHealthPage, {
  OverallStatusBanner,
  ComponentCard,
  RecommendationsPanel,
  LastCheckedTimestamp,
  type FullHealthReport,
  type HealthCheckResult,
} from '../SystemHealthPage';

// ---------------------------------------------------------------------------
// i18n test instance
// ---------------------------------------------------------------------------
const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        'system_health.title': 'System Health',
        'system_health.refresh': 'Refresh',
        'system_health.unavailable': 'Health check unavailable',
        'system_health.unavailable_desc': 'Unable to retrieve system health data. Please retry.',
        'system_health.status_healthy': 'All Systems Operational',
        'system_health.status_degraded': 'System Degraded',
        'system_health.status_unhealthy': 'System Unhealthy',
        'system_health.recommendations': 'Recommendations',
        'system_health.last_checked': 'Last checked',
        'system_health.error_title': 'Health check failed',
        'system_health.error_desc': 'Could not load system health data. Please try again.',
        'system_health.retry': 'Retry',
        'system_health.response_time': 'Response time',
        'backup.history_title': 'Backup History',
        'backup.run_now': 'Run Backup Now',
        'backup.no_records': 'No backup records found',
        'backup.col_datetime': 'Date / Time',
        'backup.col_status': 'Status',
        'backup.col_integrity': 'Integrity',
        'backup.col_total_docs': 'Total Docs',
        'backup.col_file_size': 'File Size',
        'backup.col_storage_path': 'Storage Path',
        'backup.col_download': 'Download',
        'backup.download': 'Download',
        'backup.status_success': 'Success',
        'backup.status_failed': 'Failed',
        'backup.integrity_verified': 'Verified',
        'backup.integrity_failed': 'Failed',
        'backup.integrity_pending': 'Pending',
      },
    },
  },
  interpolation: { escapeValue: false },
});

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const COMPONENT_NAMES = [
  'firestore',
  'auth',
  'storage',
  'scheduler',
  'api',
  'memory',
  'cpu',
  'recent_errors',
] as const;

function makeComponentResult(
  component: string,
  status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy',
): HealthCheckResult {
  return {
    component,
    status,
    response_time_ms: 42.5,
    message: `${component} is ${status}`,
    checked_at: '2024-01-15T02:00:00Z',
  };
}

function makeHealthReport(
  overrides: Partial<FullHealthReport> = {},
): FullHealthReport {
  return {
    overall_status: 'healthy',
    checked_at: '2024-01-15T02:00:00Z',
    components: COMPONENT_NAMES.map((name) => makeComponentResult(name)),
    recommendations: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Override component-level retry settings — fail immediately in tests
        retry: false,
        // Disable refetch intervals in tests
        refetchInterval: false,
        staleTime: Infinity,
        // Disable garbage collection delay
        gcTime: 0,
      },
    },
  });
}

interface RenderOptions {
  dir?: 'ltr' | 'rtl';
}

function renderPage(options: RenderOptions = {}) {
  const queryClient = createQueryClient();
  const { dir = 'ltr' } = options;

  return render(
    <I18nextProvider i18n={testI18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/settings/system-health']}>
          <div dir={dir}>
            <SystemHealthPage />
          </div>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function renderBanner(
  status: 'healthy' | 'degraded' | 'unhealthy' | null,
  apiError = false,
) {
  return render(
    <I18nextProvider i18n={testI18n}>
      <OverallStatusBanner status={status} apiError={apiError} />
    </I18nextProvider>,
  );
}

function renderComponentCard(result: HealthCheckResult) {
  return render(
    <I18nextProvider i18n={testI18n}>
      <ComponentCard result={result} />
    </I18nextProvider>,
  );
}

function renderRecommendations(recommendations: string[]) {
  return render(
    <I18nextProvider i18n={testI18n}>
      <RecommendationsPanel recommendations={recommendations} />
    </I18nextProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests: OverallStatusBanner (Req 2.4, 2.5, 2.6, 2.7)
// ---------------------------------------------------------------------------

describe('OverallStatusBanner', () => {
  afterEach(cleanup);

  it('renders success alert for "healthy" status (Req 2.7)', () => {
    const { container } = renderBanner('healthy');
    // Ant Design Alert with type="success" gets the ant-alert-success class
    const alert = container.querySelector('.ant-alert-success');
    expect(alert).not.toBeNull();
    expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
  });

  it('renders warning alert for "degraded" status (Req 2.6)', () => {
    const { container } = renderBanner('degraded');
    const alert = container.querySelector('.ant-alert-warning');
    expect(alert).not.toBeNull();
    expect(screen.getByText('System Degraded')).toBeInTheDocument();
  });

  it('renders error alert for "unhealthy" status (Req 2.5)', () => {
    const { container } = renderBanner('unhealthy');
    const alert = container.querySelector('.ant-alert-error');
    expect(alert).not.toBeNull();
    expect(screen.getByText('System Unhealthy')).toBeInTheDocument();
  });

  it('renders error alert with "Health check unavailable" when apiError=true (Req 2.4)', () => {
    const { container } = renderBanner(null, true);
    const alert = container.querySelector('.ant-alert-error');
    expect(alert).not.toBeNull();
    expect(screen.getByText('Health check unavailable')).toBeInTheDocument();
  });

  it('renders error alert with "Health check unavailable" when status=null (Req 2.4)', () => {
    const { container } = renderBanner(null, false);
    const alert = container.querySelector('.ant-alert-error');
    expect(alert).not.toBeNull();
    expect(screen.getByText('Health check unavailable')).toBeInTheDocument();
  });

  it('overrides banner to error state when apiError=true regardless of status (Req 2.4)', () => {
    // Even if status is "healthy", apiError overrides to error state
    const { container } = renderBanner('healthy', true);
    const alert = container.querySelector('.ant-alert-error');
    expect(alert).not.toBeNull();
    expect(screen.getByText('Health check unavailable')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: ComponentCard (Req 2.3)
// ---------------------------------------------------------------------------

describe('ComponentCard', () => {
  afterEach(cleanup);

  it('renders component name', () => {
    renderComponentCard(makeComponentResult('firestore', 'healthy'));
    expect(screen.getByText('Firestore')).toBeInTheDocument();
  });

  it('renders status tag for healthy component', () => {
    renderComponentCard(makeComponentResult('auth', 'healthy'));
    expect(screen.getByText('HEALTHY')).toBeInTheDocument();
  });

  it('renders status tag for degraded component', () => {
    renderComponentCard(makeComponentResult('memory', 'degraded'));
    expect(screen.getByText('DEGRADED')).toBeInTheDocument();
  });

  it('renders status tag for unhealthy component', () => {
    renderComponentCard(makeComponentResult('cpu', 'unhealthy'));
    expect(screen.getByText('UNHEALTHY')).toBeInTheDocument();
  });

  it('renders response time in ms', () => {
    renderComponentCard(makeComponentResult('storage', 'healthy'));
    expect(screen.getByText(/42\.5 ms/)).toBeInTheDocument();
  });

  it('renders status message', () => {
    renderComponentCard(makeComponentResult('scheduler', 'healthy'));
    expect(screen.getByText('scheduler is healthy')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: RecommendationsPanel (Req 2.8)
// ---------------------------------------------------------------------------

describe('RecommendationsPanel', () => {
  afterEach(cleanup);

  it('renders nothing when recommendations array is empty', () => {
    const { container } = renderRecommendations([]);
    expect(container.firstChild).toBeNull();
  });

  it('renders recommendations section when array is non-empty', () => {
    renderRecommendations(['Check Firestore connectivity', 'Reduce memory usage']);
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Check Firestore connectivity')).toBeInTheDocument();
    expect(screen.getByText('Reduce memory usage')).toBeInTheDocument();
  });

  it('renders all recommendation items', () => {
    const recs = ['Rec 1', 'Rec 2', 'Rec 3'];
    renderRecommendations(recs);
    for (const rec of recs) {
      expect(screen.getByText(rec)).toBeInTheDocument();
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: LastCheckedTimestamp
// ---------------------------------------------------------------------------

describe('LastCheckedTimestamp', () => {
  afterEach(cleanup);

  it('renders nothing when checkedAt is null', () => {
    const { container } = render(
      <I18nextProvider i18n={testI18n}>
        <LastCheckedTimestamp checkedAt={null} />
      </I18nextProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders formatted timestamp when checkedAt is provided', () => {
    render(
      <I18nextProvider i18n={testI18n}>
        <LastCheckedTimestamp checkedAt="2024-01-15T02:00:00Z" />
      </I18nextProvider>,
    );
    expect(screen.getByText(/Last checked/)).toBeInTheDocument();
    expect(screen.getByText(/2024-01-15/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: SystemHealthPage — full page integration (Req 2.2, 2.3, 2.4, 2.9, 2.10)
// ---------------------------------------------------------------------------

describe('SystemHealthPage — successful health check', () => {
  beforeEach(() => {
    mockHasSettingsAccess.value = true;
    // Default: backup list returns empty, health check returns healthy report
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/system/health/full') {
        return Promise.resolve({ data: makeHealthReport() });
      }
      if (url === '/api/system/backup/list') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders component cards for all 8 components (Req 2.3)', async () => {
    renderPage();

    await waitFor(() => {
      // Each component name should appear as a card title
      expect(screen.getByText('Firestore')).toBeInTheDocument();
    });

    expect(screen.getByText('Auth')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('Scheduler')).toBeInTheDocument();
    expect(screen.getByText('Api')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('Cpu')).toBeInTheDocument();
    expect(screen.getByText('Recent_errors')).toBeInTheDocument();
  });

  it('shows success banner for healthy overall_status (Req 2.7)', async () => {
    const { container } = renderPage();

    await waitFor(() => {
      expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
    });

    const alert = container.querySelector('.ant-alert-success');
    expect(alert).not.toBeNull();
  });

  it('shows warning banner for degraded overall_status (Req 2.6)', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/system/health/full') {
        return Promise.resolve({
          data: makeHealthReport({ overall_status: 'degraded' }),
        });
      }
      return Promise.resolve({ data: [] });
    });

    const { container } = renderPage();

    await waitFor(() => {
      const alert = container.querySelector('.ant-alert-warning');
      expect(alert).not.toBeNull();
    });
    expect(screen.getByText('System Degraded')).toBeInTheDocument();
  });

  it('shows error banner for unhealthy overall_status (Req 2.5)', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/system/health/full') {
        return Promise.resolve({
          data: makeHealthReport({ overall_status: 'unhealthy' }),
        });
      }
      return Promise.resolve({ data: [] });
    });

    const { container } = renderPage();

    await waitFor(() => {
      const alert = container.querySelector('.ant-alert-error');
      expect(alert).not.toBeNull();
    });
    expect(screen.getByText('System Unhealthy')).toBeInTheDocument();
  });

  it('shows recommendations section when recommendations are non-empty (Req 2.8)', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/system/health/full') {
        return Promise.resolve({
          data: makeHealthReport({
            recommendations: ['Reduce memory usage', 'Check Firestore connectivity'],
          }),
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Recommendations')).toBeInTheDocument();
    });
    expect(screen.getByText('Reduce memory usage')).toBeInTheDocument();
    expect(screen.getByText('Check Firestore connectivity')).toBeInTheDocument();
  });

  it('hides recommendations section when recommendations are empty', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
    });

    expect(screen.queryByText('Recommendations')).toBeNull();
  });

  it('renders the Refresh button (Req 2.9)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  it('Refresh button triggers new API call with force=true (Req 2.9)', async () => {
    renderPage();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
    });

    // Clear mock call history after initial load
    mockApiGet.mockClear();

    // Click Refresh
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    // Verify the next API call includes force=true
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        '/api/system/health/full',
        expect.objectContaining({
          params: expect.objectContaining({ force: true }),
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: SystemHealthPage — API failure path (Req 2.10)
// ---------------------------------------------------------------------------

describe('SystemHealthPage — API failure path', () => {
  beforeEach(() => {
    mockHasSettingsAccess.value = true;
    // Health check fails with 500
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/system/health/full') {
        return Promise.reject(
          Object.assign(new Error('Internal Server Error'), {
            response: { status: 500, data: { detail: 'Internal Server Error' } },
          }),
        );
      }
      if (url === '/api/system/backup/list') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders error Alert when API returns 500 (Req 2.10)', async () => {
    const { container } = renderPage();

    await waitFor(() => {
      const errorAlerts = container.querySelectorAll('.ant-alert-error');
      expect(errorAlerts.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('shows "Health check unavailable" in banner on API failure (Req 2.4)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Health check unavailable')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('hides loading skeleton immediately on error (Req 2.2)', async () => {
    const { container } = renderPage();

    await waitFor(() => {
      // After error, the error state should be shown
      expect(screen.getByText('Health check unavailable')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Skeleton should not be visible after error
    const skeletons = container.querySelectorAll('.ant-skeleton-active');
    expect(skeletons.length).toBe(0);
  });

  it('renders a Retry button in the error Alert (Req 2.10)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('Retry button triggers a new API call', async () => {
    // After first failure, make the second call succeed
    let callCount = 0;
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/system/health/full') {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(
            Object.assign(new Error('Internal Server Error'), {
              response: { status: 500 },
            }),
          );
        }
        return Promise.resolve({ data: makeHealthReport() });
      }
      return Promise.resolve({ data: [] });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    }, { timeout: 5000 });

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(callCount).toBeGreaterThanOrEqual(2);
    }, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Tests: RTL layout direction (Req 2.12)
// ---------------------------------------------------------------------------

describe('SystemHealthPage — RTL layout direction (Req 2.12)', () => {
  beforeEach(() => {
    mockHasSettingsAccess.value = true;
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/system/health/full') {
        return Promise.resolve({ data: makeHealthReport() });
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders with dir="rtl" wrapper without errors', async () => {
    const { container } = renderPage({ dir: 'rtl' });

    await waitFor(() => {
      expect(screen.getByText('System Health')).toBeInTheDocument();
    });

    // The wrapper div should have dir="rtl"
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.getAttribute('dir')).toBe('rtl');
  });

  it('applies RTL direction attribute to the container', async () => {
    const { container } = renderPage({ dir: 'rtl' });

    await waitFor(() => {
      expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
    });

    // Verify the dir attribute is present on the wrapper
    const rtlWrapper = container.querySelector('[dir="rtl"]');
    expect(rtlWrapper).not.toBeNull();
  });

  it('renders all component cards in RTL mode (Req 2.3, 2.12)', async () => {
    renderPage({ dir: 'rtl' });

    await waitFor(() => {
      expect(screen.getByText('Firestore')).toBeInTheDocument();
    });

    // All 8 components should still render in RTL mode
    expect(screen.getByText('Auth')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('Scheduler')).toBeInTheDocument();
  });

  it('renders banner correctly in RTL mode (Req 2.4, 2.12)', async () => {
    const { container } = renderPage({ dir: 'rtl' });

    await waitFor(() => {
      const alert = container.querySelector('.ant-alert-success');
      expect(alert).not.toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Role guard — non-admin users redirected (Req 2.1)
// ---------------------------------------------------------------------------

describe('SystemHealthPage — role guard', () => {
  afterEach(() => {
    cleanup();
    mockHasSettingsAccess.value = true;
    vi.clearAllMocks();
  });

  it('renders null when user does not have settings access', () => {
    mockHasSettingsAccess.value = false;
    const { container } = renderPage();
    // The page should render nothing (returns null) for non-admin users
    expect(container.querySelector('[data-testid="system-health-page"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: Loading state (Req 2.2)
// ---------------------------------------------------------------------------

describe('SystemHealthPage — loading state', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows loading skeleton while API call is pending (Req 2.2)', () => {
    mockHasSettingsAccess.value = true;
    // Never resolves — keeps loading state
    mockApiGet.mockImplementation(() => new Promise(() => {}));

    const { container } = renderPage();

    // Skeleton should be visible while loading
    const skeleton = container.querySelector('.ant-skeleton');
    expect(skeleton).not.toBeNull();
  });
});
