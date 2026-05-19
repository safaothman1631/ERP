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
import { ResponsiveForm } from '../components/responsive/ResponsiveForm';

const QuoteForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const isDark = useAuthStore((s) => s.theme === 'dark');
  const [contacts, setContacts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([{ key: 0, item_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0 }]);
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/api/contacts', { params: { page_size: 100, contact_type: 'customer' } }).then(r => setContacts(r.data.items || []));
    api.get('/api/items', { params: { page_size: 100 } }).then(r => setItems(r.data.items || []));
  }, []);

  const addLine = () => { setLines([...lines, { key: Date.now(), item_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0 }]); setIsDirty(true); };
  const removeLine = (key: number) => { setLines(lines.filter(l => l.key !== key)); setIsDirty(true); };

  const updateLine = (key: number, field: string, value: any) => {
    setIsDirty(true);
    setLines(lines.map(l => {
      if (l.key !== key) return l;
      const updated = { ...l, [field]: value };
      if (field === 'item_id') {
        const item = items.find(i => i.id === value);
        if (item) { updated.description = item.description || item.name; updated.unit_price = item.selling_price || 0; }
      }
      return updated;
    }));
  };

  const calcTotal = () => lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - l.discount_percent / 100), 0);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await api.post('/api/quotes', {
        contact_id: values.contact_id,
        date: values.date.format('YYYY-MM-DD'),
        expiry_date: values.expiry_date.format('YYYY-MM-DD'),
        reference: values.reference || '',
        currency_code: 'IQD',
        notes: values.notes || '',
        terms: values.terms || '',
        lines: lines.map(l => ({ item_id: l.item_id || null, description: l.description, quantity: l.quantity, unit_price: l.unit_price, discount_percent: l.discount_percent || 0, tax_id: null, account_id: null })),
      });
      setSaved(true); setIsDirty(false);
      message.success(t('success'));
      setTimeout(() => navigate('/quotes'), 400);
    } catch { message.error(t('error')); } finally { setLoading(false); }
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
          <Form.Item label={t('date')} name="date" rules={[{ required: true, message: t('required_date') }]}><DatePicker placeholder={t('placeholder_date')} /></Form.Item>
          <Form.Item label={t('expiry_date')} name="expiry_date" rules={[{ required: true, message: t('required_date') }]}><DatePicker placeholder={t('placeholder_end_date')} /></Form.Item>
          <Form.Item label={t('reference')} name="reference"><Input placeholder={t('placeholder_reference')} /></Form.Item>
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
                  {items.find(i => i.id === line.item_id)?.name || line.description || t('items')}
                  {' — '}
                  {(line.quantity * line.unit_price * (1 - line.discount_percent / 100)).toLocaleString()} IQD
                </span>
              }
            >
              <Space size="middle" wrap style={{ width: '100%' }}>
                <div style={{ minWidth: 200, flex: 1 }}>
                  <label>{t('items')}</label>
                  <Select style={{ width: '100%' }} value={line.item_id || undefined} onChange={v => updateLine(line.key, 'item_id', v)} options={items.map(i => ({ label: i.name, value: i.id }))} showSearch optionFilterProp="label" allowClear />
                </div>
                <div style={{ minWidth: 200, flex: 1 }}>
                  <label>{t('description')}</label>
                  <Input value={line.description} onChange={e => updateLine(line.key, 'description', e.target.value)} />
                </div>
                <div style={{ minWidth: 100 }}>
                  <label>{t('quantity')}</label>
                  <InputNumber min={1} value={line.quantity} onChange={v => updateLine(line.key, 'quantity', v || 1)} style={{ width: '100%' }} />
                </div>
                <div style={{ minWidth: 120 }}>
                  <label>{t('unit_price')}</label>
                  <InputNumber min={0} value={line.unit_price} onChange={v => updateLine(line.key, 'unit_price', v || 0)} style={{ width: '100%' }} />
                </div>
                <div style={{ minWidth: 80 }}>
                  <label>{t('discount')}%</label>
                  <InputNumber min={0} max={100} value={line.discount_percent} onChange={v => updateLine(line.key, 'discount_percent', v || 0)} style={{ width: '100%' }} />
                </div>
                <div style={{ minWidth: 80, textAlign: 'center' }}>
                  <label>{t('total')}</label>
                  <div>{(line.quantity * line.unit_price * (1 - line.discount_percent / 100)).toLocaleString()}</div>
                </div>
                <Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeLine(line.key)} />
              </Space>
            </ResponsiveForm.LineItem>
          ))}
          <Button type="dashed" onClick={addLine} icon={<PlusOutlined />} style={{ marginBottom: 16 }}>{t('add_line')}</Button>
          <div style={{ textAlign: 'start', fontSize: 18, fontWeight: 'bold' }}>{t('total')}: {calcTotal().toLocaleString()} IQD</div>
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
      initialValues={{ date: dayjs(), expiry_date: dayjs().add(30, 'day') }}
    >
      <FormLayout
        sections={sections}
        saving={loading}
        saved={saved}
        isDirty={isDirty}
        onSave={() => form.submit()}
        onCancel={() => navigate('/quotes')}
        isDark={isDark}
      />
    </Form>
  );
};

export default QuoteForm;
