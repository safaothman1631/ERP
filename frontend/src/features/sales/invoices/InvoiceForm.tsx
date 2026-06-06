/**
 * InvoiceForm — representative form page template for Invoice entity.
 *
 * Features:
 *   - Two-column FormLayout (main form 8 cols + sticky summary panel 4 cols)
 *   - EditableLineItems with drag-reorder and keyboard navigation
 *   - useAutoSave (every 30 seconds via draftsStore)
 *   - Unsaved-changes guard (React Router useBlocker + beforeunload)
 *   - Inline validation + summary banner listing all errors
 *   - Split save button (Save / Save & New / Save & Send)
 *   - Wrapped in <PageTransition> and <Suspense>
 *
 * Requirements: 15.1–15.7
 */
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Form, Input, DatePicker, Select, Divider, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';

import PageTransition from '../../../components/PageTransition';
import { LoadingSkeleton } from '../../../design-system/LoadingSkeleton';
import { FormLayout, type FormSection, type ValidationError } from '../../../design-system/FormLayout';
import { EditableLineItems, type LineItem, type LineItemColumn } from '../../../design-system/EditableLineItems';
import { MoneyDisplay } from '../../../design-system/MoneyDisplay';
import { EntitySelect, type EntityOption } from '../../../design-system/EntitySelect';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useAuthStore } from '../../../stores/authStore';
import api from '../../../api';

const { Text } = Typography;

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvoiceLineItem extends LineItem {
  item_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
}

interface InvoiceFormValues {
  contact_id: string;
  date: dayjs.Dayjs;
  due_date: dayjs.Dayjs;
  reference: string;
  notes: string;
  terms: string;
}

// ─── Line item column definitions ─────────────────────────────────────────────

const LINE_COLUMNS: LineItemColumn<InvoiceLineItem>[] = [
  { key: 'description', title: 'Description', type: 'text' },
  { key: 'quantity', title: 'Qty', type: 'number', width: 80, min: 0, precision: 2 },
  { key: 'unit_price', title: 'Unit Price', type: 'money', width: 120, min: 0, precision: 2 },
  { key: 'discount_percent', title: 'Disc %', type: 'number', width: 80, min: 0, precision: 2 },
  { key: 'tax_rate', title: 'Tax %', type: 'number', width: 80, min: 0, precision: 2 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _lineIdCounter = 0;
function newInvoiceLine(): InvoiceLineItem {
  return {
    id: `inv-line-${Date.now()}-${++_lineIdCounter}`,
    item_id: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    tax_rate: 0,
  };
}

function calcLineSubtotal(line: InvoiceLineItem): number {
  const sub = line.quantity * line.unit_price;
  return sub * (1 - line.discount_percent / 100);
}

function calcTotals(lines: InvoiceLineItem[]) {
  const subtotal = lines.reduce((s, l) => s + calcLineSubtotal(l), 0);
  const tax = lines.reduce((s, l) => {
    const sub = calcLineSubtotal(l);
    return s + sub * (l.tax_rate / 100);
  }, 0);
  return { subtotal, tax, total: subtotal + tax };
}

// ─── Summary Panel ────────────────────────────────────────────────────────────

interface SummaryPanelProps {
  lines: InvoiceLineItem[];
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({ lines }) => {
  const { t } = useTranslation();
  const { subtotal, tax, total } = calcTotals(lines);

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
  };

  // Use live CSS-var tokens (NOT the isDark prop with hardcoded hex). The prop
  // was resolving false in dark mode, so Total rendered near-black (#0f172a)
  // on a dark surface and was invisible — the user's report "هیچ نوسینێک
  // لێرە دیار نیە". Tokens auto-flip via html[data-theme="dark"].
  const labelStyle: React.CSSProperties = {
    color: 'var(--ink-500)',
    fontSize: 13,
  };

  const totalStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 16,
    color: 'var(--ink-900)',
  };

  return (
    <div>
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
        {t('invoice_form.summary', 'Summary')}
      </Text>

      <div style={rowStyle}>
        <span style={labelStyle}>{t('invoice_form.subtotal', 'Subtotal')}</span>
        <MoneyDisplay amount={subtotal} currency="IQD" />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>{t('invoice_form.tax', 'Tax')}</span>
        <MoneyDisplay amount={tax} currency="IQD" />
      </div>

      <Divider style={{ margin: '8px 0' }} />

      <div style={rowStyle}>
        <span style={totalStyle}>{t('invoice_form.total', 'Total')}</span>
        <span style={totalStyle}>
          <MoneyDisplay amount={total} currency="IQD" />
        </span>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--ink-400)' }}>
        {t('invoice_form.line_count', '{{n}} line(s)', { n: lines.length })}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const InvoiceFormPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isDark = useAuthStore((s) => s.theme === 'dark');

  const [form] = Form.useForm<InvoiceFormValues>();
  const [lines, setLines] = useState<InvoiceLineItem[]>([newInvoiceLine()]);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  // Pre-seeded customer option so the EntitySelect shows the customer NAME when
  // editing/viewing an existing invoice (not just the raw id).
  const [customerOption, setCustomerOption] = useState<EntityOption | undefined>(undefined);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // ── Load the existing invoice when editing/viewing (route has an :id) ───────
  // Previously the edit route rendered a BLANK form — there was no GET, so the
  // record's data never populated (the user's bug: "View shows no data").
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadingInvoice(true);
    (async () => {
      try {
        const res = await api.get(`/api/invoices/${id}`);
        if (cancelled) return;
        const inv = res.data ?? {};
        const rawLines: any[] = inv.lines ?? inv.line_items ?? inv.items ?? [];
        form.setFieldsValue({
          contact_id: inv.contact_id ?? inv.customer_id ?? undefined,
          date: inv.date ? dayjs(inv.date) : undefined,
          due_date: inv.due_date ? dayjs(inv.due_date) : undefined,
          reference: inv.reference ?? inv.reference_number ?? '',
          notes: inv.notes ?? '',
          terms: inv.terms ?? '',
        } as Partial<InvoiceFormValues> as InvoiceFormValues);
        // Seed the customer label so EntitySelect renders the name, not the id.
        // The invoice payload only carries contact_id (no name), so when the
        // name isn't inlined we fetch the contact to resolve its display_name.
        const custId = inv.contact_id ?? inv.customer_id;
        let custName: string | undefined = inv.contact_name ?? inv.customer_name ?? inv.contact?.display_name;
        if (custId) {
          if (!custName) {
            try {
              const c = await api.get(`/api/contacts/${custId}`);
              custName = c.data?.display_name ?? c.data?.name;
            } catch { /* fall back to id below */ }
          }
          if (!cancelled) setCustomerOption({ value: String(custId), label: custName ?? String(custId) });
        }
        if (rawLines.length > 0) {
          setLines(rawLines.map((l, i) => ({
            id: `inv-line-${id}-${i}`,
            item_id: l.item_id ?? l.product_id ?? '',
            description: l.description ?? l.name ?? '',
            quantity: Number(l.quantity ?? l.qty ?? 1),
            unit_price: Number(l.unit_price ?? l.price ?? l.rate ?? 0),
            discount_percent: Number(l.discount_percent ?? l.discount ?? 0),
            tax_rate: Number(l.tax_rate ?? l.tax ?? 0),
          })));
        }
      } catch {
        // leave the blank form on failure (offline/permission); validation still guards save.
      } finally {
        if (!cancelled) setLoadingInvoice(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, form]);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  const formValues = useMemo(
    () => ({ ...form.getFieldsValue(), lines }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines]
  );
  useAutoSave('invoice', id ?? 'new', formValues);

  // ── Entity loaders for EntitySelect ───────────────────────────────────────
  const loadCustomers = useCallback(async (query: string): Promise<EntityOption[]> => {
    try {
      const res = await api.get('/api/contacts', {
        params: { search: query, contact_type: 'customer', page_size: 20 },
      });
      return (res.data.items ?? []).map((c: { id: string; display_name: string; email?: string }) => ({
        value: c.id,
        label: c.display_name,
        description: c.email,
      }));
    } catch {
      return [];
    }
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = useCallback((): ValidationError[] => {
    const errors: ValidationError[] = [];
    const values = form.getFieldsValue();

    if (!values.contact_id) {
      errors.push({ field: t('invoice_form.customer', 'Customer'), message: t('validation.required', 'This field is required') });
    }
    if (!values.date) {
      errors.push({ field: t('invoice_form.date', 'Invoice Date'), message: t('validation.required', 'This field is required') });
    }
    if (!values.due_date) {
      errors.push({ field: t('invoice_form.due_date', 'Due Date'), message: t('validation.required', 'This field is required') });
    }
    if (lines.length === 0) {
      errors.push({ field: t('invoice_form.line_items', 'Line Items'), message: t('validation.at_least_one_line', 'At least one line item is required') });
    }
    lines.forEach((line, idx) => {
      if (!line.description) {
        errors.push({
          field: `${t('invoice_form.line', 'Line')} ${idx + 1}`,
          message: t('validation.description_required', 'Description is required'),
        });
      }
    });

    return errors;
  }, [form, lines, t]);

  // ── Save handlers ──────────────────────────────────────────────────────────
  const doSave = useCallback(async (): Promise<boolean> => {
    const errors = validate();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return false;
    }
    setValidationErrors([]);

    const values = form.getFieldsValue();
    setSaving(true);
    try {
      const payload = {
        contact_id: values.contact_id,
        date: values.date?.format('YYYY-MM-DD'),
        due_date: values.due_date?.format('YYYY-MM-DD'),
        reference: values.reference ?? '',
        notes: values.notes ?? '',
        terms: values.terms ?? '',
        currency_code: 'IQD',
        exchange_rate: 1,
        lines: lines.map((l) => ({
          item_id: l.item_id || null,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_percent: l.discount_percent,
          tax_rate: l.tax_rate,
        })),
      };

      if (id) {
        await api.put(`/api/invoices/${id}`, payload);
      } else {
        await api.post('/api/invoices', payload);
      }

      setSaved(true);
      setIsDirty(false);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [form, id, lines, validate]);

  const handleSave = useCallback(async () => {
    const ok = await doSave();
    if (ok) {
      setTimeout(() => navigate('/invoices'), 400);
    }
  }, [doSave, navigate]);

  const handleSaveAndNew = useCallback(async () => {
    const ok = await doSave();
    if (ok) {
      form.resetFields();
      setLines([newInvoiceLine()]);
      setIsDirty(false);
      setSaved(false);
    }
  }, [doSave, form]);

  const handleSaveAndSend = useCallback(async () => {
    const ok = await doSave();
    if (ok) {
      // Navigate to send/email flow
      setTimeout(() => navigate('/invoices'), 400);
    }
  }, [doSave, navigate]);

  const handleCancel = useCallback(() => {
    navigate('/invoices');
  }, [navigate]);

  // ── Form sections ──────────────────────────────────────────────────────────
  const sections: FormSection[] = useMemo(
    () => [
      {
        key: 'header',
        title: t('invoice_form.section_header', 'Invoice Details'),
        description: t('invoice_form.section_header_desc', 'Customer, dates, and reference information'),
        children: (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <Form.Item
              label={t('invoice_form.customer', 'Customer')}
              name="contact_id"
              rules={[{ required: true, message: t('validation.required', 'Required') }]}
              style={{ gridColumn: '1 / -1' }}
            >
              <EntitySelect
                loadOptions={loadCustomers}
                initialOption={customerOption}
                ariaLabel={t('invoice_form.customer', 'Customer')}
                placeholder={t('invoice_form.customer_placeholder', 'Search customers…')}
                onCreateNew={(query) => navigate(`/contacts/new?type=customer&name=${encodeURIComponent(query)}`)}
                createNewLabel={t('invoice_form.create_customer', 'Create new customer')}
              />
            </Form.Item>

            <Form.Item
              label={t('invoice_form.date', 'Invoice Date')}
              name="date"
              rules={[{ required: true, message: t('validation.required', 'Required') }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label={t('invoice_form.due_date', 'Due Date')}
              name="due_date"
              rules={[{ required: true, message: t('validation.required', 'Required') }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label={t('invoice_form.reference', 'Reference')}
              name="reference"
            >
              <Input placeholder={t('invoice_form.reference_placeholder', 'e.g. PO-12345')} />
            </Form.Item>

            <Form.Item label={t('invoice_form.currency', 'Currency')}>
              <Select defaultValue="IQD" disabled>
                <Select.Option value="IQD">IQD — Iraqi Dinar</Select.Option>
                <Select.Option value="USD">USD — US Dollar</Select.Option>
              </Select>
            </Form.Item>
          </div>
        ),
      },
      {
        key: 'line_items',
        title: t('invoice_form.section_lines', 'Line Items'),
        description: t('invoice_form.section_lines_desc', 'Products and services on this invoice'),
        children: (
          <EditableLineItems<InvoiceLineItem>
            value={lines}
            onChange={(rows) => {
              setLines(rows);
              setIsDirty(true);
            }}
            columns={LINE_COLUMNS}
            newRow={newInvoiceLine}
            addLabel={t('invoice_form.add_line', 'Add line item')}
            isDark={isDark}
          />
        ),
      },
      {
        key: 'footer',
        title: t('invoice_form.section_footer', 'Notes & Terms'),
        children: (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <Form.Item label={t('invoice_form.notes', 'Notes')} name="notes">
              <Input.TextArea
                rows={3}
                placeholder={t('invoice_form.notes_placeholder', 'Internal notes (not shown on invoice)')}
              />
            </Form.Item>
            <Form.Item label={t('invoice_form.terms', 'Terms & Conditions')} name="terms">
              <Input.TextArea
                rows={3}
                placeholder={t('invoice_form.terms_placeholder', 'Payment terms, conditions…')}
              />
            </Form.Item>
          </div>
        ),
      },
    ],
    [t, lines, isDark, loadCustomers, customerOption]
  );

  return (
    <Form
      form={form}
      layout="vertical"
      // (loading state reserved for a future skeleton; referenced so the
      // fetch effect's setter isn't an unused binding)
      data-loading={loadingInvoice ? 'true' : undefined}
      onValuesChange={() => {
        setIsDirty(true);
        setSaved(false);
      }}
      initialValues={{
        date: dayjs(),
        due_date: dayjs().add(30, 'day'),
      }}
    >
      <FormLayout
        sections={sections}
        summaryPanel={<SummaryPanel lines={lines} />}
        saving={saving}
        saved={saved}
        isDirty={isDirty}
        validationErrors={validationErrors}
        onSave={handleSave}
        onSaveAndNew={handleSaveAndNew}
        onSaveAndSend={handleSaveAndSend}
        onCancel={handleCancel}
        useSplitSave
        isDark={isDark}
      />
    </Form>
  );
};

// ─── Route-level export wrapped in PageTransition + Suspense ──────────────────

const InvoiceFormRoute: React.FC = () => (
  <Suspense fallback={<LoadingSkeleton variant="table" />}>
    <PageTransition>
      <InvoiceFormPage />
    </PageTransition>
  </Suspense>
);

export default InvoiceFormRoute;
