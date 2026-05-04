import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Input, List, Empty } from 'antd';
import { SearchOutlined, RightOutlined, LeftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export interface QuickSearchProps {
  /** Optional: custom trigger (default: Ctrl+/) */
  triggerKey?: string;
}

interface RouteItem {
  label: string;
  path: string;
  category?: string;
}

/**
 * QuickSearch — Wave 8.C
 * Lightweight global navigation overlay (separate from CommandPalette).
 * Triggered by Ctrl+/ keyboard shortcut.
 * Simpler and faster than CommandPalette — just top 50 routes.
 */
export const QuickSearch: React.FC<QuickSearchProps> = ({ triggerKey = '/' }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const isRTL = i18n.language === 'ku' || i18n.language === 'ar';

  // Hardcoded top 50 most-used routes
  const routes: RouteItem[] = useMemo(() => [
    { label: t('nav.dashboard', 'Dashboard'), path: '/', category: 'main' },
    { label: t('nav.invoices', 'Invoices'), path: '/invoices', category: 'sales' },
    { label: t('nav.bills', 'Bills'), path: '/bills', category: 'purchases' },
    { label: t('nav.contacts', 'Contacts'), path: '/contacts', category: 'main' },
    { label: t('nav.items', 'Items'), path: '/items', category: 'inventory' },
    { label: t('nav.quotes', 'Quotes'), path: '/quotes', category: 'sales' },
    { label: t('nav.sales_orders', 'Sales Orders'), path: '/sales-orders', category: 'sales' },
    { label: t('nav.purchase_orders', 'Purchase Orders'), path: '/purchase-orders', category: 'purchases' },
    { label: t('nav.expenses', 'Expenses'), path: '/expenses', category: 'accounting' },
    { label: t('nav.accounts', 'Chart of Accounts'), path: '/accounts', category: 'accounting' },
    { label: t('nav.journals', 'Journals'), path: '/journals', category: 'accounting' },
    { label: t('nav.banking', 'Banking'), path: '/banking', category: 'accounting' },
    { label: t('nav.reports', 'Reports'), path: '/reports', category: 'reports' },
    { label: t('nav.inventory', 'Inventory'), path: '/inventory', category: 'inventory' },
    { label: t('nav.projects', 'Projects'), path: '/projects', category: 'projects' },
    { label: t('nav.crm_leads', 'CRM Leads'), path: '/crm/leads', category: 'crm' },
    { label: t('nav.crm_pipeline', 'CRM Pipeline'), path: '/crm/pipeline', category: 'crm' },
    { label: t('nav.pos', 'POS'), path: '/pos', category: 'pos' },
    { label: t('nav.pos_sessions', 'POS Sessions'), path: '/pos/sessions', category: 'pos' },
    { label: t('nav.pos_orders', 'POS Orders'), path: '/pos/orders', category: 'pos' },
    { label: t('nav.dashboards', 'Custom Dashboards'), path: '/dashboards', category: 'reports' },
    { label: t('nav.credit_notes', 'Credit Notes'), path: '/credit-notes', category: 'sales' },
    { label: t('nav.vendor_credits', 'Vendor Credits'), path: '/vendor-credits', category: 'purchases' },
    { label: t('nav.recurring_invoices', 'Recurring Invoices'), path: '/recurring-invoices', category: 'sales' },
    { label: t('nav.tax_returns', 'Tax Returns'), path: '/tax-returns', category: 'accounting' },
    { label: t('nav.warehouses', 'Warehouses'), path: '/inventory/warehouses', category: 'inventory' },
    { label: t('nav.assets', 'Fixed Assets'), path: '/assets', category: 'accounting' },
    { label: t('nav.mfg_orders', 'Manufacturing Orders'), path: '/manufacturing/orders', category: 'manufacturing' },
    { label: t('nav.mfg_boms', 'BOMs'), path: '/manufacturing/boms', category: 'manufacturing' },
    { label: t('nav.hr_employees', 'Employees'), path: '/hr/employees', category: 'hr' },
    { label: t('nav.hr_attendance', 'Attendance'), path: '/hr/attendance', category: 'hr' },
    { label: t('nav.payroll_runs', 'Payroll Runs'), path: '/payroll/runs', category: 'hr' },
    { label: t('nav.approvals', 'Approvals'), path: '/approvals', category: 'workflow' },
    { label: t('nav.my_approvals', 'My Approvals'), path: '/my-approvals', category: 'workflow' },
    { label: t('nav.audit_log', 'Audit Log'), path: '/audit-log', category: 'admin' },
    { label: t('nav.users', 'Users'), path: '/users', category: 'admin' },
    { label: t('nav.settings', 'Settings'), path: '/settings', category: 'admin' },
    { label: t('nav.companies', 'Companies'), path: '/companies', category: 'main' },
    { label: t('nav.branches', 'Branches'), path: '/branches', category: 'admin' },
    { label: t('nav.custom_fields', 'Custom Fields'), path: '/custom-fields', category: 'admin' },
    { label: t('nav.email_templates', 'Email Templates'), path: '/email-templates', category: 'admin' },
    { label: t('nav.tax_settings', 'Tax Settings'), path: '/tax-settings', category: 'admin' },
    { label: t('nav.budgets', 'Budgets'), path: '/budgets', category: 'accounting' },
    { label: t('nav.analytic_accounts', 'Analytic Accounts'), path: '/analytic-accounts', category: 'accounting' },
    { label: t('nav.fx_rates', 'Currency Rates'), path: '/fx/rates', category: 'accounting' },
    { label: t('nav.subscriptions', 'Subscriptions'), path: '/subscriptions/list', category: 'sales' },
    { label: t('nav.workflows', 'Workflows'), path: '/automation/workflows', category: 'workflow' },
    { label: t('nav.helpdesk', 'Helpdesk'), path: '/helpdesk/dashboard', category: 'support' },
    { label: t('nav.field_service', 'Field Service'), path: '/field-service/dashboard', category: 'service' },
    { label: t('nav.quality_dashboard', 'Quality'), path: '/quality/dashboard', category: 'quality' },
  ], [t]);

  // Filter routes based on query
  const filteredRoutes = useMemo(() => {
    if (!query.trim()) return routes;
    const lowerQuery = query.toLowerCase();
    return routes.filter(r => r.label.toLowerCase().includes(lowerQuery));
  }, [query, routes]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === triggerKey) {
        e.preventDefault();
        setOpen(v => !v);
        setQuery('');
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, triggerKey]);

  const handleSelect = (path: string) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  return (
    <Modal
      open={open}
      onCancel={() => {
        setOpen(false);
        setQuery('');
      }}
      footer={null}
      width={600}
      centered
      closable={false}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ padding: '16px 16px 0' }}>
        <Input
          autoFocus
          size="large"
          placeholder={t('quick_search.placeholder', 'Search pages... (Ctrl+/)')}
          prefix={<SearchOutlined />}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onPressEnter={() => {
            if (filteredRoutes.length > 0) handleSelect(filteredRoutes[0].path);
          }}
          style={{ borderRadius: 8 }}
        />
        <div style={{ 
          marginTop: 8, 
          fontSize: 12, 
          color: '#999',
          textAlign: isRTL ? 'right' : 'left',
        }}>
          {t('quick_search.hint', 'Press Enter to navigate, Esc to close')}
        </div>
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto', marginTop: 16 }}>
        {filteredRoutes.length === 0 ? (
          <Empty 
            description={t('quick_search.no_results', 'No pages found')}
            style={{ padding: '32px 0' }}
          />
        ) : (
          <List
            dataSource={filteredRoutes}
            renderItem={(item) => (
              <List.Item
                onClick={() => handleSelect(item.path)}
                style={{
                  cursor: 'pointer',
                  padding: '12px 24px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isRTL ? <LeftOutlined style={{ color: '#999' }} /> : <RightOutlined style={{ color: '#999' }} />}
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
    </Modal>
  );
};

export default QuickSearch;
