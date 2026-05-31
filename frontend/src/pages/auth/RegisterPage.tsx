/**
 * RegisterPage.tsx
 *
 * صفحة التسجيل / پەرەی تۆمارکردن
 *
 * Requirements 2.1, 2.2, 2.3, 2.4, 2.5:
 * - Real-time validation for: full name, email, password, confirm password, company name
 * - Password strength validation: min 8 chars, uppercase, number, special character
 * - On success: navigate to onboarding
 * - JWT storage: access token in memory (Zustand), refresh token in httpOnly cookie (set by backend)
 */
import React, { useState, useCallback } from 'react';
import { Form, Input, Button, Alert, Progress, Divider, ConfigProvider } from 'antd';
import {
  MailOutlined,
  LockOutlined,
  UserOutlined,
  BankOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store';
import api from '../../api';
import AuthLayout from '../../layouts/AuthLayout';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import { FormDialog } from '../../components/responsive/FormDialog';
import { isRTLLanguage } from '../../utils/language';
import { useOnboardingStore } from '../../onboarding/store';

// ---------------------------------------------------------------------------
// Password strength helpers
// ---------------------------------------------------------------------------

interface PasswordChecks {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

function checkPassword(password: string): PasswordChecks {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
}

function getStrengthScore(checks: PasswordChecks): number {
  return Object.values(checks).filter(Boolean).length;
}

function getStrengthColor(score: number): string {
  if (score <= 1) return '#ff4d4f';
  if (score === 2) return '#faad14';
  if (score === 3) return '#1677ff';
  return '#52c41a';
}

function getStrengthLabel(score: number, t: (k: string) => string): string {
  if (score <= 1) return t('password_strength_weak');
  if (score === 2) return t('password_strength_fair');
  if (score === 3) return t('password_strength_good');
  return t('password_strength_strong');
}

// ---------------------------------------------------------------------------
// PasswordStrengthIndicator
// ---------------------------------------------------------------------------

interface PasswordStrengthIndicatorProps {
  password: string;
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  const { t } = useTranslation();

  if (!password) return null;

  const checks = checkPassword(password);
  const score = getStrengthScore(checks);
  const color = getStrengthColor(score);
  const label = getStrengthLabel(score, t);

  const rules: { key: keyof PasswordChecks; label: string }[] = [
    { key: 'minLength',    label: t('password_rule_min_length') },
    { key: 'hasUppercase', label: t('password_rule_uppercase') },
    { key: 'hasNumber',    label: t('password_rule_number') },
    { key: 'hasSpecial',   label: t('password_rule_special') },
  ];

  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Progress
          percent={(score / 4) * 100}
          showInfo={false}
          strokeColor={color}
          size="small"
          style={{ flex: 1, margin: 0 }}
        />
        <span style={{ fontSize: 11, color, fontWeight: 600, minWidth: 48, textAlign: 'end' }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {rules.map(({ key, label: ruleLabel }) => (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: checks[key] ? '#52c41a' : '#94A3B8',
            }}
          >
            {checks[key]
              ? <CheckCircleOutlined style={{ fontSize: 11 }} />
              : <CloseCircleOutlined style={{ fontSize: 11 }} />}
            {ruleLabel}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// RegisterPage
// ---------------------------------------------------------------------------

const RegisterPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { loginSecure } = useAuthStore();
  const markFreshSignup = useOnboardingStore(s => s.markFreshSignup);
  const isRTL = isRTLLanguage(i18n.language as 'ku' | 'ar' | 'en');

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [orgNameInput, setOrgNameInput] = useState('');

  // Validate password strength for the form rule
  const validatePasswordStrength = useCallback((_: unknown, value: string) => {
    if (!value) return Promise.reject(new Error(t('required_password')));
    const checks = checkPassword(value);
    if (!checks.minLength) return Promise.reject(new Error(t('password_rule_min_length')));
    if (!checks.hasUppercase) return Promise.reject(new Error(t('password_rule_uppercase')));
    if (!checks.hasNumber) return Promise.reject(new Error(t('password_rule_number')));
    if (!checks.hasSpecial) return Promise.reject(new Error(t('password_rule_special')));
    return Promise.resolve();
  }, [t]);

  // Validate confirm password matches
  const validateConfirmPassword = useCallback((_: unknown, value: string) => {
    if (!value) return Promise.reject(new Error(t('required_password')));
    const pwd = form.getFieldValue('password');
    if (value !== pwd) return Promise.reject(new Error(t('auth_password_mismatch')));
    return Promise.resolve();
  }, [form, t]);

  const handleRegister = async (values: {
    org_name: string;
    user_name: string;
    email: string;
    password: string;
    confirm_password: string;
  }) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/api/v1/auth/register', {
        org_name: values.org_name,
        user_name: values.user_name,
        email: values.email,
        password: values.password,
      });
      // JWT storage: access token in memory (Zustand store), refresh token
      // is set as httpOnly cookie by the backend — we never touch it client-side.
      loginSecure(
        res.data.access_token,
        res.data.user_id,
        res.data.org_id,
        res.data.user_name,
        res.data.role,
      );
      markFreshSignup();
      navigate('/onboarding');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'ئەم ئیمەیڵە پێشتر تۆمار کراوە') {
        setErrorMsg(t('auth_email_exists'));
      } else {
        setErrorMsg(detail || t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = (idToken: string) => {
    setErrorMsg(null);
    const orgFromForm = (form.getFieldValue('org_name') as string | undefined)?.trim();
    if (orgFromForm) {
      setOrgNameInput(orgFromForm);
      setGoogleToken(idToken);
      void handleGoogleRegister(idToken, orgFromForm);
      return;
    }
    setGoogleToken(idToken);
    setOrgModalOpen(true);
  };

  const handleGoogleRegister = async (token?: string, orgName?: string) => {
    const idToken = token || googleToken;
    const name = (orgName || orgNameInput).trim();
    if (!idToken || !name) {
      setErrorMsg(t('required_company'));
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setOrgModalOpen(false);
    try {
      const res = await api.post('/api/v1/auth/firebase-register', {
        id_token: idToken,
        org_name: name,
      });
      loginSecure(
        res.data.access_token,
        res.data.user_id,
        res.data.org_id,
        res.data.user_name,
        res.data.role,
      );
      markFreshSignup();
      navigate('/onboarding');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'ئەم ئیمەیڵە پێشتر تۆمارکراوە' || detail === 'ئەم ئیمەیڵە پێشتر تۆمار کراوە') {
        setErrorMsg(t('auth_email_exists'));
      } else if (err?.response?.status === 405) {
        setErrorMsg(t('auth_api_unavailable', 'Registration service unavailable. Please try again.'));
      } else {
        setErrorMsg(detail || t('error'));
      }
    } finally {
      setLoading(false);
      setGoogleToken(null);
    }
  };

  return (
    <AuthLayout
      title={t('auth_get_started')}
      subtitle={t('auth_create_account')}
    >
      {errorMsg && (
        <Alert
          title={errorMsg}
          type="error"
          showIcon
          closable
          onClose={() => setErrorMsg(null)}
          style={{ marginBottom: 20, borderRadius: 10, direction: 'rtl', textAlign: 'end' }}
        />
      )}

      <ConfigProvider direction={isRTL ? 'rtl' : 'ltr'}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleRegister}
        className={isRTL ? undefined : 'auth-form-ltr'}
        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
        validateTrigger={['onChange', 'onBlur']}
      >
        {/* Company name */}
        <Form.Item
          name="org_name"
          style={{ marginBottom: 14 }}
          rules={[{ required: true, message: t('required_company') }]}
          validateTrigger={['onChange', 'onBlur']}
        >
          <Input
            className="auth-input"
            size="large"
            placeholder={t('placeholder_company')}
            prefix={<BankOutlined />}
            style={{ direction: isRTL ? 'rtl' : 'ltr' }}
          />
        </Form.Item>

        {/* Full name */}
        <Form.Item
          name="user_name"
          style={{ marginBottom: 14 }}
          rules={[
            { required: true, message: t('required_name') },
            { min: 2, message: t('name_too_short') },
          ]}
          validateTrigger={['onChange', 'onBlur']}
        >
          <Input
            className="auth-input"
            size="large"
            placeholder={t('placeholder_name')}
            prefix={<UserOutlined />}
            style={{ direction: isRTL ? 'rtl' : 'ltr' }}
          />
        </Form.Item>

        {/* Email */}
        <Form.Item
          name="email"
          style={{ marginBottom: 14 }}
          rules={[
            { required: true, message: t('required_email') },
            { type: 'email', message: t('invalid_email') },
          ]}
          validateTrigger={['onChange', 'onBlur']}
        >
          <Input
            className="auth-input"
            size="large"
            placeholder={t('placeholder_email')}
            prefix={<MailOutlined />}
            style={{ direction: 'ltr' }}
            autoComplete="email"
          />
        </Form.Item>

        {/* Password with strength indicator */}
        <Form.Item
          name="password"
          style={{ marginBottom: 4 }}
          rules={[{ validator: validatePasswordStrength }]}
          validateTrigger={['onChange', 'onBlur']}
        >
          <Input.Password
            className="auth-input"
            size="large"
            placeholder={t('placeholder_password')}
            prefix={<LockOutlined />}
            style={{ direction: isRTL ? 'rtl' : 'ltr' }}
            onChange={(e) => setPasswordValue(e.target.value)}
          />
        </Form.Item>

        {/* Real-time password strength indicator */}
        <PasswordStrengthIndicator password={passwordValue} />

        {/* Confirm password */}
        <Form.Item
          name="confirm_password"
          style={{ marginBottom: 16, marginTop: 8 }}
          rules={[{ validator: validateConfirmPassword }]}
          validateTrigger={['onChange', 'onBlur']}
          dependencies={['password']}
        >
          <Input.Password
            className="auth-input"
            size="large"
            placeholder={t('placeholder_confirm_password')}
            prefix={<LockOutlined />}
            style={{ direction: isRTL ? 'rtl' : 'ltr' }}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 12 }}>
          <Button
            className="auth-btn"
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={loading}
          >
            {t('auth_signup')}
          </Button>
        </Form.Item>
</Form>
      </ConfigProvider>

      <Divider style={{ margin: '8px 0', color: '#aaa', fontSize: 12 }}>
        {t('or') || 'یان'}
      </Divider>

      <GoogleSignInButton
        text={t('auth_google_signup')}
        loading={loading}
        onSuccess={handleGoogleSuccess}
        onError={(err: any) => {
          const code = err?.code || '';
          const msg = err?.message || String(err);
          if (code === 'auth/unauthorized-domain') {
            setErrorMsg('Domain ـی ئەم سایتە لە Firebase Authorized Domains زیاد نەکراوە.');
          } else if (code === 'auth/popup-blocked') {
            setErrorMsg('Browser ـت popup ـی Google ـی بلۆک کرد.');
          } else {
            setErrorMsg(`${t('error')}: ${code || msg}`);
          }
        }}
      />

      <FormDialog
        open={orgModalOpen}
        title={t('auth_org_name')}
        onOk={() => handleGoogleRegister()}
        onClose={() => { setOrgModalOpen(false); setGoogleToken(null); }}
        okText={t('auth_signup')}
      >
        <p style={{ marginBottom: 12, color: '#666' }}>
          {t('auth_org_modal_description')}
        </p>
        <Input
          placeholder={t('auth_org_name')}
          prefix={<BankOutlined />}
          value={orgNameInput}
          onChange={(e) => setOrgNameInput(e.target.value)}
          onPressEnter={() => handleGoogleRegister()}
          style={{ borderRadius: 10, height: 46 }}
        />
      </FormDialog>

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#666' }}>
        {t('auth_has_account')}{' '}
        <Link to="/login" style={{ color: '#667EEA', fontWeight: 600 }}>
          {t('auth_login')}
        </Link>
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;
