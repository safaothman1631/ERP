import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Button, Select, DatePicker, Space } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import dayjs from 'dayjs';
import { FormLayout, type FormSection } from '../design-system';
import { useAuthStore } from '../store';
import { ResponsiveForm } from '../components/responsive/ResponsiveForm';
import ChatterWidget from '../components/chatter/ChatterWidget';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';

interface LineRow {
  key: number;
  description: string;
  quantity: number;
  rate: number;
  account_id: string | null;
  tax_id: string | null;
}

const BillForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [form] = Form.useForm();
  const isDark = useAuthStore((s) => s.theme === 'dark');
  // NOTE: Vendor selector migrated to SelectWithQuickCreate (entity="vendor"), which
  // fetches its own options. Accounts/taxes for line items remain local for now —
  // a future EP-2/EP-3 task should migrate the line-item account+tax selectors too.
  const [accounts, setAccounts] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [lines, setLines] = useState<LineRow[]>([
    { key: 0, description: '', quantity: 1, rate: 0, account_id: null, tax_id: null },
  ]);
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/api/accounts')
      .then(r => setAccounts(r.data || [])).catch(() => {});
    api.get('/api/taxes')
      .then(r => setTaxes(r.data?.items || r.data || [])).catch(() => {});
  }, []);

  const addLine = () => {
    setLines([...lines, { key: Date.now(), description: '', quantity: 1, rate: 0, account_id: null, tax_id: null }]);
    setIsDirty(true);
  };

  const removeLine = (key: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter(l => l.key !== key));
    setIsDirty(true);
  };

  const updateLine = (key: number, field: keyof LineRow, value: any) => {
    setIsDirty(true);
    setLines(lines.map(l => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const calcTotal = () => lines.reduce((s, l) => s + (l.quantity || 0) * (l.rate || 0), 0);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
        contact_id: values.contact_id,
        date: values.date.format('YYYY-MM-DD'),
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null,
        reference: values.reference || '',
        currency_code: values.currency_code || 'IQD',
        notes: values.notes || '',
        lines: lines
          .filter(l => l.description || (l.rate || 0) > 0)
          .map(l => ({
            description: l.description,
            quantity: l.quantity || 1,
            rate: l.rate || 0,
            amount: (l.quantity || 1) * (l.rate || 0),
            account_id: l.account_id || null,
            tax_id: l.tax_id || null,
          })),
      };
      await api.post('/api/bills', payload);
      setSaved(true); setIsDirty(false);
      message.success(t('success'));
      setTimeout(() => navigate('/bills'), 400);
    } catch { message.error(t('error')); }
    finally { setLoading(false); }
  };

  const sections: FormSection[] = [
    {
      key: 'vendor',
      title: t('vendor'),
      children: (
        <Space size="large" wrap>
          <Form.Item label={t('vendor')} name="contact_id" rules={[{ required: true, message: t('required_contact') }]} style={{ width: 300 }}>
            <SelectWithQuickCreate
              entity="vendor"
              showSearch
              optionFilterProp="label"
              placeholder={t('placeholder_vendor')}
            />
          </Form.Item>
          <Form.Item label={t('date')} name="date" rules={[{ required: true, message: t('required_date') }]}>
            <DatePicker placeholder={t('placeholder_date')} />
          </Form.Item>
          <Form.Item label={t('due_date')} name="due_date">
            <DatePicker placeholder={t('placeholder_due_date')} />
          </Form.Item>
          <Form.Item label={t('reference')} name="reference">
            <Input placeholder={t('placeholder_reference')} />
          </Form.Item>
        </Space>
      ),
    },
    {
      key: 'items',
      title: t('items'),
      children: (
        <>
          {lines.map(line => (
            <ResponsiveForm.LineItem
              key={line.key}
              summary={
                <span>
                  {line.description || t('items')}
                  {' — '}
                  {((line.quantity || 0) * (line.rate || 0)).toLocaleString()} IQD
                </span>
              }
            >
              <Space size="middle" wrap style={{ width: '100%' }}>
                <div style={{ minWidth: 200, flex: 1 }}>
                  <label>{t('description')}</label>
                  <Input value={line.description} onChange={e => updateLine(line.key, 'description', e.target.value)} />
                </div>
                <div style={{ minWidth: 200, flex: 1 }}>
                  <label>{t('account')}</label>
                  <Select
                    style={{ width: '100%' }}
                    value={line.account_id || undefined}
                    onChange={v => updateLine(line.key, 'account_id', v)}
                    options={accounts.map((a: any) => ({ label: `${a.code} - ${a.name}`, value: a.id }))}
                    showSearch optionFilterProp="label" allowClear
                  />
                </div>
                <div style={{ minWidth: 100 }}>
                  <label>{t('quantity')}</label>
                  <InputNumber min={0} value={line.quantity} onChange={v => updateLine(line.key, 'quantity', v || 1)} style={{ width: '100%' }} />
                </div>
                <div style={{ minWidth: 120 }}>
                  <label>{t('rate')}</label>
                  <InputNumber min={0} value={line.rate} onChange={v => updateLine(line.key, 'rate', v || 0)} style={{ width: '100%' }} />
                </div>
                <div style={{ minWidth: 80, textAlign: 'center' }}>
                  <label>{t('amount')}</label>
                  <div>{((line.quantity || 0) * (line.rate || 0)).toLocaleString()}</div>
                </div>
                <div style={{ minWidth: 120 }}>
                  <label>{t('tax')}</label>
                  <Select
                    style={{ width: '100%' }}
                    value={line.tax_id || undefined}
                    onChange={v => updateLine(line.key, 'tax_id', v)}
                    options={taxes.map((tx: any) => ({ label: tx.name, value: tx.id }))}
                    allowClear
                  />
                </div>
                <Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeLine(line.key)} disabled={lines.length <= 1} />
              </Space>
            </ResponsiveForm.LineItem>
          ))}
          <Button type="dashed" onClick={addLine} icon={<PlusOutlined />} style={{ marginBottom: 16 }}>{t('add_line')}</Button>
          <div style={{ textAlign: 'start', fontSize: 18, fontWeight: 'bold' }}>
            {t('total')}: {calcTotal().toLocaleString()} IQD
          </div>
        </>
      ),
    },
    {
      key: 'notes',
      title: t('notes'),
      children: (
        <Form.Item label={t('notes')} name="notes" style={{ marginBottom: 0 }}>
          <Input.TextArea rows={3} placeholder={t('placeholder_notes')} />
        </Form.Item>
      ),
    },
    ...(id
      ? [
          {
            key: 'chatter',
            title: t('chatter.activities'),
            children: <ChatterWidget entityType="bill" entityId={id} />,
          } as FormSection,
        ]
      : []),
  ];

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      onValuesChange={() => setIsDirty(true)}
      initialValues={{ date: dayjs(), due_date: dayjs().add(30, 'day'), currency_code: 'IQD' }}
    >
      <FormLayout
        sections={sections}
        saving={loading}
        saved={saved}
        isDirty={isDirty}
        onSave={() => form.submit()}
        onCancel={() => navigate('/bills')}
        isDark={isDark}
      />
    </Form>
  );
};

export default BillForm;
