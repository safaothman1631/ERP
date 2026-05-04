import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Select, Space, Switch } from 'antd';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { FormLayout, type FormSection } from '../design-system';
import { useAuthStore } from '../store';

type ApiListResponse<T> = T[] | { items?: T[] } | null | undefined;

interface AccountOption {
  id: string;
  code?: string;
  name?: string;
}

interface TaxOption {
  id: string;
  name?: string;
}

const toList = <T,>(data: ApiListResponse<T>): T[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const ItemForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [form] = Form.useForm();
  const isDark = useAuthStore((s) => s.theme === 'dark');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [taxes, setTaxes] = useState<TaxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<ApiListResponse<AccountOption>>('/api/accounts').then(r => setAccounts(toList(r.data))).catch(() => {});
    api.get<ApiListResponse<TaxOption>>('/api/taxes/rates').then(r => setTaxes(toList(r.data))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    api.get(`/api/items/${id}`).then(r => form.setFieldsValue(r.data)).catch(() => {});
  }, [id, form]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const payload = { ...values };
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
      if (id) {
        await api.put(`/api/items/${id}`, payload);
      } else {
        await api.post('/api/items', payload);
      }
      setSaved(true); setIsDirty(false);
      message.success(t('success'));
      setTimeout(() => navigate('/items'), 400);
    } catch { message.error(t('error')); }
    finally { setLoading(false); }
  };

  const sections: FormSection[] = [
    {
      key: 'basic',
      title: t('basic_info', 'Basic Info'),
      children: (
        <Space size="large" wrap style={{ width: '100%' }}>
          <Form.Item label={t('name')} name="name" rules={[{ required: true, message: t('required_name') }]} style={{ width: 320 }}>
            <Input placeholder={t('placeholder_item_name')} />
          </Form.Item>
          <Form.Item label={t('sku')} name="sku" style={{ width: 200 }}>
            <Input placeholder={t('placeholder_sku')} />
          </Form.Item>
          <Form.Item label={t('item_type', 'Item Type')} name="item_type" style={{ width: 200 }}>
            <Select
              options={[
                { value: 'goods', label: t('goods', 'Goods') },
                { value: 'service', label: t('service', 'Service') },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('unit', 'Unit')} name="unit" style={{ width: 160 }}>
            <Input placeholder="pcs" />
          </Form.Item>
          <Form.Item label={t('description')} name="description" style={{ width: '100%' }}>
            <Input.TextArea rows={2} placeholder={t('placeholder_description')} />
          </Form.Item>
        </Space>
      ),
    },
    {
      key: 'pricing',
      title: t('pricing', 'Pricing'),
      children: (
        <Space size="large" wrap>
          <Form.Item label={t('selling_price')} name="selling_price" style={{ width: 200 }}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder={t('placeholder_amount')} />
          </Form.Item>
          <Form.Item label={t('cost_price')} name="cost_price" style={{ width: 200 }}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder={t('placeholder_amount')} />
          </Form.Item>
          <Form.Item label={t('tax', 'Tax')} name="tax_id" style={{ width: 240 }}>
            <Select
              showSearch optionFilterProp="label" allowClear
              options={taxes.map((tx) => ({ label: tx.name || tx.id, value: tx.id }))}
              placeholder={t('placeholder_select')}
            />
          </Form.Item>
        </Space>
      ),
    },
    {
      key: 'accounting',
      title: t('accounting', 'Accounting'),
      children: (
        <Space size="large" wrap>
          <Form.Item label={t('income_account', 'Income Account')} name="income_account_id" style={{ width: 320 }}>
            <Select
              showSearch optionFilterProp="label" allowClear
              options={accounts.map((a) => ({ label: [a.code, a.name].filter(Boolean).join(' - ') || a.id, value: a.id }))}
              placeholder={t('placeholder_select')}
            />
          </Form.Item>
          <Form.Item label={t('expense_account', 'Expense Account')} name="expense_account_id" style={{ width: 320 }}>
            <Select
              showSearch optionFilterProp="label" allowClear
              options={accounts.map((a) => ({ label: [a.code, a.name].filter(Boolean).join(' - ') || a.id, value: a.id }))}
              placeholder={t('placeholder_select')}
            />
          </Form.Item>
        </Space>
      ),
    },
    {
      key: 'inventory',
      title: t('inventory', 'Inventory'),
      children: (
        <Space size="large" wrap>
          <Form.Item label={t('track_inventory', 'Track Inventory')} name="track_inventory" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label={t('opening_stock', 'Opening Stock')} name="opening_stock" style={{ width: 200 }}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('reorder_level', 'Reorder Level')} name="reorder_level" style={{ width: 200 }}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
      ),
    },
  ];

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      onValuesChange={() => setIsDirty(true)}
      initialValues={{ item_type: 'goods', selling_price: 0, cost_price: 0, unit: 'pcs', track_inventory: false }}
    >
      <FormLayout
        sections={sections}
        saving={loading}
        saved={saved}
        isDirty={isDirty}
        onSave={() => form.submit()}
        onCancel={() => navigate('/items')}
        isDark={isDark}
      />
    </Form>
  );
};

export default ItemForm;
