import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Button, Select, DatePicker, Space } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import dayjs from 'dayjs';
import { FormLayout, type FormSection } from '../design-system';
import { useAuthStore } from '../store';

const InvoiceForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const isDark = useAuthStore((s) => s.theme === 'dark');
  const [contacts, setContacts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([{ key: 0, item_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0, tax_id: null, account_id: null }]);
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/api/contacts', { params: { page_size: 100, contact_type: 'customer' } }).then(r => setContacts(r.data.items || []));
    api.get('/api/items', { params: { page_size: 100 } }).then(r => setItems(r.data.items || []));
  }, []);

  const addLine = () => {
    setLines([...lines, { key: Date.now(), item_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0, tax_id: null, account_id: null }]);
    setIsDirty(true);
  };

  const removeLine = (key: number) => {
    setLines(lines.filter(l => l.key !== key));
    setIsDirty(true);
  };

  const updateLine = (key: number, field: string, value: any) => {
    setIsDirty(true);
    setLines(lines.map(l => {
      if (l.key !== key) return l;
      const updated = { ...l, [field]: value };
      if (field === 'item_id') {
        const item = items.find(i => i.id === value);
        if (item) {
          updated.description = item.description || item.name;
          updated.unit_price = item.selling_price || 0;
        }
      }
      return updated;
    }));
  };

  const calcTotal = () => lines.reduce((sum, l) => {
    const sub = l.quantity * l.unit_price;
    const disc = sub * (l.discount_percent / 100);
    return sum + sub - disc;
  }, 0);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
        contact_id: values.contact_id,
        date: values.date.format('YYYY-MM-DD'),
        due_date: values.due_date.format('YYYY-MM-DD'),
        reference: values.reference || '',
        currency_code: 'IQD',
        exchange_rate: 1,
        notes: values.notes || '',
        terms: values.terms || '',
        lines: lines.map(l => ({
          item_id: l.item_id || null,
          account_id: l.account_id || null,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_percent: l.discount_percent || 0,
          tax_id: l.tax_id || null,
        })),
      };
      await api.post('/api/invoices', payload);
      setSaved(true); setIsDirty(false);
      message.success(t('success'));
      setTimeout(() => navigate('/invoices'), 400);
    } catch { message.error(t('error')); }
    finally { setLoading(false); }
  };

  const sections: FormSection[] = [
    {
      key: 'customer',
      title: t('customer'),
      children: (
        <Space size="large" wrap>
          <Form.Item label={t('customer')} name="contact_id" rules={[{ required: true, message: t('required_contact') }]} style={{ width: 300 }}>
            <Select showSearch optionFilterProp="label" placeholder={t('placeholder_customer')} options={contacts.map(c => ({ label: c.display_name, value: c.id }))} />
          </Form.Item>
          <Form.Item label={t('date')} name="date" rules={[{ required: true, message: t('required_date') }]}>
            <DatePicker placeholder={t('placeholder_date')} />
          </Form.Item>
          <Form.Item label={t('due_date')} name="due_date" rules={[{ required: true, message: t('required_date') }]}>
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
          <table style={{ width: '100%', marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>{t('items')}</th>
                <th style={{ width: '25%' }}>{t('description')}</th>
                <th style={{ width: '10%' }}>{t('quantity')}</th>
                <th style={{ width: '15%' }}>{t('unit_price')}</th>
                <th style={{ width: '10%' }}>{t('discount')}%</th>
                <th style={{ width: '10%' }}>{t('total')}</th>
                <th style={{ width: '5%' }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key}>
                  <td style={{ padding: 4 }}>
                    <Select
                      style={{ width: '100%' }}
                      value={line.item_id || undefined}
                      onChange={(v) => updateLine(line.key, 'item_id', v)}
                      options={items.map(i => ({ label: i.name, value: i.id }))}
                      showSearch optionFilterProp="label"
                      allowClear
                    />
                  </td>
                  <td style={{ padding: 4 }}><Input value={line.description} onChange={(e) => updateLine(line.key, 'description', e.target.value)} /></td>
                  <td style={{ padding: 4 }}><InputNumber min={1} value={line.quantity} onChange={(v) => updateLine(line.key, 'quantity', v || 1)} style={{ width: '100%' }} /></td>
                  <td style={{ padding: 4 }}><InputNumber min={0} value={line.unit_price} onChange={(v) => updateLine(line.key, 'unit_price', v || 0)} style={{ width: '100%' }} /></td>
                  <td style={{ padding: 4 }}><InputNumber min={0} max={100} value={line.discount_percent} onChange={(v) => updateLine(line.key, 'discount_percent', v || 0)} style={{ width: '100%' }} /></td>
                  <td style={{ padding: 4, textAlign: 'center' }}>{((line.quantity * line.unit_price) * (1 - line.discount_percent / 100)).toLocaleString()}</td>
                  <td style={{ padding: 4 }}><Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeLine(line.key)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
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
  ];

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      onValuesChange={() => setIsDirty(true)}
      initialValues={{ date: dayjs(), due_date: dayjs().add(30, 'day') }}
    >
      <FormLayout
        sections={sections}
        saving={loading}
        saved={saved}
        isDirty={isDirty}
        onSave={() => form.submit()}
        onCancel={() => navigate('/invoices')}
        isDark={isDark}
      />
    </Form>
  );
};

export default InvoiceForm;
