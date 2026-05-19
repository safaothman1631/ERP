/**
 * BillForm — representative form page template for Bill (vendor invoice) entity.
 *
 * Features:
 *   - Two-column FormLayout (main form 8 cols + sticky summary panel 4 cols)
 *   - EditableLineItems with drag-reorder and keyboard navigation
 *   - useAutoSave (every 30 seconds via draftsStore)
 *   - Unsaved-changes guard (React Router useBlocker + beforeunload)
 *   - Inline validation + summary banner listing all errors
 *   - Split save button (Save / Save & New)
 *   - Wrapped in <PageTransition> and <Suspense>
 *
 * Requirements: 15.1–15.7
 */
import React, { Suspense, useCallback, useMemo, useState } from 'react';
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

interface BillLineItem extends LineItem {
  account_id: string;
  description: string;
  quantity: number;
  rate: number;
  tax_rate: number;
}

interface BillFormValues {
  contact_id: string;
  date: dayjs.Dayjs;
  due_date: dayjs.Dayjs;
  bill_number: string;
  notes: string;
}

// ─── Line item column definitions ─────────────────────────────────────────────

const LINE_COLUMNS: LineItemColumn<BillLineItem>[] = [
  { key: 'description', title: 'Description', type: 'text' },
  { key: 'quantity', title: 'Qty', type: 'number', width: 80, min: 0, precision: 2 },
  { key: 'rate', title: 'Rate', type: 'money', width: 120, min: 0, precision: 2 },
  { key: 'tax_rate', title: 'Tax %', type: 'number', width: 80, min: 0, precision: 2 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _lineIdCounter = 0;
function newBillLine(): BillLineItem {
  return {
    id: `bill-line-${Date.now()}-${++_lineIdCounter}`,
    account_id: '',
    description: '',
    quantity: 1,
    rate: 0,
    tax_rate: 0,
  };
}

function calcLineAmount(line: BillLineItem): number {
  return line.quantity * line.rate;
}

function calcTotals(lines: BillLineItem[]) {
  const subtotal = lines.reduce((s, l) => s + calcLineAmount(l), 0);
  const tax = lines.reduce((s, l) => {
    return s + calcLineAmount(l) * (l.tax_rate / 100);
  }, 0);
  return { subtotal, tax, total: subtotal + tax };
}

// ─── Summary Panel ────────────────────────────────────────────────────────────

interface SummaryPanelProps {
  lines: BillLineItem[];
  isDark: boolean;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({ lines, isDark }) => {
  const { t } = useTranslation();
  const { subtotal, tax, total } = calcTotals(lines);

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
  };

  const labelStyle: React.CSSProperties = {
    color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)',
    fontSize: 13,
  };

  const totalStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 16,
    color: isDark ? '#fff' : '#0f172a',
  };

  return (
    <div>
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
        {t('bill_form.summary', 'Bill Summary')}
      </Text>

      <div style={rowStyle}>
        <span style={labelStyle}>{t('bill_form.subtotal', 'Subtotal')}</span>
        <MoneyDisplay amount={subtotal} currency="IQD" />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>{t('bill_form.tax', 'Tax')}</span>
        <MoneyDisplay amount={tax} currency="IQD" />
      </div>

      <Divider style={{ margin: '8px 0' }} />

      <div style={rowStyle}>
        <span style={totalStyle}>{t('bill_form.total', 'Amount Due')}</span>
        <span style={totalStyle}>
          <MoneyDisplay amount={total} currency="IQD" />
        </span>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)' }}>
        {t('bill_form.line_count', '{{n}} line(s)', { n: lines.length })}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const BillFormPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isDark = useAuthStore((s) => s.theme === 'dark');

  const [form] = Form.useForm<BillFormValues>();
  const [lines, setLines] = useState<BillLineItem[]>([newBillLine()]);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  const formValues = useMemo(
    () => ({ ...form.getFieldsValue(), lines }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines]
  );
  useAutoSave('bill', id ?? 'new', formValues);

  // ── Entity loaders ─────────────────────────────────────────────────────────
  const loadVendors = useCallback(async (query: string): Promise<EntityOption[]> => {
    try {
      const res = await api.get('/api/contacts', {
        params: { search: query, contact_type: 'vendor', page_size: 20 },
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

  const loadAccounts = useCallback(async (query: string): Promise<EntityOption[]> => {
    try {
      const res = await api.get('/api/accounts', {
        params: { search: query, page_size: 20 },
      });
      return (res.data ?? []).map((a: { id: string; code: string; name: string }) => ({
        value: a.id,
        label: `${a.code} — ${a.name}`,
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
      errors.push({ field: t('bill_form.vendor', 'Vendor'), message: t('validation.required', 'This field is required') });
    }
    if (!values.date) {
      errors.push({ field: t('bill_form.date', 'Bill Date'), message: t('validation.required', 'This field is required') });
    }
    if (lines.length === 0) {
      errors.push({ field: t('bill_form.line_items', 'Line Items'), message: t('validation.at_least_one_line', 'At least one line item is required') });
    }
    lines.forEach((line, idx) => {
      if (!line.description) {
        errors.push({
          field: `${t('bill_form.line', 'Line')} ${idx + 1}`,
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
        bill_number: values.bill_number ?? '',
        notes: values.notes ?? '',
        currency_code: 'IQD',
        lines: lines.map((l) => ({
          account_id: l.account_id || null,
          description: l.description,
          quantity: l.quantity,
          rate: l.rate,
          tax_rate: l.tax_rate,
          amount: calcLineAmount(l),
        })),
      };

      if (id) {
        await api.put(`/api/bills/${id}`, payload);
      } else {
        await api.post('/api/bills', payload);
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
      setTimeout(() => navigate('/bills'), 400);
    }
  }, [doSave, navigate]);

  const handleSaveAndNew = useCallback(async () => {
    const ok = await doSave();
    if (ok) {
      form.resetFields();
      setLines([newBillLine()]);
      setIsDirty(false);
      setSaved(false);
    }
  }, [doSave, form]);

  const handleCancel = useCallback(() => {
    navigate('/bills');
  }, [navigate]);

  // ── Form sections ──────────────────────────────────────────────────────────
  const sections: FormSection[] = useMemo(
    () => [
      {
        key: 'header',
        title: t('bill_form.section_header', 'Bill Details'),
        description: t('bill_form.section_header_desc', 'Vendor, dates, and bill reference'),
        children: (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <Form.Item
              label={t('bill_form.vendor', 'Vendor')}
              name="contact_id"
              rules={[{ required: true, message: t('validation.required', 'Required') }]}
              style={{ gridColumn: '1 / -1' }}
            >
              <EntitySelect
                loadOptions={loadVendors}
                ariaLabel={t('bill_form.vendor', 'Vendor')}
                placeholder={t('bill_form.vendor_placeholder', 'Search vendors…')}
                onCreateNew={(query) => navigate(`/contacts/new?type=vendor&name=${encodeURIComponent(query)}`)}
                createNewLabel={t('bill_form.create_vendor', 'Create new vendor')}
              />
            </Form.Item>

            <Form.Item
              label={t('bill_form.date', 'Bill Date')}
              name="date"
              rules={[{ required: true, message: t('validation.required', 'Required') }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label={t('bill_form.due_date', 'Due Date')}
              name="due_date"
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label={t('bill_form.bill_number', "Vendor's Bill #")}
              name="bill_number"
            >
              <Input placeholder={t('bill_form.bill_number_placeholder', "Vendor's reference number")} />
            </Form.Item>

            <Form.Item label={t('bill_form.currency', 'Currency')}>
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
        title: t('bill_form.section_lines', 'Expense Lines'),
        description: t('bill_form.section_lines_desc', 'Expenses and charges on this bill'),
        children: (
          <EditableLineItems<BillLineItem>
            value={lines}
            onChange={(rows) => {
              setLines(rows);
              setIsDirty(true);
            }}
            columns={[
              ...LINE_COLUMNS,
              {
                key: 'account_id',
                title: t('bill_form.account', 'Account'),
                type: 'text',
                width: 160,
                render: (value, row) => (
                  <EntitySelect
                    value={value as string}
                    loadOptions={loadAccounts}
                    ariaLabel={t('bill_form.account', 'Account')}
                    placeholder={t('bill_form.account_placeholder', 'Select account…')}
                    onCreateNew={(query) => navigate(`/accounts/new?name=${encodeURIComponent(query)}`)}
                    createNewLabel={t('bill_form.create_account', 'Create account')}
                    onChange={(v) => {
                      setLines((prev) =>
                        prev.map((l) => (l.id === row.id ? { ...l, account_id: v as string } : l))
                      );
                      setIsDirty(true);
                    }}
                    style={{ minWidth: 140 }}
                  />
                ),
              },
            ]}
            newRow={newBillLine}
            addLabel={t('bill_form.add_line', 'Add expense line')}
            isDark={isDark}
          />
        ),
      },
      {
        key: 'footer',
        title: t('bill_form.section_footer', 'Notes'),
        children: (
          <Form.Item label={t('bill_form.notes', 'Notes')} name="notes">
            <Input.TextArea
              rows={3}
              placeholder={t('bill_form.notes_placeholder', 'Internal notes about this bill')}
            />
          </Form.Item>
        ),
      },
    ],
    [t, lines, isDark, loadVendors, loadAccounts]
  );

  return (
    <Form
      form={form}
      layout="vertical"
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
        summaryPanel={<SummaryPanel lines={lines} isDark={isDark} />}
        saving={saving}
        saved={saved}
        isDirty={isDirty}
        validationErrors={validationErrors}
        onSave={handleSave}
        onSaveAndNew={handleSaveAndNew}
        onCancel={handleCancel}
        useSplitSave
        isDark={isDark}
      />
    </Form>
  );
};

// ─── Route-level export wrapped in PageTransition + Suspense ──────────────────

const BillFormRoute: React.FC = () => (
  <Suspense fallback={<LoadingSkeleton variant="table" />}>
    <PageTransition>
      <BillFormPage />
    </PageTransition>
  </Suspense>
);

export default BillFormRoute;
