import type { RoleThemeId } from '../../personas/types';

export type DashboardKpiId = 'receivable' | 'payable' | 'income' | 'expenses' | 'contacts' | 'overdue';

export interface DashboardLayoutConfig {
  primaryKpis: DashboardKpiId[];
  secondaryKpis: DashboardKpiId[];
  showQuickActions: boolean;
  showChart: boolean;
  showRecentInvoices: boolean;
  showActivity: boolean;
  suppressCreateInEmpty: boolean;
}

const FULL: DashboardLayoutConfig = {
  primaryKpis: ['receivable', 'payable', 'income', 'expenses'],
  secondaryKpis: ['contacts', 'overdue'],
  showQuickActions: true,
  showChart: true,
  showRecentInvoices: true,
  showActivity: true,
  suppressCreateInEmpty: false,
};

export const DASHBOARD_LAYOUTS: Record<RoleThemeId, DashboardLayoutConfig> = {
  executive: FULL,
  administrator: FULL,
  manager: {
    ...FULL,
    showActivity: true,
  },
  finance: {
    primaryKpis: ['receivable', 'payable', 'income', 'expenses'],
    secondaryKpis: ['overdue'],
    showQuickActions: false,
    showChart: true,
    showRecentInvoices: true,
    showActivity: false,
    suppressCreateInEmpty: false,
  },
  sales: {
    primaryKpis: ['receivable', 'income'],
    secondaryKpis: ['contacts', 'overdue'],
    showQuickActions: false,
    showChart: true,
    showRecentInvoices: true,
    showActivity: false,
    suppressCreateInEmpty: false,
  },
  purchase: {
    primaryKpis: ['payable', 'expenses'],
    secondaryKpis: ['overdue'],
    showQuickActions: false,
    showChart: false,
    showRecentInvoices: false,
    showActivity: false,
    suppressCreateInEmpty: false,
  },
  inventory: {
    primaryKpis: ['payable'],
    secondaryKpis: ['contacts'],
    showQuickActions: false,
    showChart: false,
    showRecentInvoices: false,
    showActivity: false,
    suppressCreateInEmpty: false,
  },
  pos: {
    primaryKpis: ['income', 'receivable'],
    secondaryKpis: [],
    showQuickActions: false,
    showChart: false,
    showRecentInvoices: false,
    showActivity: false,
    suppressCreateInEmpty: true,
  },
  hr: {
    primaryKpis: [],
    secondaryKpis: ['contacts'],
    showQuickActions: false,
    showChart: false,
    showRecentInvoices: false,
    showActivity: false,
    suppressCreateInEmpty: true,
  },
  projects: {
    primaryKpis: [],
    secondaryKpis: ['contacts'],
    showQuickActions: false,
    showChart: false,
    showRecentInvoices: false,
    showActivity: false,
    suppressCreateInEmpty: true,
  },
  personal: {
    primaryKpis: ['income', 'expenses'],
    secondaryKpis: ['contacts'],
    showQuickActions: false,
    showChart: false,
    showRecentInvoices: false,
    showActivity: false,
    suppressCreateInEmpty: true,
  },
  readonly: {
    primaryKpis: ['receivable', 'payable', 'income', 'expenses'],
    secondaryKpis: ['contacts', 'overdue'],
    showQuickActions: false,
    showChart: true,
    showRecentInvoices: true,
    showActivity: true,
    suppressCreateInEmpty: true,
  },
};

export function getDashboardLayout(themeId: RoleThemeId): DashboardLayoutConfig {
  return DASHBOARD_LAYOUTS[themeId] ?? FULL;
}
