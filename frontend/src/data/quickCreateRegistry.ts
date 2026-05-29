/**
 * @file quickCreateRegistry.ts
 * @description Single source of truth for the empty-state + quick-create system.
 *
 * Every entity that ships a quick-create flow is declared here. Consumers
 * (`<SelectWithQuickCreate>`, `<ListWithEmptyState>`, ...) read from this
 * registry — no inline configs anywhere else.
 *
 * ## Adding a new entity
 *
 * 1. Add its slug to `EntitySlug` in `design-system/empty/types.ts`.
 * 2. Add a `QUICK_CREATE_REGISTRY` entry below with the required documentation
 *    comment block.
 * 3. Add `qc.<slug>.{title,description,cta,empty_title,empty_description}`
 *    keys to `frontend/src/locales/{ku,en,ar}.json`.
 * 4. (Class C only) Implement the destination create page's `?returnTo=` handling.
 *
 * Per design.md §2.3:
 *
 *   // === ENTITY: <name> ====================================================
 *   // Class: A / B / C
 *   // Reasoning: <1-2 sentences why this class>
 *   // Permission: <resource>.<verb>
 *   // Owner: @<team>
 *   // First migrated in: <PR link>
 *   // =====================================================================
 *
 * @see .kiro/specs/empty-state-quick-create/design.md §2
 */

import api from '../api';
import type {
  ApiCreateContext,
  EntitySlug,
  FieldDef,
  LoadOptionsResult,
  QuickCreateConfig,
  QuickCreateResult,
  QuickCreateValues,
} from '../design-system/empty/types';

/* ---------------------------------------------------------------------------
 * Generic helpers — reused across the registry to keep entries compact.
 * ---------------------------------------------------------------------------
 */

/** POST helper that conforms to the `apiCreate` contract. */
async function post<T extends { id: string | number }>(
  path: string,
  values: QuickCreateValues,
  ctx: ApiCreateContext,
  labelKey: string,
): Promise<QuickCreateResult<T>> {
  const res = await api.post<T>(path, values, { signal: ctx.signal });
  const data = res.data;
  const label =
    typeof (data as Record<string, unknown>)[labelKey] === 'string'
      ? ((data as Record<string, unknown>)[labelKey] as string)
      : String(data.id);
  return { id: data.id, label, raw: data };
}

/** GET helper that maps `{ items: [...] }` lists into `LoadOptionsResult`. */
async function loadOptionsGeneric(
  path: string,
  search: string,
  labelKey: string,
  extraParams: Record<string, string | number | boolean> = {},
): Promise<LoadOptionsResult> {
  try {
    const res = await api.get<{ items?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> }>(
      path,
      { params: { search, limit: 20, ...extraParams } },
    );
    const items = res.data?.items ?? res.data?.data ?? (Array.isArray(res.data) ? (res.data as unknown as Array<Record<string, unknown>>) : []);
    return {
      options: items.map((it) => ({
        value: (it.id as string | number) ?? '',
        label: (it[labelKey] as string) ?? String(it.id ?? ''),
      })),
    };
  } catch {
    return { options: [] };
  }
}

/* ---------------------------------------------------------------------------
 * Detectors — shared regexes for query-inheritance.
 * ---------------------------------------------------------------------------
 */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[+\d][\d\s()\-]{5,}$/;

/* ---------------------------------------------------------------------------
 * Re-usable field bundles
 * ---------------------------------------------------------------------------
 */

const NAME_FIELD: FieldDef = {
  name: 'name',
  type: 'text',
  required: true,
  labelKey: 'fields.name',
  autoFocus: true,
  maxLength: 120,
};

const DISPLAY_NAME_FIELD: FieldDef = {
  name: 'display_name',
  type: 'text',
  required: true,
  labelKey: 'fields.name',
  autoFocus: true,
  maxLength: 120,
};

const PHONE_FIELD: FieldDef = {
  name: 'phone',
  type: 'tel',
  labelKey: 'fields.phone',
  maxLength: 32,
};

const EMAIL_FIELD: FieldDef = {
  name: 'email',
  type: 'email',
  labelKey: 'fields.email',
  maxLength: 120,
};

/* ===========================================================================
 * Registry
 * =========================================================================== */

export const QUICK_CREATE_REGISTRY: Record<EntitySlug, QuickCreateConfig> = {
  // === ENTITY: customer ================================================
  // Class: A
  // Reasoning: Customer create needs only display_name + optional contact;
  // 4 fields max, fits a 420px modal cleanly. This is the highest-traffic
  // quick-create surface (invoice form, sales order, POS).
  // Permission: contacts.create
  // Owner: @sales
  // First migrated in: invoice-form (Phase 2)
  // =====================================================================
  customer: {
    class: 'A',
    titleKey: 'qc.customer.title',
    descriptionKey: 'qc.customer.description',
    ctaKey: 'qc.customer.cta',
    emptyTitleKey: 'qc.customer.empty_title',
    illustration: 'customers',
    fields: [
      DISPLAY_NAME_FIELD,
      PHONE_FIELD,
      EMAIL_FIELD,
      {
        name: 'contact_type',
        type: 'select',
        labelKey: 'fields.contact_type',
        default: 'customer',
        options: [
          { value: 'customer', labelKey: 'enums.contact_type.customer' },
          { value: 'vendor', labelKey: 'enums.contact_type.vendor' },
        ],
      },
    ],
    apiCreate: (values, ctx) =>
      post<{ id: string; display_name: string }>('/api/contacts', values, ctx, 'display_name'),
    loadOptions: (search) => loadOptionsGeneric('/api/contacts', search, 'display_name', { contact_type: 'customer' }),
    queryClass: 'C',
    permission: 'contacts.create',
    fullFormHref: '/contacts/new',
    queryInheritance: {
      field: 'display_name',
      detectors: [
        { field: 'email', pattern: EMAIL_RE },
        { field: 'phone', pattern: PHONE_RE },
      ],
    },
  },

  // === ENTITY: vendor ==================================================
  // Class: A
  // Reasoning: Identical shape to customer; contact_type defaults to vendor.
  // Permission: contacts.create
  // Owner: @purchasing
  // First migrated in: bill-form (Phase 2)
  // =====================================================================
  vendor: {
    class: 'A',
    titleKey: 'qc.vendor.title',
    descriptionKey: 'qc.vendor.description',
    ctaKey: 'qc.vendor.cta',
    emptyTitleKey: 'qc.vendor.empty_title',
    illustration: 'customers',
    fields: [
      DISPLAY_NAME_FIELD,
      PHONE_FIELD,
      EMAIL_FIELD,
      {
        name: 'contact_type',
        type: 'select',
        labelKey: 'fields.contact_type',
        default: 'vendor',
        options: [
          { value: 'vendor', labelKey: 'enums.contact_type.vendor' },
          { value: 'customer', labelKey: 'enums.contact_type.customer' },
        ],
      },
    ],
    apiCreate: (values, ctx) =>
      post<{ id: string; display_name: string }>('/api/contacts', values, ctx, 'display_name'),
    loadOptions: (search) => loadOptionsGeneric('/api/contacts', search, 'display_name', { contact_type: 'vendor' }),
    queryClass: 'C',
    permission: 'contacts.create',
    fullFormHref: '/contacts/new?type=vendor',
    queryInheritance: {
      field: 'display_name',
      detectors: [
        { field: 'email', pattern: EMAIL_RE },
        { field: 'phone', pattern: PHONE_RE },
      ],
    },
  },

  // === ENTITY: tax_rate ================================================
  // Class: A
  // Reasoning: 3 fields. Tax rates are cold reference data; class D for cache.
  // Permission: taxes.create
  // Owner: @accounting
  // First migrated in: invoice-line-tax-selector (Phase 2)
  // =====================================================================
  tax_rate: {
    class: 'A',
    titleKey: 'qc.tax_rate.title',
    descriptionKey: 'qc.tax_rate.description',
    ctaKey: 'qc.tax_rate.cta',
    emptyTitleKey: 'qc.tax_rate.empty_title',
    illustration: 'documents',
    fields: [
      { ...NAME_FIELD, labelKey: 'fields.tax_name' },
      {
        name: 'rate',
        type: 'number',
        required: true,
        labelKey: 'fields.tax_rate',
        min: 0,
        max: 100,
        suffix: '%',
      },
      {
        name: 'tax_type',
        type: 'select',
        labelKey: 'fields.tax_type',
        default: 'VAT',
        options: [
          { value: 'VAT', labelKey: 'enums.tax_type.vat' },
          { value: 'GST', labelKey: 'enums.tax_type.gst' },
          { value: 'WHT', labelKey: 'enums.tax_type.withholding' },
        ],
      },
    ],
    // Backend (`backend/app/api/taxes.py`) mounts the prefix `/api/taxes` and
    // exposes rate CRUD under `/rates`. Canonical endpoint is therefore
    // `/api/taxes/rates`. Older callers (ItemForm) fetched `/api/taxes/rates`
    // while BillForm used `/api/taxes` — EP-FINAL reconciled to `/rates`.
    apiCreate: (values, ctx) =>
      post<{ id: string; name: string }>('/api/taxes/rates', values, ctx, 'name'),
    loadOptions: (search) => loadOptionsGeneric('/api/taxes/rates', search, 'name'),
    queryClass: 'D',
    permission: 'taxes.create',
    fullFormHref: '/settings/taxes/new',
  },

  // === ENTITY: expense_category ========================================
  // Class: A
  // Reasoning: 2 fields. Common quick-create from the expense form.
  // Permission: expenses.create_category
  // Owner: @accounting
  // First migrated in: expense-form (Phase 2)
  // =====================================================================
  expense_category: {
    class: 'A',
    titleKey: 'qc.expense_category.title',
    descriptionKey: 'qc.expense_category.description',
    ctaKey: 'qc.expense_category.cta',
    emptyTitleKey: 'qc.expense_category.empty_title',
    illustration: 'documents',
    fields: [
      NAME_FIELD,
      {
        name: 'description',
        type: 'textarea',
        labelKey: 'fields.description',
        maxLength: 280,
      },
    ],
    apiCreate: (values, ctx) =>
      post<{ id: string; name: string }>('/api/expense-categories', values, ctx, 'name'),
    loadOptions: (search) => loadOptionsGeneric('/api/expense-categories', search, 'name'),
    queryClass: 'D',
    permission: 'expenses.create_category',
    fullFormHref: '/settings/expense-categories/new',
  },

  // === ENTITY: equipment_category ======================================
  // Class: A
  // Reasoning: 2 fields. Used by maintenance + field-service modules.
  // Permission: equipment.create_category
  // Owner: @ops
  // First migrated in: maintenance-asset-form (Phase 3)
  // =====================================================================
  equipment_category: {
    class: 'A',
    titleKey: 'qc.equipment_category.title',
    descriptionKey: 'qc.equipment_category.description',
    ctaKey: 'qc.equipment_category.cta',
    emptyTitleKey: 'qc.equipment_category.empty_title',
    illustration: 'box',
    fields: [
      NAME_FIELD,
      {
        name: 'description',
        type: 'textarea',
        labelKey: 'fields.description',
        maxLength: 280,
      },
    ],
    apiCreate: (values, ctx) =>
      post<{ id: string; name: string }>('/api/equipment-categories', values, ctx, 'name'),
    loadOptions: (search) => loadOptionsGeneric('/api/equipment-categories', search, 'name'),
    queryClass: 'D',
    permission: 'equipment.create_category',
    fullFormHref: '/settings/equipment-categories/new',
  },

  // === ENTITY: currency ================================================
  // Class: A
  // Reasoning: 4 reference fields. Cold cache (D).
  // Permission: currencies.create
  // Owner: @accounting
  // First migrated in: bank-account-form (Phase 3)
  // =====================================================================
  currency: {
    class: 'A',
    titleKey: 'qc.currency.title',
    descriptionKey: 'qc.currency.description',
    ctaKey: 'qc.currency.cta',
    emptyTitleKey: 'qc.currency.empty_title',
    illustration: 'money',
    fields: [
      {
        name: 'code',
        type: 'text',
        required: true,
        labelKey: 'fields.currency_code',
        autoFocus: true,
        maxLength: 3,
      },
      {
        name: 'symbol',
        type: 'text',
        required: true,
        labelKey: 'fields.currency_symbol',
        maxLength: 4,
      },
      { ...NAME_FIELD, autoFocus: false },
      {
        name: 'decimals',
        type: 'number',
        labelKey: 'fields.decimals',
        default: 2,
        min: 0,
        max: 6,
      },
    ],
    apiCreate: (values, ctx) =>
      post<{ id: string; code: string }>('/api/currencies', values, ctx, 'code'),
    loadOptions: (search) => loadOptionsGeneric('/api/currencies', search, 'code'),
    queryClass: 'D',
    permission: 'currencies.create',
    fullFormHref: '/settings/currencies/new',
  },

  // === ENTITY: tag =====================================================
  // Class: A
  // Reasoning: 2 fields (name, color). Pervasive across modules.
  // Permission: tags.create
  // Owner: @platform
  // First migrated in: contact-detail-tag-selector (Phase 3)
  // =====================================================================
  tag: {
    class: 'A',
    titleKey: 'qc.tag.title',
    descriptionKey: 'qc.tag.description',
    ctaKey: 'qc.tag.cta',
    emptyTitleKey: 'qc.tag.empty_title',
    illustration: 'documents',
    fields: [
      NAME_FIELD,
      {
        name: 'color',
        type: 'select',
        labelKey: 'fields.color',
        default: 'blue',
        options: [
          { value: 'blue', labelKey: 'enums.color.blue' },
          { value: 'green', labelKey: 'enums.color.green' },
          { value: 'red', labelKey: 'enums.color.red' },
          { value: 'orange', labelKey: 'enums.color.orange' },
          { value: 'purple', labelKey: 'enums.color.purple' },
          { value: 'gray', labelKey: 'enums.color.gray' },
        ],
      },
    ],
    apiCreate: (values, ctx) =>
      post<{ id: string; name: string }>('/api/tags', values, ctx, 'name'),
    loadOptions: (search) => loadOptionsGeneric('/api/tags', search, 'name'),
    queryClass: 'D',
    permission: 'tags.create',
    fullFormHref: '/settings/tags/new',
  },

  // === ENTITY: payment_method ==========================================
  // Class: A
  // Reasoning: 3 fields. Referenced from invoice payments + POS.
  // Permission: payments.create_method
  // Owner: @accounting
  // First migrated in: payment-form (Phase 3)
  // =====================================================================
  payment_method: {
    class: 'A',
    titleKey: 'qc.payment_method.title',
    descriptionKey: 'qc.payment_method.description',
    ctaKey: 'qc.payment_method.cta',
    emptyTitleKey: 'qc.payment_method.empty_title',
    illustration: 'money',
    fields: [
      NAME_FIELD,
      {
        name: 'type',
        type: 'select',
        required: true,
        labelKey: 'fields.payment_method_type',
        default: 'cash',
        options: [
          { value: 'cash', labelKey: 'enums.payment_method.cash' },
          { value: 'bank_transfer', labelKey: 'enums.payment_method.bank_transfer' },
          { value: 'card', labelKey: 'enums.payment_method.card' },
          { value: 'check', labelKey: 'enums.payment_method.check' },
          { value: 'other', labelKey: 'enums.payment_method.other' },
        ],
      },
      {
        name: 'account_id',
        type: 'text',
        labelKey: 'fields.linked_account',
        placeholderKey: 'fields.linked_account_placeholder',
      },
    ],
    apiCreate: (values, ctx) =>
      post<{ id: string; name: string }>('/api/payment-methods', values, ctx, 'name'),
    loadOptions: (search) => loadOptionsGeneric('/api/payment-methods', search, 'name'),
    queryClass: 'D',
    permission: 'payments.create_method',
    fullFormHref: '/settings/payment-methods/new',
  },

  // ===================================================================
  //  Class B — drawer (5–15 fields)
  // ===================================================================

  // === ENTITY: item ====================================================
  // Class: B
  // Reasoning: ~10 fields (name, sku, type, unit, prices, tax, accounts,
  //   description, image). Image upload pushes us to a drawer.
  // Permission: items.create
  // Owner: @inventory
  // First migrated in: invoice-line-item-selector (Phase 2)
  // =====================================================================
  item: {
    class: 'B',
    titleKey: 'qc.item.title',
    descriptionKey: 'qc.item.description',
    ctaKey: 'qc.item.cta',
    emptyTitleKey: 'qc.item.empty_title',
    illustration: 'items',
    fields: [
      NAME_FIELD,
      { name: 'sku', type: 'text', labelKey: 'fields.sku', maxLength: 64 },
      {
        name: 'item_type',
        type: 'select',
        required: true,
        labelKey: 'fields.item_type',
        default: 'goods',
        options: [
          { value: 'goods', labelKey: 'enums.item_type.goods' },
          { value: 'service', labelKey: 'enums.item_type.service' },
        ],
      },
      {
        name: 'unit',
        type: 'select',
        labelKey: 'fields.unit',
        default: 'pcs',
        options: [
          { value: 'pcs', labelKey: 'enums.unit.pcs' },
          { value: 'kg', labelKey: 'enums.unit.kg' },
          { value: 'g', labelKey: 'enums.unit.g' },
          { value: 'l', labelKey: 'enums.unit.l' },
          { value: 'm', labelKey: 'enums.unit.m' },
          { value: 'box', labelKey: 'enums.unit.box' },
        ],
      },
      {
        name: 'selling_price',
        type: 'number',
        required: true,
        labelKey: 'fields.selling_price',
        min: 0,
      },
      { name: 'cost_price', type: 'number', labelKey: 'fields.cost_price', min: 0 },
      { name: 'tax_id', type: 'text', labelKey: 'fields.tax', placeholderKey: 'fields.tax_placeholder' },
      {
        name: 'income_account_id',
        type: 'text',
        labelKey: 'fields.income_account',
      },
      {
        name: 'expense_account_id',
        type: 'text',
        labelKey: 'fields.expense_account',
      },
      {
        name: 'description',
        type: 'textarea',
        labelKey: 'fields.description',
        maxLength: 500,
      },
      { name: 'image', type: 'file', labelKey: 'fields.image', accept: 'image/*' },
    ],
    apiCreate: (values, ctx) =>
      post<{ id: string; name: string }>('/api/items', values, ctx, 'name'),
    loadOptions: (search) => loadOptionsGeneric('/api/items', search, 'name'),
    queryClass: 'C',
    permission: 'items.create',
    fullFormHref: '/items/new',
    queryInheritance: { field: 'name' },
  },

  // === ENTITY: account =================================================
  // Class: B
  // Reasoning: 6 fields including account_type and parent_account_id. Used
  //   pervasively across the accounting module.
  // Permission: accounts.create
  // Owner: @accounting
  // First migrated in: chart-of-accounts-page (Phase 3)
  // =====================================================================
  account: {
    class: 'B',
    titleKey: 'qc.account.title',
    descriptionKey: 'qc.account.description',
    ctaKey: 'qc.account.cta',
    emptyTitleKey: 'qc.account.empty_title',
    illustration: 'chart',
    fields: [
      { name: 'code', type: 'text', required: true, labelKey: 'fields.account_code', maxLength: 12 },
      NAME_FIELD,
      {
        name: 'type',
        type: 'select',
        required: true,
        labelKey: 'fields.account_type',
        default: 'asset',
        options: [
          { value: 'asset', labelKey: 'enums.account_type.asset' },
          { value: 'liability', labelKey: 'enums.account_type.liability' },
          { value: 'equity', labelKey: 'enums.account_type.equity' },
          { value: 'income', labelKey: 'enums.account_type.income' },
          { value: 'expense', labelKey: 'enums.account_type.expense' },
        ],
      },
      { name: 'parent_account_id', type: 'text', labelKey: 'fields.parent_account' },
      { name: 'currency', type: 'text', labelKey: 'fields.currency', maxLength: 3 },
      {
        name: 'description',
        type: 'textarea',
        labelKey: 'fields.description',
        maxLength: 280,
      },
    ],
    apiCreate: (values, ctx) =>
      post<{ id: string; name: string }>('/api/accounts', values, ctx, 'name'),
    loadOptions: (search) => loadOptionsGeneric('/api/accounts', search, 'name'),
    queryClass: 'C',
    permission: 'accounts.create',
    fullFormHref: '/accounts/new',
  },

  // === ENTITY: bank_account ============================================
  // Class: B
  // Reasoning: 7 fields including IBAN, currency, opening balance.
  // Permission: bank_accounts.create
  // Owner: @banking
  // First migrated in: banking-page (Phase 3)
  // =====================================================================
  bank_account: {
    class: 'B',
    titleKey: 'qc.bank_account.title',
    descriptionKey: 'qc.bank_account.description',
    ctaKey: 'qc.bank_account.cta',
    emptyTitleKey: 'qc.bank_account.empty_title',
    illustration: 'money',
    fields: [
      NAME_FIELD,
      { name: 'bank_name', type: 'text', required: true, labelKey: 'fields.bank_name', maxLength: 120 },
      { name: 'account_number', type: 'text', required: true, labelKey: 'fields.account_number', maxLength: 64 },
      { name: 'iban', type: 'text', labelKey: 'fields.iban', maxLength: 64 },
      { name: 'swift', type: 'text', labelKey: 'fields.swift', maxLength: 16 },
      { name: 'currency', type: 'text', labelKey: 'fields.currency', maxLength: 3, default: 'IQD' },
      { name: 'opening_balance', type: 'number', labelKey: 'fields.opening_balance', default: 0, min: 0 },
    ],
    apiCreate: (values, ctx) =>
      post<{ id: string; name: string }>('/api/bank-accounts', values, ctx, 'name'),
    loadOptions: (search) => loadOptionsGeneric('/api/bank-accounts', search, 'name'),
    queryClass: 'C',
    permission: 'bank_accounts.create',
    fullFormHref: '/banking/accounts/new',
  },

  // === ENTITY: team ====================================================
  // Class: B
  // Reasoning: 3 fields but 'members' is a multi-select that needs space.
  // Permission: teams.create
  // Owner: @hr
  // First migrated in: project-team-selector (Phase 3)
  // =====================================================================
  team: {
    class: 'B',
    titleKey: 'qc.team.title',
    descriptionKey: 'qc.team.description',
    ctaKey: 'qc.team.cta',
    emptyTitleKey: 'qc.team.empty_title',
    illustration: 'customers',
    fields: [
      NAME_FIELD,
      { name: 'description', type: 'textarea', labelKey: 'fields.description', maxLength: 280 },
      { name: 'lead_id', type: 'text', labelKey: 'fields.team_lead' },
    ],
    apiCreate: (values, ctx) =>
      post<{ id: string; name: string }>('/api/teams', values, ctx, 'name'),
    loadOptions: (search) => loadOptionsGeneric('/api/teams', search, 'name'),
    queryClass: 'C',
    permission: 'teams.create',
    fullFormHref: '/hr/teams/new',
  },

  // === ENTITY: subscription_plan =======================================
  // Class: B
  // Reasoning: 5 fields (name, billing period, price, currency, trial).
  // Permission: subscriptions.create_plan
  // Owner: @sales
  // First migrated in: subscriptions-page (Phase 3)
  // =====================================================================
  subscription_plan: {
    class: 'B',
    titleKey: 'qc.subscription_plan.title',
    descriptionKey: 'qc.subscription_plan.description',
    ctaKey: 'qc.subscription_plan.cta',
    emptyTitleKey: 'qc.subscription_plan.empty_title',
    illustration: 'money',
    fields: [
      NAME_FIELD,
      {
        name: 'billing_period',
        type: 'select',
        required: true,
        labelKey: 'fields.billing_period',
        default: 'monthly',
        options: [
          { value: 'monthly', labelKey: 'enums.billing_period.monthly' },
          { value: 'quarterly', labelKey: 'enums.billing_period.quarterly' },
          { value: 'yearly', labelKey: 'enums.billing_period.yearly' },
        ],
      },
      { name: 'price', type: 'number', required: true, labelKey: 'fields.price', min: 0 },
      { name: 'currency', type: 'text', labelKey: 'fields.currency', maxLength: 3, default: 'IQD' },
      { name: 'trial_days', type: 'number', labelKey: 'fields.trial_days', min: 0, default: 0 },
    ],
    apiCreate: (values, ctx) =>
      post<{ id: string; name: string }>('/api/subscription-plans', values, ctx, 'name'),
    loadOptions: (search) => loadOptionsGeneric('/api/subscription-plans', search, 'name'),
    queryClass: 'C',
    permission: 'subscriptions.create_plan',
    fullFormHref: '/subscriptions/plans/new',
  },

  // === ENTITY: location ================================================
  // Class: B
  // Reasoning: 5 fields including a region select. Address line can be long.
  // Permission: locations.create
  // Owner: @ops
  // First migrated in: inventory-location-selector (Phase 3)
  // =====================================================================
  location: {
    class: 'B',
    titleKey: 'qc.location.title',
    descriptionKey: 'qc.location.description',
    ctaKey: 'qc.location.cta',
    emptyTitleKey: 'qc.location.empty_title',
    illustration: 'box',
    fields: [
      NAME_FIELD,
      { name: 'code', type: 'text', labelKey: 'fields.location_code', maxLength: 16 },
      { name: 'address', type: 'textarea', labelKey: 'fields.address', maxLength: 280 },
      { name: 'region', type: 'text', labelKey: 'fields.region', maxLength: 64 },
      { name: 'country', type: 'text', labelKey: 'fields.country', maxLength: 64, default: 'Iraq' },
    ],
    apiCreate: (values, ctx) =>
      post<{ id: string; name: string }>('/api/locations', values, ctx, 'name'),
    loadOptions: (search) => loadOptionsGeneric('/api/locations', search, 'name'),
    queryClass: 'C',
    permission: 'locations.create',
    fullFormHref: '/settings/locations/new',
  },

  // ===================================================================
  //  Class C — navigate
  // ===================================================================

  // === ENTITY: employee ================================================
  // Class: C
  // Reasoning: HR onboarding has > 15 fields, multi-step (personal info,
  //   employment, payroll, documents), and creates a user account as a
  //   side-effect. Must navigate to the full create page with return token.
  // Permission: employees.create
  // Owner: @hr
  // First migrated in: project-assignee-selector (Phase 3)
  // =====================================================================
  employee: {
    class: 'C',
    titleKey: 'qc.employee.title',
    descriptionKey: 'qc.employee.description',
    ctaKey: 'qc.employee.cta',
    emptyTitleKey: 'qc.employee.empty_title',
    illustration: 'customers',
    fields: [
      // Class C surfaces only minimal fields here — the destination create page
      // owns the full schema. The fields below are NOT rendered (UI navigates
      // first) but kept for type-completeness.
      { ...NAME_FIELD, labelKey: 'fields.full_name' },
    ],
    apiCreate: () => {
      // Class C entities never run apiCreate from the registry — the destination
      // create page submits via its own logic. Throw to make misuse loud.
      throw new Error('employee is Class C — navigate to fullFormHref instead of calling apiCreate');
    },
    loadOptions: (search) => loadOptionsGeneric('/api/employees', search, 'full_name'),
    queryClass: 'C',
    permission: 'employees.create',
    fullFormHref: '/hr/employees/new',
  },
};

/* ---------------------------------------------------------------------------
 * Convenience exports
 * ---------------------------------------------------------------------------
 */

/** Type-safe registry lookup. */
export function getQuickCreateConfig(entity: EntitySlug): QuickCreateConfig {
  const config = QUICK_CREATE_REGISTRY[entity];
  if (!config) {
    throw new Error(`No quickCreate config for entity "${entity}"`);
  }
  return config;
}

/** All registered slugs — useful for tests and the audit script. */
export const REGISTERED_ENTITIES: ReadonlyArray<EntitySlug> = Object.keys(QUICK_CREATE_REGISTRY) as EntitySlug[];
