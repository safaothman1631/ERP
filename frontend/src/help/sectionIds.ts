/**
 * Section identifiers — single source of truth for `useHelp(sectionId)`,
 * the Help_Registry, and the AddGate store.
 *
 * Conventions
 * -----------
 * - IDs are dot-separated, lowercase, snake_case-preserving paths
 *   (e.g. `settings.payment_methods`, `sales.invoices.lineItems`).
 * - The `settings.*` namespace mirrors the keys of the `SectionDef`
 *   registry in `frontend/src/pages/Settings.tsx` so that every Settings
 *   sub-section has a corresponding Help_Registry entry.
 *   See R7.1, R7.2, R8.6 of `system-wide-ux-overhaul/requirements.md`
 *   and the cross-spec authoring source `settings-documentation`.
 * - Non-Settings Sections (Sales, Dashboard, …) are seeded as the umbrella
 *   spec rolls out; new IDs are appended in their semantic group.
 *
 * This file is intentionally data-only — no React, no i18n, no runtime
 * branches — so it can be imported by both the help registry chunk and CI
 * coverage scripts (`i18n-coverage.mjs`, `help-report.mjs`) without
 * pulling in the rest of the frontend bundle.
 *
 * _Validates: Requirements 8.6, 16.4_
 */

export const SECTION_IDS = [
  // ── Onboarding ─────────────────────────────────────────────────────
  'onboarding.company',
  'onboarding.currency_tax',
  'onboarding.coa',
  'onboarding.modules',
  'onboarding.sample_data',
  'onboarding.checklist.bank',
  'onboarding.checklist.contact',
  'onboarding.checklist.item',
  'onboarding.checklist.invoice',
  'onboarding.checklist.user',
  'onboarding.checklist.tax',

  // ── Sales ─────────────────────────────────────────────────────────
  'sales.invoices',
  'sales.invoices.lineItems',
  'sales.quotes',
  'sales.sales_orders',
  'sales.credit_notes',
  'sales.delivery_challans',
  'sales.recurring_invoices',
  'sales.returns',

  // ── Purchases ─────────────────────────────────────────────────────
  'purchases.bills',
  'purchases.purchase_orders',
  'purchases.vendor_credits',
  'purchases.expenses',
  'purchases.expense_claims',
  'purchases.returns',

  // ── Contacts ──────────────────────────────────────────────────────
  'contacts.list',

  // ── Inventory ─────────────────────────────────────────────────────
  'inventory.items',
  'inventory.warehouses',
  'inventory.stock_locations',
  'inventory.serial_numbers',
  'inventory.shipments',
  'inventory.cycle_counts',
  'inventory.putaway_rules',

  // ── Accounting ────────────────────────────────────────────────────
  'accounting.accounts',
  'accounting.journals',
  'accounting.tax_settings',
  'accounting.tax_returns',
  'accounting.budgets',
  'accounting.assets',

  // ── Banking ───────────────────────────────────────────────────────
  'banking',
  'banking.bank_rules',
  'banking.payments',
  'banking.reconciliation',

  // ── HR ────────────────────────────────────────────────────────────
  'hr.employees',
  'hr.contracts',
  'hr.time_off',
  'hr.attendance',
  'hr.payroll_runs',
  'hr.payroll_rules',

  // ── CRM ───────────────────────────────────────────────────────────
  'crm.leads',
  'crm.pipeline',
  'crm.activities',

  // ── Projects ──────────────────────────────────────────────────────
  'projects.list',

  // ── Manufacturing ─────────────────────────────────────────────────
  'manufacturing.boms',
  'manufacturing.orders',
  'manufacturing.work_centers',

  // ── Users & Roles ─────────────────────────────────────────────────
  'users.list',
  'users.roles',

  // ── Automation ────────────────────────────────────────────────────
  'automation.rules',
  'automation.email_templates',

  // ── Subscriptions ─────────────────────────────────────────────────
  'subscriptions.list',
  'subscriptions.plans',

  // ── Dashboard ─────────────────────────────────────────────────────
  'dashboard.kpis',
  'dashboard.quickActions',
  'dashboard.incomeExpenseChart',
  'dashboard.recentInvoices',
  'dashboard.activities',

  // ── Reports ───────────────────────────────────────────────────────
  'reports',

  // ── Approvals ─────────────────────────────────────────────────────
  'approvals',

  // ── E-Invoice ─────────────────────────────────────────────────────
  'einvoice.dashboard',

  // ── Settings · Account & personal ─────────────────────────────────
  'settings.profile',
  'settings.security',
  'settings.notifications',
  'settings.preferences',

  // ── Settings · General & appearance ───────────────────────────────
  'settings.general',
  'settings.appearance',
  'settings.feature_flags',

  // ── Settings · Organization ───────────────────────────────────────
  'settings.organization',
  'settings.branches',
  'settings.branding',
  'settings.working_hours',
  'settings.holidays',

  // ── Settings · Users & access ─────────────────────────────────────
  'settings.users',
  'settings.roles',
  'settings.permissions',
  'settings.sso',
  'settings.portals',

  // ── Settings · Localization ───────────────────────────────────────
  'settings.localization',
  'settings.currencies',
  'settings.languages',
  'settings.formats',

  // ── Settings · Finance & compliance ───────────────────────────────
  'settings.fiscal',
  'settings.budgets',
  'settings.taxes',
  'settings.banking',
  'settings.payment_methods',
  'settings.einvoice',
  'settings.templates',
  'settings.reminders',

  // ── Settings · Commerce ───────────────────────────────────────────
  'settings.sales',
  'settings.crm',
  'settings.purchases',
  'settings.inventory',
  'settings.mrp',
  'settings.pos',
  'settings.ecommerce',
  'settings.helpdesk',

  // ── Settings · Operations ─────────────────────────────────────────
  'settings.hr',
  'settings.payroll',
  'settings.projects',
  'settings.marketing',

  // ── Settings · Automation & integrations ──────────────────────────
  'settings.workflows',
  'settings.approvals',
  'settings.integrations',
  'settings.webhooks',
  'settings.api_tokens',

  // ── Settings · Content & comms ────────────────────────────────────
  'settings.documents',
  'settings.numbering',
  'settings.email',
  'settings.sms_whatsapp',

  // ── Settings · System ─────────────────────────────────────────────
  'settings.modules',
  'settings.backup',
  'settings.activity',
  'settings.audit',
  'settings.gdpr',
  'settings.mobile',
  'settings.system',
] as const;

/**
 * Discriminated union of every legal `sectionId`.
 *
 * Used as the parameter type of `useHelp`, the key type of `HelpRegistry`,
 * and the FK referenced by `useAddGate(sectionId)`. Adding a new Section
 * is a single-edit operation: append the literal to `SECTION_IDS` above
 * and TypeScript will surface every consumer that must be updated.
 */
export type SectionId = typeof SECTION_IDS[number];
