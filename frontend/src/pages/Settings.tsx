import React, { useEffect, useState } from 'react';
import { Tabs, Table, Button, Tag, Modal, Form, Input, InputNumber, DatePicker, Space, Card, Row, Col, Popconfirm, Switch, Select, Divider, Statistic } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DownloadOutlined, CloudOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { useOnboardingStore } from '../onboarding/store';
import { INDUSTRIES, MODULES } from '../onboarding/industries';

const { RangePicker } = DatePicker;

type EInvoiceSummary = {
  generated: number;
  signed: number;
  submitted: number;
  accepted: number;
  rejected: number;
  cancelled: number;
};

type EInvoiceRecord = {
  id: string;
  invoice_number?: string;
  fiscal_id?: string;
  status?: string;
  provider_uuid?: string;
  error_message?: string;
  submitted_at?: string;
};

const emptyEInvoiceSummary: EInvoiceSummary = {
  generated: 0,
  signed: 0,
  submitted: 0,
  accepted: 0,
  rejected: 0,
  cancelled: 0,
};

const Settings: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Tabs defaultActiveKey="profile" items={[
      { key: 'profile', label: t('profile'), children: <ProfileSettings /> },
      { key: 'modules', label: 'مۆدیولەکان', children: <ModulesSettings /> },
      { key: 'organization', label: t('organization_settings'), children: <OrganizationSettings /> },
      { key: 'security', label: t('security_settings'), children: <SecurityPlaceholder /> },
      { key: 'notifications', label: t('notification_preferences'), children: <NotificationSettings /> },
      { key: 'einvoice', label: t('einvoice_settings'), children: <EInvoiceSettings /> },
      { key: 'fiscal', label: t('fiscal_years'), children: <FiscalYears /> },
      { key: 'budgets', label: t('budgets'), children: <Budgets /> },
      { key: 'currencies', label: t('currencies'), children: <Currencies /> },
      { key: 'email', label: t('email_settings'), children: <EmailSettings /> },
      { key: 'backup', label: t('backup_settings'), children: <BackupRestore /> },
      { key: 'activity', label: t('system_log'), children: <ActivityLog /> },
      { key: 'reminders', label: t('reminder_settings'), children: <ReminderSettings /> },
      { key: 'templates', label: t('invoice_templates'), children: <InvoiceTemplates /> },
      { key: 'system', label: t('system_info'), children: <SystemInfo /> },
    ]} />
  );
};

const EInvoiceSettings: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [summary, setSummary] = useState<EInvoiceSummary>(emptyEInvoiceSummary);
  const [errors, setErrors] = useState<EInvoiceRecord[]>([]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/einvoice/config');
      form.setFieldsValue(res.data);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    setReportLoading(true);
    try {
      const [monthlyRes, errorRes] = await Promise.all([
        api.get('/api/einvoice/report/monthly'),
        api.get('/api/einvoice/report/errors', { params: { limit: 20 } }),
      ]);
      setSummary({ ...emptyEInvoiceSummary, ...(monthlyRes.data.summary || {}) });
      setErrors(errorRes.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    void fetchConfig();
    void fetchReports();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      await api.put('/api/einvoice/config', values);
      message.success(t('success'));
      await fetchConfig();
      await fetchReports();
    } catch {
      message.error(t('error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title={t('einvoice_settings')}
        loading={loading}
        extra={<Button icon={<CloudOutlined />} onClick={() => { void fetchConfig(); void fetchReports(); }}>{t('refresh')}</Button>}
      >
        <Form form={form} layout="vertical">
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item label={t('iraq_einvoice_enabled')} name="enabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={t('preview_mode')} name="preview_mode" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={t('auto_submit_on_send')} name="auto_submit_on_send" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('portal_url')} name="portal_url">
                <Input placeholder={t('portal_url')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('status_url_template')} name="status_url_template">
                <Input placeholder={t('status_url_template')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('cancel_url')} name="cancel_url">
                <Input placeholder={t('cancel_url')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('iraq_seller_tax_id')} name="seller_tax_id">
                <Input placeholder={t('iraq_seller_tax_id')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('branch_code')} name="branch_code">
                <Input placeholder={t('branch_code')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('api_key')} name="api_key">
                <Input.Password placeholder={t('api_key')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('auth_token')} name="auth_token">
                <Input.Password placeholder={t('auth_token')} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t('private_key_pem')} name="private_key_pem">
                <Input.TextArea rows={6} placeholder={t('private_key_pem')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('private_key_password')} name="private_key_password">
                <Input.Password placeholder={t('private_key_password')} />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" onClick={handleSave} loading={saving}>{t('save')}</Button>
        </Form>
      </Card>

      <Card title={t('einvoice_compliance_overview')} loading={reportLoading}>
        <Row gutter={16}>
          <Col span={4}><Statistic title={t('generated')} value={summary.generated} /></Col>
          <Col span={4}><Statistic title={t('signed')} value={summary.signed} /></Col>
          <Col span={4}><Statistic title={t('submitted')} value={summary.submitted} /></Col>
          <Col span={4}><Statistic title={t('accepted')} value={summary.accepted} /></Col>
          <Col span={4}><Statistic title={t('rejected')} value={summary.rejected} styles={{ content: { color: summary.rejected > 0 ? '#dc2626' : undefined } }} /></Col>
          <Col span={4}><Statistic title={t('cancelled')} value={summary.cancelled} /></Col>
        </Row>
      </Card>

      <Card title={t('einvoice_errors')} loading={reportLoading}>
        <Table<EInvoiceRecord>
          dataSource={errors}
          rowKey="id"
          pagination={false}
          columns={[
            { title: '#', dataIndex: 'invoice_number', key: 'invoice_number' },
            { title: t('fiscal_id'), dataIndex: 'fiscal_id', key: 'fiscal_id' },
            { title: t('status'), dataIndex: 'status', key: 'status', render: (value: string | undefined) => <Tag color={value === 'rejected' ? 'red' : 'orange'}>{value || '-'}</Tag> },
            { title: t('error'), dataIndex: 'error_message', key: 'error_message', render: (value: string | undefined) => value || '-' },
            { title: t('date'), dataIndex: 'submitted_at', key: 'submitted_at', render: (value: string | undefined) => value?.substring(0, 19) || '-' },
          ]}
        />
      </Card>
    </Space>
  );
};

// --- Profile Settings ---
const ProfileSettings: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [pwForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/system/profile').then(r => {
      form.setFieldsValue(r.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const vals = await form.validateFields();
      await api.put('/api/system/profile', { display_name: vals.display_name, phone: vals.phone });
      message.success(t('success'));
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    setChangingPw(true);
    try {
      const vals = await pwForm.validateFields();
      if (vals.new_password !== vals.confirm_password) {
        message.error(t('confirm_password') + ' — ' + t('error'));
        return;
      }
      await api.put('/api/system/profile/password', {
        current_password: vals.current_password,
        new_password: vals.new_password,
      });
      message.success(t('success'));
      pwForm.resetFields();
    } catch { message.error(t('error')); } finally { setChangingPw(false); }
  };

  return (
    <Row gutter={24}>
      <Col span={12}>
        <Card title={t('profile_settings')} loading={loading}>
          <Form form={form} layout="vertical">
            <Form.Item label={t('email')} name="email">
              <Input disabled />
            </Form.Item>
            <Form.Item label={t('name')} name="display_name" rules={[{ required: true, message: t('required') }]}>
              <Input placeholder={t('name')} />
            </Form.Item>
            <Form.Item label={t('phone')} name="phone">
              <Input placeholder={t('phone')} />
            </Form.Item>
            <Button type="primary" onClick={handleSave} loading={saving}>{t('save')}</Button>
          </Form>
        </Card>
      </Col>
      <Col span={12}>
        <Card title={t('change_password')}>
          <Form form={pwForm} layout="vertical">
            <Form.Item label={t('current_password')} name="current_password" rules={[{ required: true, message: t('required') }]}>
              <Input.Password prefix={<LockOutlined />} placeholder={t('current_password')} />
            </Form.Item>
            <Form.Item label={t('new_password')} name="new_password" rules={[{ required: true, message: t('required') }, { min: 6, message: t('error') }]}>
              <Input.Password prefix={<LockOutlined />} placeholder={t('new_password')} />
            </Form.Item>
            <Form.Item label={t('confirm_password')} name="confirm_password" rules={[{ required: true, message: t('required') }]}>
              <Input.Password prefix={<LockOutlined />} placeholder={t('confirm_password')} />
            </Form.Item>
            <Button type="primary" onClick={handleChangePassword} loading={changingPw}>{t('save')}</Button>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

// --- Organization Settings ---
const OrganizationSettings: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/system/organization').then(r => {
      form.setFieldsValue(r.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const vals = await form.validateFields();
      await api.put('/api/system/organization', vals);
      message.success(t('success'));
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  return (
    <Card title={t('organization_settings')} loading={loading}>
      <Form form={form} layout="vertical">
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item label={t('organization_name')} name="name" rules={[{ required: true, message: t('required') }]}>
              <Input placeholder={t('organization_name')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('phone')} name="phone">
              <Input placeholder={t('phone')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('email')} name="email">
              <Input placeholder={t('email')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('tax_number')} name="tax_number">
              <Input placeholder={t('tax_number')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('registration_number')} name="registration_number">
              <Input placeholder={t('registration_number')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('city')} name="city">
              <Input placeholder={t('city')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('address_line1')} name="address_line1">
              <Input placeholder={t('address_line1')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('address_line2')} name="address_line2">
              <Input placeholder={t('address_line2')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('country')} name="country">
              <Input placeholder={t('country')} />
            </Form.Item>
          </Col>
        </Row>
        <Button type="primary" onClick={handleSave} loading={saving}>{t('save')}</Button>
      </Form>
    </Card>
  );
};

// --- Security (2FA + Sessions) ---
const SecurityPlaceholder: React.FC = () => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [setupOpen, setSetupOpen] = useState<boolean>(false);
  const [disableOpen, setDisableOpen] = useState<boolean>(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  useEffect(() => {
    api.get('/api/auth/me').then((r) => {
      setEnabled(Boolean(r.data?.is_2fa_enabled));
    }).catch(() => {});
  }, []);

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      setLoading(true);
      try {
        const r = await api.post('/api/auth/2fa/setup');
        setQrCode(r.data?.qr_code || '');
        setSecret(r.data?.secret || '');
        setCode('');
        setSetupOpen(true);
      } catch (e: any) {
        message.error(e?.response?.data?.detail || t('error') || 'Error');
      } finally {
        setLoading(false);
      }
    } else {
      setPassword('');
      setDisableOpen(true);
    }
  };


  const verifySetup = async () => {
    if (!code || code.length < 6) {
      message.warning(t('enter_6_digit_code') || 'Enter 6-digit code');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/2fa/verify', { code });
      message.success(t('two_factor_enabled') || '2FA enabled');
      setEnabled(true);
      setSetupOpen(false);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || t('invalid_code') || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const confirmDisable = async () => {
    if (!password || password.length < 6) {
      message.warning(t('enter_6_digit_code') || 'Enter 6-digit code');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/2fa/disable', { code: password });
      message.success(t('two_factor_disabled') || '2FA disabled');
      setEnabled(false);
      setDisableOpen(false);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || t('invalid_code') || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title={t('security_settings')}>
      <Row gutter={24}>
        <Col span={12}>
          <Card type="inner" title={t('two_factor_auth')}>
            <p>{t('enable_2fa')}</p>
            <Switch checked={enabled} loading={loading} onChange={handleToggle} />
            {enabled && (
              <div style={{ marginTop: 8 }}>
                <Tag color="green">{t('enabled') || 'Enabled'}</Tag>
              </div>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card type="inner" title={t('session_management')}>
            <p>{t('active_sessions')}</p>
            <Button disabled>{t('logout_all')}</Button>
          </Card>
        </Col>
      </Row>

      <Modal
        title={t('two_factor_auth')}
        open={setupOpen}
        onCancel={() => setSetupOpen(false)}
        onOk={verifySetup}
        confirmLoading={loading}
        okText={t('verify') || 'Verify'}
        cancelText={t('cancel') || 'Cancel'}
      >
        <p>{t('scan_qr_with_app') || 'Scan the QR code with your authenticator app, then enter the 6-digit code.'}</p>
        {qrCode && (
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <img src={qrCode} alt="2FA QR" style={{ width: 220, height: 220 }} />
          </div>
        )}
        {secret && (
          <p style={{ direction: 'ltr', fontFamily: 'monospace', textAlign: 'center', userSelect: 'all' }}>
            {secret}
          </p>
        )}
        <Input
          placeholder={t('enter_6_digit_code') || '6-digit code'}
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          style={{ direction: 'ltr', textAlign: 'center', fontSize: 18, letterSpacing: 4 }}
        />
      </Modal>

      <Modal
        title={t('disable_2fa') || 'Disable 2FA'}
        open={disableOpen}
        onCancel={() => setDisableOpen(false)}
        onOk={confirmDisable}
        confirmLoading={loading}
        okText={t('disable') || 'Disable'}
        okButtonProps={{ danger: true }}
        cancelText={t('cancel') || 'Cancel'}
      >
        <p>{t('confirm_disable_2fa') || 'Enter the 6-digit code from your authenticator to disable 2FA.'}</p>
        <Input
          placeholder={t('enter_6_digit_code') || '6-digit code'}
          maxLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
          style={{ direction: 'ltr', textAlign: 'center', fontSize: 18, letterSpacing: 4 }}
        />
      </Modal>
    </Card>
  );
};

// --- Notification Settings ---
const NotificationSettings: React.FC = () => {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState({
    invoice_overdue: true,
    payment_received: true,
    quote_accepted: true,
    expense_approved: true,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/system/notification-preferences').then(r => {
      setPrefs({
        invoice_overdue: r.data.invoice_overdue ?? true,
        payment_received: r.data.payment_received ?? true,
        quote_accepted: r.data.quote_accepted ?? true,
        expense_approved: r.data.expense_approved ?? true,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/api/system/notification-preferences', prefs);
      message.success(t('success'));
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  const togglePref = (key: keyof typeof prefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Card title={t('notification_preferences')} loading={loading}>
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        <Row justify="space-between" align="middle">
          <Col>{t('invoice_overdue')}</Col>
          <Col><Switch checked={prefs.invoice_overdue} onChange={() => togglePref('invoice_overdue')} /></Col>
        </Row>
        <Row justify="space-between" align="middle">
          <Col>{t('payment_received')}</Col>
          <Col><Switch checked={prefs.payment_received} onChange={() => togglePref('payment_received')} /></Col>
        </Row>
        <Row justify="space-between" align="middle">
          <Col>{t('quote_accepted')}</Col>
          <Col><Switch checked={prefs.quote_accepted} onChange={() => togglePref('quote_accepted')} /></Col>
        </Row>
        <Row justify="space-between" align="middle">
          <Col>{t('expense_approved')}</Col>
          <Col><Switch checked={prefs.expense_approved} onChange={() => togglePref('expense_approved')} /></Col>
        </Row>
        <Divider />
        <Button type="primary" onClick={handleSave} loading={saving}>{t('save')}</Button>
      </Space>
    </Card>
  );
};

// --- Fiscal Years ---
const FiscalYears: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    api.get('/api/fiscal/years').then(r => setData(Array.isArray(r.data) ? r.data : (r.data.items || [] || []))).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      await api.post('/api/fiscal/years', {
        name: values.name, start_date: values.start_date.format('YYYY-MM-DD'), end_date: values.end_date.format('YYYY-MM-DD'),
      });
      message.success(t('success')); setModalOpen(false); fetchData();
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  const handleClose = async (id: string) => {
    try { await api.post(`/api/fiscal/years/${id}/close`); message.success(t('success')); fetchData(); } catch { message.error(t('error')); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>{t('new_fiscal_year')}</Button>
      </div>
      <Table dataSource={data} columns={[
        { title: t('name'), dataIndex: 'name', key: 'name' },
        { title: t('start_date'), dataIndex: 'start_date', key: 'start_date', render: (d: string) => d?.substring(0, 10) },
        { title: t('end_date'), dataIndex: 'end_date', key: 'end_date', render: (d: string) => d?.substring(0, 10) },
        { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'open' ? 'green' : 'red'}>{t(s)}</Tag> },
        { title: t('actions'), key: 'actions', render: (_: any, r: any) =>
          r.status === 'open' ? <Button size="small" onClick={() => handleClose(r.id)}>{t('close_year')}</Button> : null
        },
      ]} rowKey="id" loading={loading} />
      <Modal open={modalOpen} onCancel={() => setModalOpen(false)} title={t('new_fiscal_year')} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item label={t('name')} name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label={t('start_date')} name="start_date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item label={t('end_date')} name="end_date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Space><Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button><Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button></Space>
        </Form>
      </Modal>
    </div>
  );
};

// --- Budgets ---
const Budgets: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);

  const fetchData = () => {
    setLoading(true);
    api.get('/api/fiscal/budgets').then(r => setData(Array.isArray(r.data) ? r.data : (r.data.items || [] || []))).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const openNew = async () => {
    const r = await api.get('/api/fiscal/years');
    setFiscalYears(r.data); form.resetFields(); setModalOpen(true);
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      await api.post('/api/fiscal/budgets', { name: values.name, fiscal_year_id: values.fiscal_year_id, lines: [] });
      message.success(t('success')); setModalOpen(false); fetchData();
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/api/fiscal/budgets/${id}`); message.success(t('success')); fetchData(); } catch { message.error(t('error')); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new_budget')}</Button>
      </div>
      <Table dataSource={data} columns={[
        { title: t('name'), dataIndex: 'name', key: 'name' },
        { title: t('actions'), key: 'actions', render: (_: any, r: any) => (
          <Popconfirm title={t('are_you_sure')} onConfirm={() => handleDelete(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
        )},
      ]} rowKey="id" loading={loading} />
      <Modal open={modalOpen} onCancel={() => setModalOpen(false)} title={t('new_budget')} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item label={t('name')} name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label={t('fiscal_year')} name="fiscal_year_id" rules={[{ required: true }]}>
            <select style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d9d9d9' }}>
              <option value="">{t('select')}</option>
              {fiscalYears.map(fy => <option key={fy.id} value={fy.id}>{fy.name}</option>)}
            </select>
          </Form.Item>
          <Space><Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button><Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button></Space>
        </Form>
      </Modal>
    </div>
  );
};

// --- Currencies ---
const Currencies: React.FC = () => {
  const { t } = useTranslation();
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get('/api/system/currencies'), api.get('/api/system/exchange-rates')])
      .then(([c, r]) => { setCurrencies(Array.isArray(c.data) ? c.data : (c.data.items || c.data || [])); setRates(Array.isArray(r.data) ? r.data : (r.data.items || [] || [])); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      await api.post('/api/system/exchange-rates', {
        from_currency: values.from_currency, to_currency: values.to_currency,
        rate: values.rate, date: values.date.format('YYYY-MM-DD'),
      });
      message.success(t('success')); setModalOpen(false);
      const r = await api.get('/api/system/exchange-rates'); setRates(Array.isArray(r.data) ? r.data : (r.data.items || [] || []));
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  return (
    <div>
      <Card title={t('currencies')} style={{ marginBottom: 16 }}>
        <Table dataSource={currencies} columns={[
          { title: t('currency'), dataIndex: 'code', key: 'code' },
          { title: t('name'), dataIndex: 'name', key: 'name' },
          { title: t('symbol'), dataIndex: 'symbol', key: 'symbol' },
        ]} rowKey="code" loading={loading} pagination={false} size="small" />
      </Card>
      <Card title={t('exchange_rates')} extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>{t('new_rate')}</Button>}>
        <Table dataSource={rates} columns={[
          { title: t('from'), dataIndex: 'from_currency', key: 'from_currency' },
          { title: t('to'), dataIndex: 'to_currency', key: 'to_currency' },
          { title: t('rate'), dataIndex: 'rate', key: 'rate' },
          { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
        ]} rowKey="id" pagination={false} size="small" />
      </Card>
      <Modal open={modalOpen} onCancel={() => setModalOpen(false)} title={t('new_rate')} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ date: dayjs() }}>
          <Form.Item label={t('from')} name="from_currency" rules={[{ required: true }]}><Input placeholder="USD" /></Form.Item>
          <Form.Item label={t('to')} name="to_currency" rules={[{ required: true }]}><Input placeholder="IQD" /></Form.Item>
          <Form.Item label={t('rate')} name="rate" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label={t('date')} name="date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Space><Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button><Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button></Space>
        </Form>
      </Modal>
    </div>
  );
};

// --- Backup & Restore ---
const BackupRestore: React.FC = () => {
  const { t } = useTranslation();
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchBackups = () => {
    setLoading(true);
    api.get('/api/system/backup/list').then(r => setBackups(Array.isArray(r.data) ? r.data : (r.data.items || [] || []))).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchBackups(); }, []);

  const createBackup = async () => {
    setCreating(true);
    try { await api.post('/api/system/backup'); message.success(t('success')); fetchBackups(); }
    catch { message.error(t('error')); } finally { setCreating(false); }
  };

  const downloadBackup = async () => {
    try {
      const r = await api.get('/api/system/backup/download', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'backup.db'; a.click();
      window.URL.revokeObjectURL(url);
    } catch { message.error(t('error')); }
  };

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col><Button type="primary" icon={<CloudOutlined />} onClick={createBackup} loading={creating}>{t('create_backup')}</Button></Col>
        <Col><Button icon={<DownloadOutlined />} onClick={downloadBackup}>{t('download_backup')}</Button></Col>
      </Row>
      <Table dataSource={backups} columns={[
        { title: t('name'), dataIndex: 'filename', key: 'filename' },
        { title: t('date'), dataIndex: 'created', key: 'created' },
        { title: t('size'), dataIndex: 'size', key: 'size', render: (v: number) => `${(v / 1024).toFixed(1)} KB` },
      ]} rowKey="filename" loading={loading} />
    </div>
  );
};

// --- Activity Log (with filters) ---
const ActivityLog: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<{id: string; created_at: string; action: string; description: string; entity_type: string; user_name?: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [entityFilter, setEntityFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const fetchData = () => {
    setLoading(true);
    const params: Record<string, string | number> = { page, page_size: 20 };
    if (actionFilter) params.action = actionFilter;
    if (entityFilter) params.entity = entityFilter;
    if (dateRange?.[0]) params.from_date = dateRange[0].format('YYYY-MM-DD');
    if (dateRange?.[1]) params.to_date = dateRange[1].format('YYYY-MM-DD');
    api.get('/api/system/activity-log', { params })
      .then(r => { setData(r.data.items || []); setTotal(r.data.total || 0); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page, actionFilter, entityFilter, dateRange]);

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Select
            allowClear
            placeholder={t('type')}
            style={{ width: '100%' }}
            value={actionFilter}
            onChange={v => { setActionFilter(v); setPage(1); }}
            options={[
              { label: t('create'), value: 'create' },
              { label: t('edit'), value: 'update' },
              { label: t('delete'), value: 'delete' },
              { label: t('approve'), value: 'approve' },
            ]}
          />
        </Col>
        <Col span={6}>
          <Select
            allowClear
            placeholder={t('entity')}
            style={{ width: '100%' }}
            value={entityFilter}
            onChange={v => { setEntityFilter(v); setPage(1); }}
            options={[
              { label: t('invoice'), value: 'invoice' },
              { label: t('expense'), value: 'expense' },
              { label: t('contact'), value: 'contact' },
              { label: t('item'), value: 'item' },
              { label: t('payment'), value: 'payment' },
              { label: t('journal'), value: 'journal' },
            ]}
          />
        </Col>
        <Col span={8}>
          <RangePicker
            style={{ width: '100%' }}
            onChange={(dates) => { setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null); setPage(1); }}
          />
        </Col>
      </Row>
      <Table dataSource={data} columns={[
        { title: t('date'), dataIndex: 'created_at', key: 'created_at', render: (d: string) => d?.substring(0, 19).replace('T', ' ') },
        { title: t('type'), dataIndex: 'action', key: 'action', render: (a: string) => <Tag>{a}</Tag> },
        { title: t('entity'), dataIndex: 'entity_type', key: 'entity_type' },
        { title: t('description'), dataIndex: 'description', key: 'description' },
        { title: t('user'), dataIndex: 'user_name', key: 'user_name' },
      ]} rowKey="id" loading={loading} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
    </div>
  );
};

// --- Email Settings ---
const EmailSettings: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/system/settings').then(r => {
      const vals: Record<string, string> = {};
      r.data.forEach((s: {key: string; value: string}) => { vals[s.key] = s.value; });
      form.setFieldsValue(vals);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const vals = form.getFieldsValue();
      for (const [key, value] of Object.entries(vals)) {
        if (value !== undefined && value !== null) {
          await api.post('/api/system/settings', { key, value: String(value), category: 'email' });
        }
      }
      message.success(t('success'));
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  return (
    <Card loading={loading}>
      <Form form={form} layout="vertical">
        <Row gutter={24}>
          <Col span={12}><Form.Item label={t('smtp_host')} name="smtp_host"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item label={t('smtp_port')} name="smtp_port"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item label={t('smtp_user')} name="smtp_user"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item label={t('smtp_password')} name="smtp_password"><Input.Password /></Form.Item></Col>
          <Col span={12}><Form.Item label={t('email_from')} name="email_from"><Input /></Form.Item></Col>
        </Row>
        <Button type="primary" onClick={handleSave} loading={saving}>{t('save')}</Button>
      </Form>
    </Card>
  );
};

// --- Reminder Settings ---
const ReminderSettings: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/system/reminder-settings').then(r => {
      form.setFieldsValue(r.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const vals = form.getFieldsValue();
      await api.put('/api/system/reminder-settings', vals);
      message.success(t('success'));
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  return (
    <Card loading={loading}>
      <Form form={form} layout="vertical">
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item label={t('before_due_days')} name="before_due_days">
              <Input placeholder="3,7,14" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('after_due_days')} name="after_due_days">
              <Input placeholder="1,3,7" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label={t('email_subject')} name="email_subject_template">
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label={t('email_body')} name="email_body_template">
              <Input.TextArea rows={4} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('active')} name="is_active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        <Button type="primary" onClick={handleSave} loading={saving}>{t('save')}</Button>
      </Form>
    </Card>
  );
};

// --- Invoice Templates ---
const InvoiceTemplates: React.FC = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<{id: string; name: string; layout: string; is_default: boolean}[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchTemplates = () => {
    setLoading(true);
    api.get('/api/system/invoice-templates').then(r => setTemplates(Array.isArray(r.data) ? r.data : (r.data.items || [] || []))).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleCreate = async (values: {name: string; layout: string; colors: string; show_logo: boolean; footer_text: string}) => {
    setSaving(true);
    try {
      await api.post('/api/system/invoice-templates', values);
      message.success(t('success'));
      setModalOpen(false);
      fetchTemplates();
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  const setDefault = async (id: string) => {
    try {
      await api.post(`/api/system/invoice-templates/${id}/set-default`);
      message.success(t('success'));
      fetchTemplates();
    } catch { message.error(t('error')); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
          {t('create')}
        </Button>
      </div>
      <Table
        dataSource={templates}
        columns={[
          { title: t('template_name'), dataIndex: 'name', key: 'name' },
          { title: t('layout'), dataIndex: 'layout', key: 'layout' },
          {
            title: t('status'), key: 'default',
            render: (_: unknown, r: {is_default: boolean}) => r.is_default ? <Tag color="green">{t('default_template')}</Tag> : null,
          },
          {
            title: t('actions'), key: 'actions',
            render: (_: unknown, r: {id: string; is_default: boolean}) => !r.is_default ? (
              <Button size="small" onClick={() => setDefault(r.id)}>{t('set_default')}</Button>
            ) : null,
          },
        ]}
        rowKey="id"
        loading={loading}
      />
      <Modal open={modalOpen} onCancel={() => setModalOpen(false)} title={t('invoice_templates')} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ layout: 'classic', show_logo: true }}>
          <Form.Item label={t('template_name')} name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label={t('layout')} name="layout">
            <Select options={[
              { label: t('classic'), value: 'classic' },
              { label: t('modern'), value: 'modern' },
              { label: t('minimal'), value: 'minimal' },
              { label: t('rtl'), value: 'rtl' },
            ]} />
          </Form.Item>
          <Form.Item label="Colors" name="colors"><Input placeholder="#1677ff" /></Form.Item>
          <Form.Item label={t('show_logo')} name="show_logo" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label={t('footer_text')} name="footer_text"><Input.TextArea rows={2} /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button>
            <Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

// --- System Info ---
const SystemInfo: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Card title={t('system_info')}>
      <Row gutter={[16, 16]}>
        <Col span={12}><strong>{t('app_version')}:</strong> 1.0.0</Col>
        <Col span={12}><strong>Frontend:</strong> React 19 + Vite</Col>
        <Col span={12}><strong>Backend:</strong> FastAPI + Firestore</Col>
        <Col span={12}><strong>{t('storage_used')}:</strong> —</Col>
      </Row>
    </Card>
  );
};

// ── Modules Settings — re-open onboarding wizard ───────────────
const ModulesSettings: React.FC = () => {
  const enabledModules = useOnboardingStore(s => s.enabledModules);
  const industryId = useOnboardingStore(s => s.industryId);
  const reset = useOnboardingStore(s => s.reset);
  const reopen = () => window.dispatchEvent(new Event('open-onboarding'));
  const ind = industryId ? INDUSTRIES.find(i => i.id === industryId) : null;
  const enabled = enabledModules ? enabledModules.map(k => MODULES.find(m => m.key === k)).filter(Boolean) as typeof MODULES : null;
  return (
    <Card title="ڕێکخستنی مۆدیولەکان">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {ind ? (
              <div>
                <strong>جۆری کار:</strong> <Tag color="blue">{ind.icon} {ind.title}</Tag>
              </div>
            ) : (
              <div><Tag>هێشتا onboarding تەواو نەکراوە</Tag></div>
            )}
            {enabled && (
              <div>
                <strong>مۆدیولە چالاکەکان ({enabled.length}):</strong>
                <div style={{ marginTop: 8 }}>
                  <Space wrap>
                    {enabled.map(m => (
                      <Tag key={m.key} color="purple">{m.icon} {m.title}</Tag>
                    ))}
                  </Space>
                </div>
              </div>
            )}
            <Space>
              <Button type="primary" onClick={reopen}>
                دیسان ڕێکی بخە (Reconfigure)
              </Button>
              <Popconfirm title="هەموو ڕێکخستنە onboarding ـەکان لاببرێت؟" onConfirm={reset}>
                <Button danger>سفر کردنەوە</Button>
              </Popconfirm>
            </Space>
          </Space>
        </Col>
      </Row>
    </Card>
  );
};

export default Settings;
