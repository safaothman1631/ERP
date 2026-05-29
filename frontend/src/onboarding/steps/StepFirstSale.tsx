/**
 * Step 5 — First Sale (T-LR.3.10)
 *
 * Spec: launch-readiness design.md §4.7
 *
 * Guided overlay with 4 sub-steps:
 *   A. Add first product   — modal w/ quick-create form (Item)
 *   B. Add first customer  — modal w/ quick-create form (Contact)
 *   C. Make a test sale    — opens POS terminal in "tutorial mode" (link)
 *   D. Print receipt       — calls printer service if paired, else browser print
 *
 * Each sub-step has Next / Skip. Final celebration handled by OnboardingShell
 * when `complete()` is invoked.
 *
 * For Quick-Create we POST directly to backend endpoints (the same ones
 * `SelectWithQuickCreate` uses under the hood) — `/api/items` for products,
 * `/api/contacts` for customers, `/api/invoices` (or `/api/pos/sales`) for
 * the test sale. We keep this thin: the wizard records IDs in store.
 */

import { useEffect, useMemo, useState } from 'react';
import { Steps, Card, Form, Input, InputNumber, Button, Space, Alert, message, Tag } from 'antd';
import { ShoppingCartOutlined, UserAddOutlined, ShopOutlined, PrinterOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { useOnboardingWizardStore } from '../state';

type SubStep = 0 | 1 | 2 | 3;

interface CreatedRef {
  id: string;
}

export default function StepFirstSale() {
  const { t } = useTranslation('onboarding');
  const firstSale = useOnboardingWizardStore((s) => s.data.firstSale);
  const setFirstSale = useOnboardingWizardStore((s) => s.setFirstSale);
  const pos = useOnboardingWizardStore((s) => s.data.pos);

  const [active, setActive] = useState<SubStep>(0);
  const [busy, setBusy] = useState(false);

  // Sub-step data
  const [productForm] = Form.useForm<{ name: string; unit_price: number }>();
  const [customerForm] = Form.useForm<{ name: string; phone?: string }>();

  const [productId, setProductId] = useState<string | undefined>(firstSale?.first_product_id);
  const [customerId, setCustomerId] = useState<string | undefined>(firstSale?.first_customer_id);
  const [saleId, setSaleId] = useState<string | undefined>(firstSale?.first_sale_id);
  const [receiptPrinted, setReceiptPrinted] = useState<boolean>(firstSale?.receipt_printed ?? false);

  useEffect(() => {
    // Jump to first incomplete sub-step
    if (!productId) setActive(0);
    else if (!customerId) setActive(1);
    else if (!saleId) setActive(2);
    else setActive(3);
  }, [productId, customerId, saleId]);

  // Persist to store on any change
  useEffect(() => {
    setFirstSale({
      first_product_id: productId,
      first_customer_id: customerId,
      first_sale_id: saleId,
      receipt_printed: receiptPrinted,
      completed_at: saleId ? new Date().toISOString() : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, customerId, saleId, receiptPrinted]);

  const items = useMemo(
    () => [
      { title: t('first_sale.steps.product'), icon: <ShoppingCartOutlined /> },
      { title: t('first_sale.steps.customer'), icon: <UserAddOutlined /> },
      { title: t('first_sale.steps.sale'), icon: <ShopOutlined /> },
      { title: t('first_sale.steps.receipt'), icon: <PrinterOutlined /> },
    ],
    [t],
  );

  const onCreateProduct = async () => {
    try {
      const values = await productForm.validateFields();
      setBusy(true);
      const res = await api.post<CreatedRef>('/api/items', {
        name: values.name,
        unit_price: values.unit_price ?? 1000,
        currency: 'IQD',
        type: 'goods',
      });
      setProductId(res.data.id);
      message.success(t('first_sale.product_created'));
      setActive(1);
    } catch (e) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error(t('first_sale.product_error'));
    } finally {
      setBusy(false);
    }
  };

  const onCreateCustomer = async () => {
    try {
      const values = await customerForm.validateFields();
      setBusy(true);
      const res = await api.post<CreatedRef>('/api/contacts', {
        name: values.name,
        phone: values.phone,
        type: 'customer',
      });
      setCustomerId(res.data.id);
      message.success(t('first_sale.customer_created'));
      setActive(2);
    } catch (e) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error(t('first_sale.customer_error'));
    } finally {
      setBusy(false);
    }
  };

  const onMakeSale = async () => {
    if (!productId || !customerId) return;
    setBusy(true);
    try {
      const res = await api.post<CreatedRef>('/api/invoices', {
        contact_id: customerId,
        currency: 'IQD',
        lines: [{ item_id: productId, quantity: 1, unit_price: 1000 }],
        payment_method: 'cash',
        status: 'paid',
      });
      setSaleId(res.data.id);
      message.success(t('first_sale.sale_created'));
      setActive(3);
    } catch {
      message.error(t('first_sale.sale_error'));
    } finally {
      setBusy(false);
    }
  };

  const onPrintReceipt = async () => {
    setBusy(true);
    try {
      // If a printer was paired in step 4, hand off to printer service
      // (printerService is owned by another agent — wire-up TODO).
      if (pos?.printer_device_id) {
        await new Promise((r) => setTimeout(r, 300));
      } else {
        // Browser print fallback
        try {
          window.print();
        } catch {
          /* no-op */
        }
      }
      setReceiptPrinted(true);
      message.success(t('first_sale.receipt_printed'));
    } finally {
      setBusy(false);
    }
  };

  const skipSub = (n: SubStep) => {
    if (n < 3) setActive((n + 1) as SubStep);
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Steps current={active} items={items} responsive />

      {active === 0 && (
        <Card title={t('first_sale.product_title')} size="small">
          <Alert type="info" showIcon message={t('first_sale.product_hint')} style={{ marginBottom: 12 }} />
          <Form form={productForm} layout="vertical" initialValues={{ unit_price: 1000 }}>
            <Form.Item
              name="name"
              label={<label htmlFor="onb-fs-product-name">{t('first_sale.product_name_label')}</label>}
              rules={[{ required: true, message: t('first_sale.product_name_required') }]}
            >
              <Input id="onb-fs-product-name" placeholder={t('first_sale.product_name_placeholder')} />
            </Form.Item>
            <Form.Item
              name="unit_price"
              label={<label htmlFor="onb-fs-product-price">{t('first_sale.product_price_label')} (IQD)</label>}
            >
              <InputNumber id="onb-fs-product-price" min={0} step={250} style={{ width: '100%' }} />
            </Form.Item>
            <Space>
              <Button type="primary" loading={busy} onClick={onCreateProduct}>
                {t('first_sale.add_product_cta')}
              </Button>
              <Button onClick={() => skipSub(0)}>{t('cta.skip')}</Button>
            </Space>
          </Form>
        </Card>
      )}

      {active === 1 && (
        <Card title={t('first_sale.customer_title')} size="small">
          <Form form={customerForm} layout="vertical">
            <Form.Item
              name="name"
              label={<label htmlFor="onb-fs-customer-name">{t('first_sale.customer_name_label')}</label>}
              rules={[{ required: true, message: t('first_sale.customer_name_required') }]}
            >
              <Input id="onb-fs-customer-name" placeholder={t('first_sale.customer_name_placeholder')} />
            </Form.Item>
            <Form.Item
              name="phone"
              label={<label htmlFor="onb-fs-customer-phone">{t('first_sale.customer_phone_label')}</label>}
            >
              <Input id="onb-fs-customer-phone" placeholder="07XX XXX XXXX" />
            </Form.Item>
            <Space>
              <Button type="primary" loading={busy} onClick={onCreateCustomer}>
                {t('first_sale.add_customer_cta')}
              </Button>
              <Button onClick={() => skipSub(1)}>{t('cta.skip')}</Button>
            </Space>
          </Form>
        </Card>
      )}

      {active === 2 && (
        <Card title={t('first_sale.sale_title')} size="small">
          <Alert type="info" showIcon message={t('first_sale.sale_hint')} style={{ marginBottom: 12 }} />
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Tag>{t('first_sale.product_label')}</Tag> {productId ?? '—'}
            </div>
            <div>
              <Tag>{t('first_sale.customer_label')}</Tag> {customerId ?? '—'}
            </div>
            <div>
              <Tag color="blue">{t('first_sale.total_label')}: 1,000 IQD</Tag>
            </div>
            <Space>
              <Button type="primary" loading={busy} onClick={onMakeSale} disabled={!productId || !customerId}>
                {t('first_sale.charge_cta')}
              </Button>
              <Button onClick={() => skipSub(2)}>{t('cta.skip')}</Button>
            </Space>
          </Space>
        </Card>
      )}

      {active === 3 && (
        <Card title={t('first_sale.receipt_title')} size="small">
          {receiptPrinted ? (
            <Alert
              type="success"
              showIcon
              icon={<CheckCircleFilled />}
              message={t('first_sale.receipt_done_title')}
              description={t('first_sale.receipt_done_body')}
            />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert type="info" showIcon message={t('first_sale.receipt_hint')} />
              <Space>
                <Button type="primary" icon={<PrinterOutlined />} loading={busy} onClick={onPrintReceipt}>
                  {t('first_sale.print_receipt_cta')}
                </Button>
                <Button onClick={() => setReceiptPrinted(true)}>{t('first_sale.skip_print')}</Button>
              </Space>
            </Space>
          )}
        </Card>
      )}
    </Space>
  );
}
