/**
 * PurchaseOrderForm — representative form page template for Purchase Order entity.
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
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Form, Input, DatePicker, Select, Divider, Typography, Tag } from 'antd';
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
import ChatterWidget from '../../../components/chatter/ChatterWidget';

const { Text } = Typography;

// ─── Types ────────────────────────────────────────────────────────────────────

interface POLineItem extends LineItem {
  item_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
}

interface POFormValues {
  contact_id: string;
  date: dayjs.Dayjs;
  expected_delivery_date: dayjs.Dayjs | null;
  reference: string;
  delivery_address: string;
  notes: string;
}

// ─── Line item column definitions ─────────────────────────────────────────────

const LINE_COLUMNS: LineItemColumn<POLineItem>[] = [
  { key: 'description', title: 'Description', type: 'text' },
  { key: 'quantity', title: 'Qty', type: 'number', width: 80, min: 0, precision: 2 },
  { key: 'unit_price', title: 'Unit Price', type: 'money', width: 120, min: 0, precision: 2 },
  { key: 'discount_percent', title: 'Disc %', type: 'number', width: 80, min: 0, precision: 2 },
  { key: 'tax_rate', title: 'Tax %', type: 'number', width: 80, min: 0, precision: 2 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _lineIdCounter = 0;
function newPOLine(): POLineItem {
  return {
    id: `po-line-${Date.now()}-${++_lineIdCounter}`,
    item_id: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    tax_rate: 0,
  };
}

function calcLineSubtotal(line: POLineItem): number {
  const sub = line.quantity * line.unit_price;
  return sub * (1 - line.discount_percent / 100);
}

function calcTotals(lines: POLineItem[]) {
  const subtotal = lines.reduce((s, l) => s + calcLineSubtotal(l), 0);
  const tax = lines.reduce((s, l) => {
    return s + calcLineSubtotal(l) * (l.tax_rate / 100);
  }, 0);
  return { subtotal, tax, total: subtotal + tax };
}

// ─── Summary Panel ────────────────────────────────────────────────────────────

interface SummaryPanelProps {
  lines: POLineItem[];
  isDark: boolean;
  status?: string;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({ lines, isDark, status = 'draft' }) => {
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

  const statusColorMap: Record<string, string> = {
    draft: 'default',
    issued: 'blue',
    received: 'green',
    billed: 'purple',
    cancelled: 'red',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong style={{ fontSize: 14 }}>
          {t('po_form.summary', 'PO Summary')}
        </Text>
        <Tag color={statusColorMap[status] ?? 'default'}>
          {t(`po_form.status_${status}`, status.charAt(0).toUpperCase() + status.slice(1))}
        </Tag>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>{t('po_form.subtotal', 'Subtotal')}</span>
        <MoneyDisplay amount={subtotal} currency="IQD" />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>{t('po_form.tax', 'Tax')}</span>
        <MoneyDisplay amount={tax} currency="IQD" />
      </div>

      <Divider style={{ margin: '8px 0' }} />

      <div style={rowStyle}>
        <span style={totalStyle}>{t('po_form.total', 'Total')}</span>
        <span style={totalStyle}>
          <MoneyDisplay amount={total} currency="IQD" />
        </span>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)' }}>
        {t('po_form.line_count', '{{n}} line(s)', { n: lines.length })}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PurchaseOrderFormPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isDark = useAuthStore((s) => s.theme === 'dark');

  const [form] = Form.useForm<POFormValues>();
  const [lines, setLines] = useState<POLineItem[]>([newPOLine()]);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  // Pre-seeded vendor option so the EntitySelect shows the vendor NAME when
  // editing/viewing an existing purchase order (not just the raw id).
  const [vendorOption, setVendorOption] = useState<EntityOption | undefined>(undefined);
  const [loadingPO, setLoadingPO] = useState(false);

  // ── Load the existing purchase order when editing/viewing (route has :id) ───
  // Previously the edit route rendered a BLANK form — there was no GET, so the
  // record's data never populated (the user's bug: "View shows no data").
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadingPO(true);
    (async () => {
      try {
        const res = await api.get(`/api/purchase-orders/${id}`);
        if (cancelled) return;
        const inv = res.data ?? {};
        const rawLines: any[] = inv.lines ?? inv.line_items ?? inv.items ?? [];
        form.setFieldsValue({
          contact_id: inv.contact_id ?? inv.vendor_id ?? undefined,
          date: inv.date ? dayjs(inv.date) : undefined,
          expected_delivery_date: inv.expected_delivery_date ? dayjs(inv.expected_delivery_date) : null,
          reference: inv.reference ?? inv.reference_number ?? '',
          delivery_address: inv.delivery_address ?? '',
          notes: inv.notes ?? '',
        } as Partial<POFormValues> as POFormValues);
        // Seed the vendor label so EntitySelect renders the name, not the id.
        // The PO payload only carries contact_id (no name), so when the name
        // isn't inlined we fetch the contact to resolve its display_name.
        const vendorId = inv.contact_id ?? inv.vendor_id;
        let vendorName: string | undefined = inv.contact_name ?? inv.vendor_name ?? inv.contact?.display_name;
        if (vendorId) {
          if (!vendorName) {
            try {
              const c = await api.get(`/api/contacts/${vendorId}`);
              vendorName = c.data?.display_name ?? c.data?.name;
            } catch { /* fall back to id below */ }
          }
          if (!cancelled) setVendorOption({ value: String(vendorId), label: vendorName ?? String(vendorId) });
        }
        if (rawLines.length > 0) {
          setLines(rawLines.map((l, i) => ({
            id: `po-line-${id}-${i}`,
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
        if (!cancelled) setLoadingPO(false);
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
  useAutoSave('purchaseOrder', id ?? 'new', formValues);

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

  const loadItems = useCallback(async (query: string): Promise<EntityOption[]> => {
    try {
      const res = await api.get('/api/items', {
        params: { search: query, page_size: 20 },
      });
      return (res.data.items ?? []).map((item: { id: string; name: string; sku?: string }) => ({
        value: item.id,
        label: item.name,
        description: item.sku,
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
      errors.push({ field: t('po_form.vendor', 'Vendor'), message: t('validation.required', 'This field is required') });
    }
    if (!values.date) {
      errors.push({ field: t('po_form.date', 'Order Date'), message: t('validation.required', 'This field is required') });
    }
    if (lines.length === 0) {
      errors.push({ field: t('po_form.line_items', 'Line Items'), message: t('validation.at_least_one_line', 'At least one line item is required') });
    }
    lines.forEach((line, idx) => {
      if (!line.description) {
        errors.push({
          field: `${t('po_form.line', 'Line')} ${idx + 1}`,
          message: t('validation.description_required', 'Description is required'),
        });
      }
      if (line.quantity <= 0) {
        errors.push({
          field: `${t('po_form.line', 'Line')} ${idx + 1}`,
          message: t('validation.quantity_positive', 'Quantity must be greater than 0'),
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
        expected_delivery_date: values.expected_delivery_date?.format('YYYY-MM-DD') ?? null,
        reference: values.reference ?? '',
        delivery_address: values.delivery_address ?? '',
        notes: values.notes ?? '',
        currency_code: 'IQD',
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
        await api.put(`/api/purchase-orders/${id}`, payload);
      } else {
        await api.post('/api/purchase-orders', payload);
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
      setTimeout(() => navigate('/purchase-orders'), 400);
    }
  }, [doSave, navigate]);

  const handleSaveAndNew = useCallback(async () => {
    const ok = await doSave();
    if (ok) {
      form.resetFields();
      setLines([newPOLine()]);
      setIsDirty(false);
      setSaved(false);
    }
  }, [doSave, form]);

  const handleCancel = useCallback(() => {
    navigate('/purchase-orders');
  }, [navigate]);

  // ── Form sections ──────────────────────────────────────────────────────────
  const sections: FormSection[] = useMemo(
    () => [
      {
        key: 'header',
        title: t('po_form.section_header', 'Order Details'),
        description: t('po_form.section_header_desc', 'Vendor, dates, and delivery information'),
        children: (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <Form.Item
              label={t('po_form.vendor', 'Vendor')}
              name="contact_id"
              rules={[{ required: true, message: t('validation.required', 'Required') }]}
              style={{ gridColumn: '1 / -1' }}
            >
              <EntitySelect
                loadOptions={loadVendors}
                initialOption={vendorOption}
                ariaLabel={t('po_form.vendor', 'Vendor')}
                placeholder={t('po_form.vendor_placeholder', 'Search vendors…')}
                onCreateNew={(query) => navigate(`/contacts/new?type=vendor&name=${encodeURIComponent(query)}`)}
                createNewLabel={t('po_form.create_vendor', 'Create new vendor')}
              />
            </Form.Item>

            <Form.Item
              label={t('po_form.date', 'Order Date')}
              name="date"
              rules={[{ required: true, message: t('validation.required', 'Required') }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label={t('po_form.expected_delivery', 'Expected Delivery')}
              name="expected_delivery_date"
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label={t('po_form.reference', 'Reference')}
              name="reference"
            >
              <Input placeholder={t('po_form.reference_placeholder', 'e.g. REQ-001')} />
            </Form.Item>

            <Form.Item label={t('po_form.currency', 'Currency')}>
              <Select defaultValue="IQD" disabled>
                <Select.Option value="IQD">IQD — Iraqi Dinar</Select.Option>
                <Select.Option value="USD">USD — US Dollar</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              label={t('po_form.delivery_address', 'Delivery Address')}
              name="delivery_address"
              style={{ gridColumn: '1 / -1' }}
            >
              <Input.TextArea
                rows={2}
                placeholder={t('po_form.delivery_address_placeholder', 'Delivery address or warehouse')}
              />
            </Form.Item>
          </div>
        ),
      },
      {
        key: 'line_items',
        title: t('po_form.section_lines', 'Order Lines'),
        description: t('po_form.section_lines_desc', 'Items and quantities to order'),
        children: (
          <EditableLineItems<POLineItem>
            value={lines}
            onChange={(rows) => {
              setLines(rows);
              setIsDirty(true);
            }}
            columns={[
              {
                key: 'item_id',
                title: t('po_form.item', 'Item'),
                type: 'text',
                width: 180,
                render: (value, row) => (
                  <EntitySelect
                    value={value as string}
                    loadOptions={loadItems}
                    ariaLabel={t('po_form.item', 'Item')}
                    placeholder={t('po_form.item_placeholder', 'Search items…')}
                    onCreateNew={(query) => navigate(`/items/new?name=${encodeURIComponent(query)}`)}
                    createNewLabel={t('po_form.create_item', 'Create new item')}
                    onChange={(v) => {
                      setLines((prev) =>
                        prev.map((l) => (l.id === row.id ? { ...l, item_id: v as string } : l))
                      );
                      setIsDirty(true);
                    }}
                    style={{ minWidth: 160 }}
                  />
                ),
              },
              ...LINE_COLUMNS,
            ]}
            newRow={newPOLine}
            addLabel={t('po_form.add_line', 'Add order line')}
            isDark={isDark}
          />
        ),
      },
      {
        key: 'footer',
        title: t('po_form.section_footer', 'Notes'),
        children: (
          <Form.Item label={t('po_form.notes', 'Notes')} name="notes">
            <Input.TextArea
              rows={3}
              placeholder={t('po_form.notes_placeholder', 'Special instructions, delivery notes…')}
            />
          </Form.Item>
        ),
      },
    ],
    [t, lines, isDark, loadVendors, loadItems, vendorOption]
  );

  return (
    <Form
      form={form}
      layout="vertical"
      // (loading state reserved for a future skeleton; referenced so the
      // fetch effect's setter isn't an unused binding)
      data-loading={loadingPO ? 'true' : undefined}
      onValuesChange={() => {
        setIsDirty(true);
        setSaved(false);
      }}
      initialValues={{
        date: dayjs(),
        expected_delivery_date: null,
      }}
    >
      <FormLayout
        sections={sections}
        summaryPanel={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SummaryPanel lines={lines} isDark={isDark} />
            {id && <ChatterWidget entityType="purchase_order" entityId={id} />}
          </div>
        }
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

const PurchaseOrderFormRoute: React.FC = () => (
  <Suspense fallback={<LoadingSkeleton variant="table" />}>
    <PageTransition>
      <PurchaseOrderFormPage />
    </PageTransition>
  </Suspense>
);

export default PurchaseOrderFormRoute;
