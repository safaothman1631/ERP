type ListQueryParams = Record<string, string | number | boolean | null | undefined>;

const cleanParams = (params?: ListQueryParams): ListQueryParams => {
  if (!params) return {};
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([a], [b]) => a.localeCompare(b))
  );
};

const listKey = (name: string, params?: ListQueryParams) => ['list', name, cleanParams(params)] as const;

export const listQueryKeys = {
  invoices: (params?: ListQueryParams) => listKey('invoices', params),
  bills: (params?: ListQueryParams) => listKey('bills', params),
  contacts: (params?: ListQueryParams) => listKey('contacts', params),
  items: (params?: ListQueryParams) => listKey('items', params),
  quotes: (params?: ListQueryParams) => listKey('quotes', params),
  salesOrders: (params?: ListQueryParams) => listKey('sales-orders', params),
  purchaseOrders: (params?: ListQueryParams) => listKey('purchase-orders', params),
  creditNotes: (params?: ListQueryParams) => listKey('credit-notes', params),
  vendorCredits: (params?: ListQueryParams) => listKey('vendor-credits', params),
  banking: (params?: ListQueryParams) => listKey('banking', params),
  crmLeads: (params?: ListQueryParams) => listKey('crm-leads', params),
  hrEmployees: (params?: ListQueryParams) => listKey('hr-employees', params),
  payrollRuns: (params?: ListQueryParams) => listKey('payroll-runs', params),
  posOrders: (params?: ListQueryParams) => listKey('pos-orders', params),
};

