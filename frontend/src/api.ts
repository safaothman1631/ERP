import axios from 'axios';
import { message } from './utils/message';
import i18n from './i18n';

const BACKEND_OUTAGE_STATUSES = new Set([502, 503, 504]);
const BACKEND_OUTAGE_GUARD_MS = 4000;
const BACKEND_RETRY_HEADER = 'X-Zoho-Retry';

let backendUnavailableUntil = 0;
let lastBackendUnavailableToastAt = 0;

type BackendAwareError = Error & {
  isBackendUnavailable?: boolean;
  response?: {
    status?: number;
  };
};

const markBackendUnavailable = (error: BackendAwareError): BackendAwareError => {
  error.isBackendUnavailable = true;
  return error;
};

const createBackendUnavailableError = (): BackendAwareError =>
  markBackendUnavailable(new Error('backend-unavailable') as BackendAwareError);

export const isBackendUnavailableError = (error: unknown): boolean => {
  const candidate = error as BackendAwareError | undefined;
  return Boolean(
    candidate?.isBackendUnavailable ||
    !candidate?.response ||
    BACKEND_OUTAGE_STATUSES.has(candidate.response.status || 0)
  );
};

export const backendRetryConfig = {
  headers: {
    [BACKEND_RETRY_HEADER]: '1',
  },
} as const;

const api = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const headers = (config.headers || {}) as Record<string, string | undefined>;
  const bypassGuard = headers[BACKEND_RETRY_HEADER] === '1';

  if (!bypassGuard && Date.now() < backendUnavailableUntil && config.url?.startsWith('/api')) {
    return Promise.reject(createBackendUnavailableError());
  }

  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Dispatch mutation events for real-time UI updates
api.interceptors.response.use(
  (res) => {
    const method = res.config.method?.toLowerCase();
    if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
      window.dispatchEvent(new CustomEvent('api:mutation', {
        detail: { method, url: res.config.url || '', data: res.data }
      }));
    }
    return res;
  },
  async (error) => {
    if (!error.response || BACKEND_OUTAGE_STATUSES.has(error.response.status)) {
      backendUnavailableUntil = Date.now() + BACKEND_OUTAGE_GUARD_MS;
      if (Date.now() - lastBackendUnavailableToastAt > BACKEND_OUTAGE_GUARD_MS) {
        message.error(i18n.t('error_backend_unavailable'));
        lastBackendUnavailableToastAt = Date.now();
      }
      return Promise.reject(markBackendUnavailable(error));
    }

    if (!error.response) {
      message.error(i18n.t('error_network'));
      return Promise.reject(error);
    }

    const status = error.response.status;

    if (status === 401) {
      // Try silent refresh ONCE per failing request before forcing logout.
      // Skip refresh attempt for the auth endpoints themselves to prevent loops.
      const cfg = error.config || {};
      const url: string = cfg.url || '';
      const alreadyRetried = cfg._refreshRetried === true;
      const isAuthEndpoint =
        url.includes('/api/auth/login') ||
        url.includes('/api/auth/refresh') ||
        url.includes('/api/auth/logout');

      if (!alreadyRetried && !isAuthEndpoint && localStorage.getItem('token')) {
        cfg._refreshRetried = true;
        try {
          const oldToken = localStorage.getItem('token');
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { Authorization: `Bearer ${oldToken}` },
          });
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            const newToken = data?.access_token;
            if (newToken) {
              localStorage.setItem('token', newToken);
              cfg.headers = cfg.headers || {};
              cfg.headers.Authorization = `Bearer ${newToken}`;
              return api.request(cfg);
            }
          }
        } catch {
          // Fall through to logout
        }
      }

      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('orgId');
      localStorage.removeItem('userName');
      window.location.href = '/login';
    } else if (status === 403) {
      message.error(i18n.t('error_forbidden'));
    } else if (status === 404) {
      message.error(i18n.t('error_not_found'));
    } else if (status === 422) {
      const detail = error.response.data?.detail;
      if (Array.isArray(detail)) {
        const msg = detail.map((d: { msg: string }) => d.msg).join(', ');
        message.error(msg || i18n.t('error_validation'));
      } else if (typeof detail === 'string') {
        message.error(detail);
      } else {
        message.error(i18n.t('error_validation'));
      }
    } else if (status >= 500) {
      message.error(i18n.t('error_server'));
    }

    return Promise.reject(error);
  }
);

// ===== POS API Extensions - Sprint 6.6 =====
export const posApi = {
  // Hardware
  hardware: {
    printReceipt: (data: { order_id: string; printer_name?: string; format?: string }) =>
      api.post('/api/pos/hardware/print-receipt', data),
    openCashDrawer: (data: { drawer_id?: string; printer_id?: string }) =>
      api.post('/api/pos/hardware/open-cash-drawer', data),
    scaleRead: (device_id: string) =>
      api.post('/api/pos/hardware/scale-read', { device_id }),
    getCustomerDisplay: (config_id: string) =>
      api.get(`/api/pos/hardware/customer-display/${config_id}`),
    updateCustomerDisplay: (config_id: string, data: { order?: any; ads?: any[] }) =>
      api.post(`/api/pos/hardware/customer-display/${config_id}/update`, data),
    iotStatus: (data: { device_id: string; status: string; capabilities?: any }) =>
      api.post('/api/pos/hardware/iot/status', data),
  },
  // Reports
  reports: {
    dashboard: (params: { date_from: string; date_to: string; config_id?: string }) =>
      api.get('/api/pos/reports/dashboard', { params }),
    salesByProduct: (params: { date_from: string; date_to: string; config_id?: string; limit?: number }) =>
      api.get('/api/pos/reports/sales-by-product', { params }),
    salesByCategory: (params: { date_from: string; date_to: string; config_id?: string }) =>
      api.get('/api/pos/reports/sales-by-category', { params }),
    salesByCashier: (params: { date_from: string; date_to: string; config_id?: string }) =>
      api.get('/api/pos/reports/sales-by-cashier', { params }),
    sessionsSummary: (params: { date_from: string; date_to: string; config_id?: string }) =>
      api.get('/api/pos/reports/sessions-summary', { params }),
    hourlyHeatmap: (params: { date_from: string; date_to: string; config_id?: string }) =>
      api.get('/api/pos/reports/hourly-heatmap', { params }),
  },
  // Iraq Fiscal
  hooks: {
    einvoice: (order_id: string) =>
      api.post('/api/pos/hooks/iraq/einvoice', { order_id }),
    postSessionAccounting: (session_id: string) =>
      api.post('/api/pos/hooks/accounting/post-session', { session_id }),
    pickOrderInventory: (order_id: string) =>
      api.post('/api/pos/hooks/inventory/pick-order', { order_id }),
  },
  // Gift Cards
  giftCards: {
    list: (params?: { batch_id?: string; is_active?: boolean; partner_id?: string }) =>
      api.get('/api/pos/gift-cards', { params }),
  },
};

export default api;
