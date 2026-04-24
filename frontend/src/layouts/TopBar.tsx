import React from 'react';
import { Layout, Button, Tooltip, Avatar, Dropdown, Space, Badge } from 'antd';
import {
  MenuFoldOutlined, MenuUnfoldOutlined, MoonOutlined, SunOutlined, GlobalOutlined,
  LogoutOutlined, UserOutlined, BellOutlined, SearchOutlined, DownOutlined, PlusOutlined,
  QuestionCircleOutlined, ColumnHeightOutlined, BankOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { useUiStore } from '../stores/uiStore';
import { palette, space, radius, shadow, layout, transitions } from '../theme/tokens';
import Breadcrumb from './Breadcrumb';
import { useUnreadCount } from './NotificationsDrawer';
import OrgSwitcher from './OrgSwitcher';

const { Header } = Layout;

interface TopBarProps {
  collapsed: boolean;
  onToggle: () => void;
  isRTL: boolean;
  isDark: boolean;
  onOpenPalette?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ collapsed, onToggle, isRTL, isDark, onOpenPalette }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { userName, logout, toggleTheme } = useAuthStore();
  const setNotificationsOpen = useUiStore((s) => s.setNotificationsOpen);
  const setQuickCreateOpen = useUiStore((s) => s.setQuickCreateOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const density = useUiStore((s) => s.density);
  const setDensity = useUiStore((s) => s.setDensity);
  const unread = useUnreadCount();

  const handleLogout = () => { logout(); navigate('/login'); };
  const toggleLanguage = () => i18n.changeLanguage(i18n.language === 'ku' ? 'en' : 'ku');
  const collapseIcon = isRTL
    ? (collapsed ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />)
    : (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />);

  const userMenu = { items: [
    { key: 'profile', icon: <UserOutlined />, label: t('profile', 'Profile') },
    { key: 'settings', icon: <UserOutlined />, label: t('settings'), onClick: () => navigate('/settings') },
    { key: 'shortcuts', icon: <QuestionCircleOutlined />, label: `${t('shortcuts.title', 'Keyboard shortcuts')}  ?`, onClick: () => setShortcutsOpen(true) },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, danger: true, label: t('logout'), onClick: handleLogout },
  ] };
  const densityMenu = { items: [
    { key: 'compact',     label: t('density.compact', 'Compact'),         onClick: () => setDensity('compact') },
    { key: 'comfortable', label: t('density.comfortable', 'Comfortable'), onClick: () => setDensity('comfortable') },
    { key: 'spacious',    label: t('density.spacious', 'Spacious'),       onClick: () => setDensity('spacious') },
  ], selectedKeys: [density] };

  return (
    <Header style={{
      padding: `0 ${space.lg}px`,
      background: isDark ? palette.darkSurface : palette.surface,
      borderBottom: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: space.md, position: 'sticky', top: 0, zIndex: 99,
      boxShadow: shadow.sm, height: layout.topbarHeight,
    }}>
      <Space size={space.sm} align="center" style={{ minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
        <Button type="text" icon={collapseIcon} onClick={onToggle} size="large" aria-label={t('toggle_menu', 'Toggle menu')} />
        <Breadcrumb isDark={isDark} isRTL={isRTL} />
      </Space>
      <button type="button" onClick={onOpenPalette} aria-label={t('search_or_jump', 'Search or jump to\u2026')}
        style={{
          display: 'flex', alignItems: 'center', gap: space.sm,
          background: isDark ? palette.darkBg : palette.bg,
          border: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
          borderRadius: radius.md, padding: `6px ${space.md}px`,
          color: palette.ink500, cursor: 'pointer',
          minWidth: 280, maxWidth: 380, fontSize: 13,
          transition: transitions.base, flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = palette.primary300; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = isDark ? palette.darkBorder : palette.border; }}>
        <SearchOutlined />
        <span style={{ flex: 1, textAlign: 'start' }}>{t('search_or_jump', 'Search or jump to\u2026')}</span>
        <kbd style={{
          background: isDark ? palette.darkElevated : palette.surface,
          border: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
          borderRadius: 4, padding: '1px 6px', fontSize: 11,
          color: palette.ink500, fontFamily: 'inherit',
        }}>Ctrl K</kbd>
      </button>
      <Space size={space.xs} align="center" style={{ flexShrink: 0 }}>
        <Tooltip title={t('topbar.quick_create', 'Quick create')}>
          <Button type="primary" shape="circle" icon={<PlusOutlined />} onClick={() => setQuickCreateOpen(true)} aria-label={t('topbar.quick_create', 'Quick create')} />
        </Tooltip>
        <Tooltip title={t('topbar.notifications', 'Notifications')}>
          <Badge count={unread} size="small" offset={[-4, 4]}>
            <Button type="text" shape="circle" icon={<BellOutlined />} onClick={() => setNotificationsOpen(true)} aria-label={t('topbar.notifications', 'Notifications')} />
          </Badge>
        </Tooltip>
        <Tooltip title={t('topbar.help', 'Help')}>
          <Button type="text" shape="circle" icon={<QuestionCircleOutlined />} onClick={() => setShortcutsOpen(true)} aria-label={t('topbar.help', 'Help')} />
        </Tooltip>
        <Dropdown menu={densityMenu} placement={isRTL ? 'bottomLeft' : 'bottomRight'} trigger={['click']}>
          <Tooltip title={t('topbar.density', 'Density')}>
            <Button type="text" shape="circle" icon={<ColumnHeightOutlined />} aria-label={t('topbar.density', 'Density')} />
          </Tooltip>
        </Dropdown>
        <Tooltip title={isDark ? t('light_mode') : t('dark_mode')}>
          <Button type="text" shape="circle" icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggleTheme} aria-label={isDark ? t('light_mode') : t('dark_mode')} />
        </Tooltip>
        <Tooltip title={i18n.language === 'ku' ? 'English' : '\u06A9\u0648\u0631\u062F\u06CC'}>
          <Button type="text" icon={<GlobalOutlined />} onClick={toggleLanguage} aria-label="Language">
            {i18n.language === 'ku' ? 'EN' : '\u06A9\u0648'}
          </Button>
        </Tooltip>
        <OrgSwitcher isRTL={isRTL} />
        <Dropdown menu={userMenu} placement={isRTL ? 'bottomLeft' : 'bottomRight'} trigger={['click']}>
          <button type="button" style={{
            display: 'flex', alignItems: 'center', gap: space.sm,
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: `4px ${space.sm}px`, borderRadius: radius.md,
          }} aria-label={t('user_menu', 'User menu')}>
            <Avatar size={32} style={{ background: `linear-gradient(135deg, ${palette.primary400}, ${palette.primary600})`, fontWeight: 600 }}>
              {(userName || 'U').slice(0, 1).toUpperCase()}
            </Avatar>
            <span style={{ fontSize: 13, color: isDark ? palette.darkInk : palette.ink900, maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userName ?? 'User'}
            </span>
            <DownOutlined style={{ fontSize: 10, color: palette.ink500 }} />
          </button>
        </Dropdown>
      </Space>
    </Header>
  );
};

export default TopBar;
