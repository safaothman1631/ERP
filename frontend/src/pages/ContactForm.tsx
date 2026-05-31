import React, { useEffect, useState } from 'react';
import { Form, Input, Select, Space } from 'antd';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { FormLayout, type FormSection } from '../design-system';
import { useAuthStore } from '../store';

const ContactForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [form] = Form.useForm();
  const isDark = useAuthStore((s) => s.theme === 'dark');
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/api/contacts/${id}`)
      .then(r => { form.setFieldsValue(r.data); })
      .catch(() => {});
  }, [id, form]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const payload = { ...values };
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
      if (id) {
        await api.put(`/api/contacts/${id}`, payload);
      } else {
        await api.post('/api/contacts', payload);
      }
      setSaved(true); setIsDirty(false);
      message.success(t('success'));
      setTimeout(() => navigate('/contacts'), 400);
    } catch { message.error(t('error')); }
    finally { setLoading(false); }
  };

  const sections: FormSection[] = [
    {
      key: 'basic',
      title: t('basic_info', 'Basic Info'),
      children: (
        <Space size="large" wrap style={{ width: '100%' }}>
          <Form.Item label={t('contact_type')} name="contact_type" rules={[{ required: true, message: t('required_field') }]} style={{ width: 200 }}>
            <Select placeholder={t('placeholder_select')}
              options={[
                { value: 'customer', label: t('customer') },
                { value: 'vendor', label: t('vendor') },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('display_name')} name="display_name" rules={[{ required: true, message: t('required_name') }]} style={{ width: 320 }}>
            <Input placeholder={t('placeholder_name')} />
          </Form.Item>
          <Form.Item label={t('company_name')} name="company_name" style={{ width: 320 }}>
            <Input placeholder={t('placeholder_company')} />
          </Form.Item>
        </Space>
      ),
    },
    {
      key: 'contact',
      title: t('contact_details', 'Contact Details'),
      children: (
        <Space size="large" wrap style={{ width: '100%' }}>
          <Form.Item label={t('email')} name="email" rules={[{ type: 'email', message: t('invalid_email') }]} style={{ width: 320 }}>
            <Input placeholder={t('placeholder_email')} />
          </Form.Item>
          <Form.Item label={t('phone')} name="phone" style={{ width: 240 }}>
            <Input placeholder={t('placeholder_phone')} />
          </Form.Item>
          <Form.Item label={t('mobile', 'Mobile')} name="mobile" style={{ width: 240 }}>
            <Input placeholder={t('placeholder_phone')} />
          </Form.Item>
          <Form.Item label={t('website', 'Website')} name="website" style={{ width: 320 }}>
            <Input placeholder="https://" />
          </Form.Item>
        </Space>
      ),
    },
    {
      key: 'address',
      title: t('address', 'Address'),
      children: (
        <>
          <Form.Item label={t('billing_address', 'Billing Address')} name="billing_address">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label={t('shipping_address', 'Shipping Address')} name="shipping_address" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'tax',
      title: t('tax_info', 'Tax Information'),
      children: (
        <Space size="large" wrap>
          <Form.Item label={t('tax_id', 'Tax ID')} name="tax_id" style={{ width: 240 }}>
            <Input />
          </Form.Item>
          <Form.Item label={t('currency_code', 'Currency')} name="currency_code" style={{ width: 160 }}>
            <Select
              options={[
                { value: 'IQD', label: 'IQD' },
                { value: 'USD', label: 'USD' },
                { value: 'EUR', label: 'EUR' },
              ]}
              defaultValue="IQD"
            />
          </Form.Item>
        </Space>
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
      initialValues={{ contact_type: 'customer', currency_code: 'IQD' }}
    >
      <FormLayout
        sections={sections}
        saving={loading}
        saved={saved}
        isDirty={isDirty}
        onSave={() => form.submit()}
        onCancel={() => navigate('/contacts')}
        isDark={isDark}
      />
    </Form>
  );
};

export default ContactForm;
