import type React from 'react';
import {
  DashboardOutlined, TeamOutlined, ShoppingOutlined, FileTextOutlined,
  BankOutlined, ProjectOutlined, BookOutlined, WalletOutlined,
  ShoppingCartOutlined, InboxOutlined, SettingOutlined,
  ShopOutlined, BarChartOutlined, GlobalOutlined,
  AppstoreOutlined, ApiOutlined, BuildOutlined,
} from '@ant-design/icons';
import type { TFunction } from 'i18next';

export type NavZoneKey = 'core-commerce' | 'operations' | 'people' | 'finance-control';

export interface NavLeaf {
  key: string;          // route path
  label: string;        // i18n key OR label
  description?: string;
  keywords?: string[];
  favoriteEligible?: boolean;
}

export interface NavSection {
  key: string;
  label: string;        // section heading
  icon: React.ReactNode;
  items: NavLeaf[];
  zone: NavZoneKey;
  blurb?: string;
  defaultOpen?: boolean;
}

export interface NavZone {
  key: NavZoneKey;
  label: string;
  blurb: string;
}

export interface FlattenedNavLeaf extends NavLeaf {
  icon: React.ReactNode;
  sectionKey: string;
  sectionLabel: string;
  zone: NavZoneKey;
  zoneLabel: string;
}

const fallbackZoneLabels: Record<NavZoneKey, string> = {
  'core-commerce': 'Core Commerce',
  operations: 'Operations',
  people: 'People',
  'finance-control': 'Finance & Control',
};

export const buildNavZones = (t: TFunction): NavZone[] => [
  {
    key: 'core-commerce',
    label: t('nav.zone_core_commerce', 'Core Commerce'),
    blurb: t('nav.zone_core_commerce_blurb', 'Customer flow, revenue, and procurement'),
  },
  {
    key: 'operations',
    label: t('nav.zone_operations', 'Operations'),
    blurb: t('nav.zone_operations_blurb', 'Stock, production, fulfillment, and field actions'),
  },
  {
    key: 'people',
    label: t('nav.zone_people', 'People'),
    blurb: t('nav.zone_people_blurb', 'Teams, work, payroll, and customer relationships'),
  },
  {
    key: 'finance-control',
    label: t('nav.zone_finance_control', 'Finance & Control'),
    blurb: t('nav.zone_finance_control_blurb', 'Accounting, compliance, governance, and setup'),
  },
];

/**
 * navigation.ts — تەنها سەرچاوەی sidebar IA.
 * Sectioned layout: ١٢ گرووپی پەیوەست — Dashboard لە سەرەتا، Setup لە کۆتا.
 */
export const buildNavSections = (t: TFunction): NavSection[] => [
  {
    key: 'overview',
    label: t('nav.overview', 'Overview'),
    icon: <DashboardOutlined />,
    zone: 'core-commerce',
    blurb: t('nav.overview_blurb', 'Daily health, quick jumps, and operating pulse'),
    defaultOpen: true,
    items: [
      { key: '/', label: t('dashboard'), description: t('nav.desc_dashboard', 'Command center and live metrics'), keywords: ['home', 'kpi', 'overview'] },
      { key: '/contacts', label: t('contacts'), description: t('nav.desc_contacts', 'Customers, vendors, and profiles'), keywords: ['customers', 'vendors', 'people'], favoriteEligible: true },
      { key: '/items', label: t('items'), description: t('nav.desc_items', 'Product and service catalog'), keywords: ['products', 'catalog', 'sku'], favoriteEligible: true },
    ],
  },
  {
    key: 'sales',
    label: t('sales'),
    icon: <FileTextOutlined />,
    zone: 'core-commerce',
    blurb: t('nav.sales_blurb', 'Quotes to cash, recurring revenue, and customer billing'),
    items: [
      { key: '/invoices', label: t('invoices'), description: t('nav.desc_invoices', 'Draft, send, collect, and reconcile invoices'), keywords: ['billing', 'sales'], favoriteEligible: true },
      { key: '/quotes', label: t('quotes'), description: t('nav.desc_quotes', 'Offers, pricing, and customer proposals'), keywords: ['estimate', 'quotation'] },
      { key: '/sales-orders', label: t('sales_orders'), description: t('nav.desc_sales_orders', 'Confirmed demand and fulfillment planning'), keywords: ['so', 'orders'] },
      { key: '/credit-notes', label: t('credit_notes'), description: t('nav.desc_credit_notes', 'Customer credits and invoice adjustments'), keywords: ['refund', 'credit'] },
      { key: '/shipments', label: t('shipments'), description: t('nav.desc_shipments', 'Delivery execution and shipment status'), keywords: ['delivery', 'logistics'] },
      { key: '/delivery-challans', label: t('delivery_challans'), description: t('nav.desc_delivery_challans', 'Proof of delivery and challan flows'), keywords: ['challan', 'dispatch'] },
      { key: '/sales-returns', label: t('sales_returns'), description: t('nav.desc_sales_returns', 'Customer return approvals and stock impact'), keywords: ['return'] },
      { key: '/payment-links', label: t('payment_links'), description: t('nav.desc_payment_links', 'Shareable collection links for customers'), keywords: ['collect', 'link'] },
      { key: '/recurring-invoices', label: t('recurring_invoices'), description: t('nav.desc_recurring_invoices', 'Subscription-like billing schedules'), keywords: ['subscription', 'repeat'] },
    ],
  },
  {
    key: 'purchases',
    label: t('purchases'),
    icon: <ShoppingCartOutlined />,
    zone: 'core-commerce',
    blurb: t('nav.purchases_blurb', 'Vendors, procurement, credits, and spend control'),
    items: [
      { key: '/bills', label: t('bills'), description: t('nav.desc_bills', 'Vendor bills and payables pipeline'), keywords: ['ap', 'vendors'], favoriteEligible: true },
      { key: '/purchase-orders', label: t('purchase_orders'), description: t('nav.desc_purchase_orders', 'Procurement commitments and inbound planning'), keywords: ['po', 'buy'] },
      { key: '/vendor-credits', label: t('vendor_credits'), description: t('nav.desc_vendor_credits', 'Supplier credits and purchase offsets'), keywords: ['credit'] },
      { key: '/purchase-returns', label: t('purchase_returns'), description: t('nav.desc_purchase_returns', 'Returns back to vendors and stock reversal'), keywords: ['return'] },
      { key: '/expenses', label: t('expenses'), description: t('nav.desc_expenses', 'Direct expenses and payment tracking'), keywords: ['spend', 'cost'] },
      { key: '/expense-claims', label: t('expense_claims'), description: t('nav.desc_expense_claims', 'Employee reimbursement and approvals'), keywords: ['claim', 'reimbursement'] },
    ],
  },
  {
    key: 'banking',
    label: t('banking'),
    icon: <BankOutlined />,
    zone: 'finance-control',
    blurb: t('nav.banking_blurb', 'Cash position, import, reconciliation, and rules'),
    items: [
      { key: '/banking', label: t('accounts'), description: t('nav.desc_banking_accounts', 'Bank and cash accounts overview'), keywords: ['cash', 'bank'] },
      { key: '/banking/rules', label: t('bankRules'), description: t('nav.desc_bank_rules', 'Auto-categorization and matching rules'), keywords: ['rules', 'automation'] },
      { key: '/banking/reconciliation', label: t('reconciliation'), description: t('nav.desc_reconciliation', 'Match statements with system transactions'), keywords: ['statement', 'reconcile'], favoriteEligible: true },
    ],
  },
  {
    key: 'inventory',
    label: t('inventory'),
    icon: <InboxOutlined />,
    zone: 'operations',
    blurb: t('nav.inventory_blurb', 'Stock health, warehouses, and valuation snapshots'),
    items: [
      { key: '/inventory', label: t('inventory_overview'), description: t('nav.desc_inventory_overview', 'Valuation, low stock, groups, and adjustments'), keywords: ['stock', 'valuation'], favoriteEligible: true },
      { key: '/inventory/warehouses', label: t('warehouses'), description: t('nav.desc_warehouses', 'Warehouse map and transfer management'), keywords: ['locations', 'transfer'] },
      { key: '/inventory/price-lists', label: t('priceLists'), description: t('nav.desc_price_lists', 'Flexible pricing catalogs by channel'), keywords: ['pricing'] },
      { key: '/inventory/serials', label: t('serial_numbers', 'Serial Numbers'), description: t('nav.desc_serials', 'Track individual units by serial / IMEI / VIN'), keywords: ['serial', 'imei', 'vin'] },
    ],
  },
  {
    key: 'manufacturing',
    label: t('manufacturing'),
    icon: <ShopOutlined />,
    zone: 'operations',
    blurb: t('nav.manufacturing_blurb', 'Bills of materials, orders, and work centers'),
    items: [
      { key: '/manufacturing/boms', label: t('boms'), description: t('nav.desc_boms', 'Product structures and material recipes'), keywords: ['bom'] },
      { key: '/manufacturing/orders', label: t('manufacturing_orders'), description: t('nav.desc_mfg_orders', 'Production runs and execution status'), keywords: ['mo', 'production'] },
      { key: '/manufacturing/work-centers', label: t('work_centers'), description: t('nav.desc_work_centers', 'Capacity, routings, and workstations'), keywords: ['capacity', 'routing'] },
    ],
  },
  {
    key: 'pos',
    label: t('pos.pos'),
    icon: <ShopOutlined />,
    zone: 'operations',
    blurb: t('nav.pos_blurb', 'Retail terminal, sessions, pricing, and loyalty'),
    items: [
      { key: '/pos', label: t('pos.terminal'), description: t('nav.desc_pos_terminal', 'Cashier terminal and live cart flow'), keywords: ['register', 'checkout'], favoriteEligible: true },
      { key: '/pos/sessions', label: t('pos.sessions'), description: t('nav.desc_pos_sessions', 'Open, close, and audit POS sessions'), keywords: ['cash up'] },
      { key: '/pos/orders', label: t('pos.orders'), description: t('nav.desc_pos_orders', 'Sales history and order lookup'), keywords: ['tickets'] },
      { key: '/pos/configs', label: t('pos.configs'), description: t('nav.desc_pos_configs', 'Terminal configuration and behavior'), keywords: ['config'] },
      { key: '/pos/categories', label: t('pos.categories'), description: t('nav.desc_pos_categories', 'POS category layout and organization'), keywords: ['category'] },
      { key: '/pos/products', label: t('pos.products'), description: t('nav.desc_pos_products', 'Products prepared for retail sale'), keywords: ['products'] },
      { key: '/pos/pricelists', label: t('pos.pricelists'), description: t('nav.desc_pos_pricelists', 'Retail pricing rules and menus'), keywords: ['pricing'] },
      { key: '/pos/employees', label: t('pos.employees'), description: t('nav.desc_pos_employees', 'Cashier access and terminal staff'), keywords: ['cashier', 'staff'] },
      { key: '/pos/loyalty', label: t('pos.loyalty'), description: t('nav.desc_pos_loyalty', 'Reward points and retention settings'), keywords: ['reward'] },
      { key: '/pos/gift-cards', label: t('pos.gift_cards'), description: t('nav.desc_pos_gift_cards', 'Stored-value cards and redemption'), keywords: ['gift'] },
      { key: '/pos/floors', label: t('pos.floors', 'Floors & Tables'), description: t('nav.desc_pos_floors', 'Restaurant floor layout and table map'), keywords: ['restaurant', 'tables'] },
      { key: '/pos/reports', label: t('pos.reports', 'POS Reports'), description: t('nav.desc_pos_reports', 'Daily Z-report, sales by cashier, by product'), keywords: ['z-report', 'sales report'] },
    ],
  },
  {
    key: 'crm',
    label: t('crm'),
    icon: <TeamOutlined />,
    zone: 'people',
    blurb: t('nav.crm_blurb', 'Leads, pipeline, activity rhythm, and insights'),
    items: [
      { key: '/crm/leads', label: t('leads'), description: t('nav.desc_leads', 'Lead capture and qualification'), keywords: ['prospects'] },
      { key: '/crm/pipeline', label: t('pipeline'), description: t('nav.desc_pipeline', 'Deal stages and revenue forecasting'), keywords: ['opportunities'] },
      { key: '/crm/activities', label: t('activities'), description: t('nav.desc_activities', 'Tasks, calls, and follow-ups'), keywords: ['tasks', 'calls'] },
      { key: '/crm/insights', label: t('insights'), description: t('nav.desc_insights', 'Conversion and pipeline intelligence'), keywords: ['analytics'] },
    ],
  },
  {
    key: 'hr',
    label: t('hr'),
    icon: <TeamOutlined />,
    zone: 'people',
    blurb: t('nav.hr_blurb', 'Employees, attendance, leave, and payroll flow'),
    items: [
      { key: '/hr', label: t('hr_dashboard'), description: t('nav.desc_hr_dashboard', 'Workforce snapshot and HR load'), keywords: ['people'] },
      { key: '/hr/employees', label: t('employees'), description: t('nav.desc_employees', 'Employee directory and profile records'), keywords: ['staff'] },
      { key: '/hr/contracts', label: t('contracts'), description: t('nav.desc_contracts', 'Employment agreements and status'), keywords: ['employment'] },
      { key: '/hr/attendance', label: t('attendance'), description: t('nav.desc_attendance', 'Check-in history and attendance control'), keywords: ['check in'] },
      { key: '/hr/time-off', label: t('time_off'), description: t('nav.desc_time_off', 'Leave requests and approval queue'), keywords: ['leave', 'vacation'] },
      { key: '/payroll/rules', label: t('salary_rules'), description: t('nav.desc_salary_rules', 'Payroll logic, allowances, and deductions'), keywords: ['salary'] },
      { key: '/payroll/runs', label: t('payroll_runs'), description: t('nav.desc_payroll_runs', 'Payroll batches and payslip generation'), keywords: ['payrun'] },
    ],
  },
  {
    key: 'projects',
    label: t('projects'),
    icon: <ProjectOutlined />,
    zone: 'people',
    blurb: t('nav.projects_blurb', 'Project delivery, assets, and client work'),
    items: [
      { key: '/projects', label: t('projects'), description: t('nav.desc_projects', 'Project delivery and work tracking'), keywords: ['tasks', 'engagements'] },
      { key: '/assets', label: t('assets'), description: t('nav.desc_assets', 'Business assets and depreciation overview'), keywords: ['fixed assets'] },
    ],
  },
  {
    key: 'accounting',
    label: t('accounting'),
    icon: <BookOutlined />,
    zone: 'finance-control',
    blurb: t('nav.accounting_blurb', 'Books, reports, tax, and statutory control'),
    items: [
      { key: '/accounts', label: t('accounts'), description: t('nav.desc_accounts', 'Chart of accounts and ledger structure'), keywords: ['coa', 'ledger'], favoriteEligible: true },
      { key: '/journals', label: t('journals'), description: t('nav.desc_journals', 'Entries, posting, and audit trail'), keywords: ['entries'] },
      { key: '/reports', label: t('reports'), description: t('nav.desc_reports', 'Financial statements and snapshots'), keywords: ['pl', 'bs', 'trial balance'], favoriteEligible: true },
      { key: '/reports/advanced', label: t('advanced_reports'), description: t('nav.desc_advanced_reports', 'Deep reporting and custom analysis'), keywords: ['analysis'] },
      { key: '/tax-settings', label: t('tax_settings'), description: t('nav.desc_tax_settings', 'Tax rates, groups, and defaults'), keywords: ['vat', 'tax'] },
      { key: '/tax-returns', label: t('taxReturns'), description: t('nav.desc_tax_returns', 'Tax filing preparation and review'), keywords: ['filing'] },
    ],
  },
  {
    key: 'reports-mgt',
    label: t('management'),
    icon: <BarChartOutlined />,
    zone: 'finance-control',
    blurb: t('nav.management_blurb', 'Governance, consolidation, approvals, and auditability'),
    items: [
      { key: '/companies', label: t('companies'), description: t('nav.desc_companies', 'Multi-company structure and control'), keywords: ['entity'] },
      { key: '/branches', label: t('branches'), description: t('nav.desc_branches', 'Branch operations and structure'), keywords: ['locations'] },
      { key: '/reports/branches', label: t('branch_comparison'), description: t('nav.desc_branch_comparison', 'Cross-branch financial comparison'), keywords: ['branch reports'] },
      { key: '/reports/consolidated', label: t('consolidated_reports'), description: t('nav.desc_consolidated_reports', 'Group-level consolidation reports'), keywords: ['group reports'] },
      { key: '/approvals', label: t('approvals'), description: t('nav.desc_approvals', 'Workflow approvals and escalations'), keywords: ['workflow'] },
      { key: '/audit-log', label: t('audit_log'), description: t('nav.desc_audit_log', 'System-wide auditability and trace'), keywords: ['history', 'audit'] },
    ],
  },
  {
    key: 'iraq-int',
    label: t('iraq_localization'),
    icon: <GlobalOutlined />,
    zone: 'finance-control',
    blurb: t('nav.iraq_blurb', 'Localization, compliance, messaging, and OCR intake'),
    items: [
      { key: '/l10n-iq', label: t('iraq_localization'), description: t('nav.desc_iraq_localization', 'Country-specific setup and compliance'), keywords: ['iraq', 'localization'] },
      { key: '/einvoice/dashboard', label: t('einvoice_dashboard'), description: t('nav.desc_einvoice_dashboard', 'Electronic invoice compliance monitor'), keywords: ['fiscal', 'einvoice'] },
      { key: '/whatsapp', label: t('whatsapp'), description: t('nav.desc_whatsapp', 'Messaging workflows and outbound sync'), keywords: ['message'] },
      { key: '/ocr/receipts', label: t('ocr_receipts'), description: t('nav.desc_ocr_receipts', 'Receipt scanning and OCR intake'), keywords: ['scan', 'ocr'] },
    ],
  },
  // ── Extended modules — generic CRUD hub at /ext/<slug> ──────────────
  {
    key: 'ext-engagement',
    label: t('nav.ext_engagement', 'Engagement & Service'),
    icon: <AppstoreOutlined />,
    zone: 'people',
    blurb: t('nav.ext_engagement_blurb', 'Helpdesk, field service, content, and customer engagement'),
    items: [
      { key: '/ext/helpdesk', label: t('mod_helpdesk_ext', 'Helpdesk'), keywords: ['ticket', 'support'] },
      { key: '/ext/field-service', label: t('mod_fs_ext', 'Field Service'), keywords: ['dispatch', 'workers'] },
      { key: '/ext/subscriptions', label: t('mod_subs_ext', 'Subscriptions'), keywords: ['recurring', 'billing'] },
      { key: '/ext/documents', label: t('mod_docs_ext', 'Documents'), keywords: ['files', 'dms'] },
      { key: '/ext/knowledge', label: t('mod_kb_ext', 'Knowledge'), keywords: ['wiki', 'articles'] },
      { key: '/ext/livechat', label: t('mod_livechat', 'Live Chat'), keywords: ['chat', 'channels'] },
      { key: '/ext/social', label: t('mod_social', 'Social'), keywords: ['social', 'posts'] },
      { key: '/ext/comms', label: t('mod_comms', 'SMS & VoIP'), keywords: ['sms', 'calls'] },
      { key: '/ext/engagement', label: t('mod_engagement', 'Events & Surveys'), keywords: ['events', 'surveys'] },
      { key: '/ext/elearning', label: t('mod_elearning', 'eLearning'), keywords: ['courses', 'lessons'] },
      { key: '/ext/hr-extended', label: t('mod_hr_ext', 'Recruitment'), keywords: ['recruit', 'hr'] },
    ],
  },
  {
    key: 'ext-ops',
    label: t('nav.ext_ops', 'Quality & Maintenance'),
    icon: <BuildOutlined />,
    zone: 'operations',
    blurb: t('nav.ext_ops_blurb', 'Quality control, maintenance, PLM, and repairs'),
    items: [
      { key: '/ext/quality', label: t('mod_quality', 'Quality'), keywords: ['quality', 'capa'] },
      { key: '/ext/maintenance', label: t('mod_maintenance', 'Maintenance'), keywords: ['maintenance', 'equipment'] },
      { key: '/ext/plm', label: t('mod_plm', 'PLM'), keywords: ['plm', 'eco'] },
      { key: '/ext/repairs', label: t('mod_repairs', 'Repairs'), keywords: ['repair', 'warranty'] },
    ],
  },
  {
    key: 'ext-platform',
    label: t('nav.ext_platform', 'Platform & AI'),
    icon: <ApiOutlined />,
    zone: 'finance-control',
    blurb: t('nav.ext_platform_blurb', 'Studio (no-code), rental, AI, mobile, and IoT'),
    items: [
      { key: '/ext/studio', label: t('mod_studio', 'Studio'), keywords: ['nocode', 'studio'] },
      { key: '/ext/rental', label: t('mod_rental', 'Rental'), keywords: ['rental'] },
      { key: '/ext/ai', label: t('mod_ai', 'AI'), keywords: ['ai', 'forecast'] },
      { key: '/ext/mobile', label: t('mod_mobile', 'Mobile API'), keywords: ['mobile', 'push'] },
      { key: '/ext/iot', label: t('mod_iot', 'IoT'), keywords: ['iot', 'devices'] },
    ],
  },
  {
    key: 'ext-vertical',
    label: t('nav.ext_vertical', 'Industry Apps'),
    icon: <ShopOutlined />,
    zone: 'operations',
    blurb: t('nav.ext_vertical_blurb', 'Industry-specific verticals'),
    items: [
      { key: '/ext/healthcare', label: t('mod_healthcare', 'Healthcare'), keywords: ['healthcare', 'patient'] },
      { key: '/ext/hospital', label: t('mod_hospital', 'Hospital'), keywords: ['hospital', 'wards'] },
      { key: '/ext/pharmacy', label: t('mod_pharmacy', 'Pharmacy'), keywords: ['pharmacy', 'drugs'] },
      { key: '/ext/hotel', label: t('mod_hotel', 'Hotel'), keywords: ['hotel', 'rooms'] },
      { key: '/ext/restaurant', label: t('mod_restaurant', 'Restaurant'), keywords: ['restaurant', 'menu'] },
      { key: '/ext/construction', label: t('mod_construction', 'Construction'), keywords: ['construction', 'wbs'] },
      { key: '/ext/real-estate', label: t('mod_real_estate', 'Real Estate'), keywords: ['property', 'lease'] },
      { key: '/ext/education', label: t('mod_education', 'Education'), keywords: ['school', 'students'] },
      { key: '/ext/logistics', label: t('mod_logistics', 'Logistics'), keywords: ['shipments', 'routes'] },
      { key: '/ext/agriculture', label: t('mod_agriculture', 'Agriculture'), keywords: ['farm', 'crops'] },
      { key: '/ext/ngo', label: t('mod_ngo', 'NGO'), keywords: ['ngo', 'donor'] },
      { key: '/ext/government', label: t('mod_government', 'Government'), keywords: ['gov', 'permits'] },
    ],
  },
  {
    key: 'setup',
    label: t('setup', 'Setup'),
    icon: <SettingOutlined />,
    zone: 'finance-control',
    blurb: t('nav.setup_blurb', 'Roles, schema, settings, and platform controls'),
    items: [
      { key: '/custom-fields', label: t('custom_fields'), description: t('nav.desc_custom_fields', 'Schema extension and custom data points'), keywords: ['schema'] },
      { key: '/rbac-roles', label: t('roles_permissions'), description: t('nav.desc_roles_permissions', 'Access policy and permission design'), keywords: ['rbac', 'permissions'] },
      { key: '/user-roles', label: t('user_roles'), description: t('nav.desc_user_roles', 'Role assignments and user access'), keywords: ['access'] },
      { key: '/settings', label: t('settings'), description: t('nav.desc_settings', 'Global configuration and operational settings'), keywords: ['config', 'preferences'], favoriteEligible: true },
      { key: '/docs', label: t('docs_hub', 'Help Center'), description: t('nav.desc_docs', 'In-app guides, fields, workflows, and shortcuts'), keywords: ['help', 'docs', 'documentation', 'یارمەتی', 'دۆکیومێنت'], favoriteEligible: true },
      { key: '/ui-gallery', label: t('ui_gallery', 'Layout Gallery'), description: t('nav.desc_ui_gallery', 'Preview and pick a UI layout style for the app shell'), keywords: ['layout', 'theme', 'ui', 'shell', 'ڕووکار', 'گاڵەری'], favoriteEligible: true },
      { key: '/trash', label: t('trash', 'Trash'), description: t('nav.desc_trash', 'Recently deleted items, restore or permanently remove'), keywords: ['recycle', 'deleted', 'restore'] },
    ],
  },
];

/** هەموو routes flatten بکە بۆ Command Palette + breadcrumbs. */
export const flattenRoutes = (sections: NavSection[], zones?: NavZone[]): FlattenedNavLeaf[] => {
  const zoneLabels = new Map((zones || []).map((zone) => [zone.key, zone.label]));

  return sections.flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      icon: section.icon,
      sectionKey: section.key,
      sectionLabel: section.label,
      zone: section.zone,
      zoneLabel: zoneLabels.get(section.zone) || fallbackZoneLabels[section.zone],
      favoriteEligible: item.favoriteEligible ?? true,
    }))
  );
};

/** ئەو section بدۆزەرەوە کە routeـێک تێیدایە. */
export const findSectionByPath = (sections: NavSection[], path: string): NavSection | undefined =>
  sections.find((s) => s.items.some((i) => i.key === path));

/** Quick icon for path (used in palette / topbar dropdown / favorites). */
export const findIconByPath = (sections: NavSection[], path: string): React.ReactNode =>
  sections.find((s) => s.items.some((i) => i.key === path))?.icon;

export const ASSET_ICON = <WalletOutlined />;
