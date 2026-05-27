import axios, { type AxiosRequestConfig } from 'axios';
import { message } from './utils/message';
import i18n from './i18n';

const api = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export const backendRetryConfig: AxiosRequestConfig = {
  timeout: 60000,
  headers: { 'X-Zoho-Retry': '1' },
};

export const isBackendUnavailableError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) return false;
  return !error.response || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK';
};

const ORG_STORE_KEY = 'org.store.v1';

/** Read active company id from zustand persist (orgStore). */
export function getPersistedCompanyId(): string | null {
  try {
    const raw = localStorage.getItem(ORG_STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { currentCompany?: { id?: string } } };
    return parsed?.state?.currentCompany?.id ?? null;
  } catch {
    return null;
  }
}

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const companyId = getPersistedCompanyId();
  if (companyId) {
    config.headers['X-Company-Id'] = companyId;
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
  (error) => {
    if (!error.response) {
      message.error(i18n.t('error_network'));
      return Promise.reject(error);
    }

    const status = error.response.status;

    if (status === 401) {
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
    } else if (status === 429) {
      message.warning(i18n.t('error_quota', 'Service temporarily busy. Please try again in a moment.'));
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
