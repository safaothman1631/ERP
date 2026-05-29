import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Select, DatePicker, Space } from 'antd';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import dayjs from 'dayjs';
import { FormLayout, type FormSection } from '../design-system';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { useAuthStore } from '../store';

const ExpenseForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const isDark = useAuthStore((s) => s.theme === 'dark');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/api/accounts').then(r => setAccounts(r.data || [])).catch(() => {});
    api.get('/api/contacts', { params: { contact_type: 'vendor', page_size: 200 } })
      .then(r => setVendors(r.data?.items || [])).catch(() => {});
    api.get('/api/projects').then(r => setProjects(r.data?.items || r.data || [])).catch(() => {});
    api.get('/api/taxes').then(r => setTaxes(r.data?.items || r.data || [])).catch(() => {});
  }, []);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
        date: values.date.format('YYYY-MM-DD'),
        amount: values.amount,
        account_id: values.account_id,
        contact_id: values.contact_id || null,
        project_id: values.project_id || null,
        tax_id: values.tax_id || null,
        reference: values.reference || '',
        description: values.description || '',
        currency_code: values.currency_code || 'IQD',
        exchange_rate: values.exchange_rate || 1,
      };
      await api.post('/api/expenses', payload);
      setSaved(true); setIsDirty(false);
      message.success(t('success'));
      setTimeout(() => navigate('/expenses'), 400);
    } catch { message.error(t('error')); }
    finally { setLoading(false); }
  };

  const sections: FormSection[] = [
    {
      key: 'basic',
      title: t('expense_details', 'Expense Details'),
      children: (
        <Space size="large" wrap style={{ width: '100%' }}>
          <Form.Item label={t('date')} name="date" rules={[{ required: true, message: t('required_date') }]}>
            <DatePicker placeholder={t('placeholder_date')} />
          </Form.Item>
          <Form.Item label={t('amount')} name="amount" rules={[{ required: true, message: t('required_amount') }]} style={{ width: 200 }}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder={t('placeholder_amount')} />
          </Form.Item>
          <Form.Item label={t('account')} name="account_id" rules={[{ required: true, message: t('required_account') }]} style={{ width: 320 }}>
            <Select
              showSearch optionFilterProp="label"
              options={accounts.map((a: any) => ({ label: `${a.code} - ${a.name}`, value: a.id }))}
              placeholder={t('placeholder_select')}
            />
          </Form.Item>
          <Form.Item label={t('reference')} name="reference" style={{ width: 240 }}>
            <Input placeholder={t('placeholder_reference')} />
          </Form.Item>
        </Space>
      ),
    },
    {
      key: 'links',
      title: t('related', 'Related'),
      children: (
        <Space size="large" wrap>
          <Form.Item label={t('vendor')} name="contact_id" style={{ width: 320 }}>
            <SelectWithQuickCreate entity="vendor" showSearch allowClear placeholder={t('placeholder_vendor')} />
          </Form.Item>
          <Form.Item label={t('project', 'Project')} name="project_id" style={{ width: 320 }}>
            <Select
              showSearch optionFilterProp="label" allowClear
              options={projects.map((p: any) => ({ label: p.name, value: p.id }))}
              placeholder={t('placeholder_select')}
            />
          </Form.Item>
          <Form.Item label={t('tax', 'Tax')} name="tax_id" style={{ width: 240 }}>
            <Select
              showSearch optionFilterProp="label" allowClear
              options={taxes.map((tx: any) => ({ label: tx.name, value: tx.id }))}
              placeholder={t('placeholder_select')}
            />
          </Form.Item>
        </Space>
      ),
    },
    {
      key: 'notes',
      title: t('notes'),
      children: (
        <Form.Item label={t('description')} name="description" style={{ marginBottom: 0 }}>
          <Input.TextArea rows={3} placeholder={t('placeholder_description')} />
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
      initialValues={{ date: dayjs(), currency_code: 'IQD', exchange_rate: 1 }}
    >
      <FormLayout
        sections={sections}
        saving={loading}
        saved={saved}
        isDirty={isDirty}
        onSave={() => form.submit()}
        onCancel={() => navigate('/expenses')}
        isDark={isDark}
      />
    </Form>
  );
};

export default ExpenseForm;
