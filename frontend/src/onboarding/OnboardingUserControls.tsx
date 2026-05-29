import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Drawer, Dropdown, Form, Input, Space } from 'antd';
import type { MenuProps } from 'antd';
import {
  CheckOutlined, GlobalOutlined, LogoutOutlined, MoonOutlined, SunOutlined,
  UserOutlined, MailOutlined, KeyOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { useUiStore } from '../stores/uiStore';
import { resolveLanguage, isRTLLanguage, type Language } from '../utils/language';
import api from '../api';
import { message } from '../utils/message';
import styles from './OnboardingWizard.module.css';

const LANGUAGES: Array<{ code: Language; nativeLabel: string }> = [
  { code: 'ku', nativeLabel: 'کوردی سۆرانی' },
  { code: 'en', nativeLabel: 'English' },
  { code: 'ar', nativeLabel: 'العربية' },
];

const LANG_SHORT: Record<Language, string> = { ku: 'کو', en: 'EN', ar: 'ع' };

const OVERLAY = { root: { zIndex: 2200 } } as const;

function persistLanguage(lang: Language): void {
  try { localStorage.setItem('i18n.language', lang); } catch { /* ignore */ }
}

function applyDocumentDirection(lang: Language): void {
  document.documentElement.setAttribute('dir', isRTLLanguage(lang) ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', lang);
}

export default function OnboardingUserControls() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { userName, logout, toggleTheme, theme } = useAuthStore();
  const setLanguage = useUiStore(s => s.setLanguage);
  const isDark = theme === 'dark';
  const [accountOpen, setAccountOpen] = useState(false);
  const [form] = Form.useForm();
  const [pwForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const currentLang = resolveLanguage(i18n.language || 'ku');

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const handleLanguageChange = useCallback((code: Language) => {
    const resolved = resolveLanguage(code);
    i18n.changeLanguage(resolved);
    setLanguage(resolved);
    applyDocumentDirection(resolved);
    persistLanguage(resolved);
  }, [i18n, setLanguage]);

  useEffect(() => {
    if (!accountOpen) return;
    setLoading(true);
    api.get('/api/system/profile')
      .then(r => form.setFieldsValue(r.data))
      .catch(() => message.error(t('error')))
      .finally(() => setLoading(false));
  }, [accountOpen, form, t]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const vals = await form.validateFields(['display_name', 'phone']);
      await api.put('/api/system/profile', {
        display_name: vals.display_name,
        phone: vals.phone,
      });
      message.success(t('success'));
    } catch {
      message.error(t('error'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setChangingPw(true);
    try {
      const vals = await pwForm.validateFields();
      if (vals.new_password !== vals.confirm_password) {
        message.error(t('confirm_password'));
        return;
      }
      await api.put('/api/system/profile/password', {
        current_password: vals.current_password,
        new_password: vals.new_password,
      });
      message.success(t('success'));
      pwForm.resetFields();
    } catch {
      message.error(t('error'));
    } finally {
      setChangingPw(false);
    }
  };

  const languageMenu = useMemo<MenuProps>(() => ({
    items: LANGUAGES.map(({ code, nativeLabel }) => ({
      key: code,
      label: (
        <span className={styles.menuRow}>
          <span>{nativeLabel}</span>
          {code === currentLang && <CheckOutlined className={styles.menuCheck} />}
        </span>
      ),
      onClick: () => handleLanguageChange(code),
    })),
    selectedKeys: [currentLang],
  }), [currentLang, handleLanguageChange]);

  const userMenu = useMemo<MenuProps>(() => ({
    items: [
      {
        key: 'account',
        icon: <UserOutlined />,
        label: t('account', 'Account'),
        onClick: () => setAccountOpen(true),
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        danger: true,
        label: t('logout'),
        onClick: handleLogout,
      },
    ],
  }), [handleLogout, t]);

  const initials = (userName || '?').slice(0, 1).toUpperCase();

  return (
    <>
      <div className={styles.glassToolbar}>
        <button
          type="button"
          className={styles.glassIconBtn}
          onClick={toggleTheme}
          aria-label={isDark ? t('light_mode') : t('dark_mode')}
          title={isDark ? t('light_mode') : t('dark_mode')}
        >
          {isDark ? <SunOutlined /> : <MoonOutlined />}
        </button>

        <Dropdown
          menu={languageMenu}
          trigger={['click']}
          placement="bottomRight"
          getPopupContainer={() => document.body}
          styles={OVERLAY}
        >
          <button
            type="button"
            className={styles.glassIconBtn}
            aria-label={t('tooltip_language_switch', 'Switch Language')}
            title={t('tooltip_language_switch', 'Switch Language')}
          >
            <GlobalOutlined />
            <span className={styles.glassIconLabel}>{LANG_SHORT[currentLang]}</span>
          </button>
        </Dropdown>

        <Dropdown
          menu={userMenu}
          trigger={['click']}
          placement="bottomRight"
          getPopupContainer={() => document.body}
          styles={OVERLAY}
        >
          <button
            type="button"
            className={styles.glassUserBtn}
            aria-label={t('account', 'Account')}
            title={userName || t('account', 'Account')}
          >
            <Avatar size={30} className={styles.glassAvatar}>{initials}</Avatar>
            <span className={styles.glassUserName}>{userName || t('account', 'Account')}</span>
          </button>
        </Dropdown>
      </div>

      <Drawer
        title={t('profile_settings', 'Account settings')}
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        width={420}
        destroyOnClose
        zIndex={2300}
        className={styles.accountDrawer}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Form form={form} layout="vertical" disabled={loading}>
            <Form.Item label={t('email')} name="email">
              <Input disabled prefix={<MailOutlined />} />
            </Form.Item>
            <Form.Item
              label={t('name')}
              name="display_name"
              rules={[{ required: true, message: t('required') }]}
            >
              <Input prefix={<UserOutlined />} />
            </Form.Item>
            <Form.Item label={t('phone')} name="phone">
              <Input />
            </Form.Item>
            <Button type="primary" onClick={handleSaveProfile} loading={saving} block>
              {t('save')}
            </Button>
          </Form>

          <Form form={pwForm} layout="vertical">
            <Form.Item
              label={t('current_password', 'Current password')}
              name="current_password"
              rules={[{ required: true, message: t('required') }]}
            >
              <Input.Password prefix={<KeyOutlined />} />
            </Form.Item>
            <Form.Item
              label={t('new_password', 'New password')}
              name="new_password"
              rules={[{ required: true, message: t('required') }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              label={t('confirm_password', 'Confirm password')}
              name="confirm_password"
              rules={[{ required: true, message: t('required') }]}
            >
              <Input.Password />
            </Form.Item>
            <Button onClick={handleChangePassword} loading={changingPw} block>
              {t('change_password')}
            </Button>
          </Form>
        </Space>
      </Drawer>
    </>
  );
}
