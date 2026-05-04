import React from 'react';
import { Layout, Button, Tooltip, Avatar, Dropdown, Space, Badge } from 'antd';
import {
  MenuFoldOutlined, MenuUnfoldOutlined, MoonOutlined, SunOutlined, GlobalOutlined,
  LogoutOutlined, UserOutlined, BellOutlined, SearchOutlined, DownOutlined, PlusOutlined,
  QuestionCircleOutlined, ColumnHeightOutlined, SettingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { useUiStore } from '../stores/uiStore';
import { palette, space, radius, layout, transitions } from '../theme/tokens';
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

/**
 * TopBar v2 — premium glass header.
 * - Glassmorphism + subtle gradient underline
 * - Pill-shaped command-K search w/ animated focus
 * - Refined icon cluster + grouped pill controls
 * - Gradient avatar w/ presence dot
 */
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
    { key: 'profile',   icon: <UserOutlined />,             label: t('profile', 'Profile') },
    { key: 'settings',  icon: <SettingOutlined />,          label: t('settings'), onClick: () => navigate('/settings') },
    { key: 'shortcuts', icon: <QuestionCircleOutlined />,   label: `${t('shortcuts.title', 'Keyboard shortcuts')}  ?`, onClick: () => setShortcutsOpen(true) },
    { type: 'divider' as const },
    { key: 'logout',    icon: <LogoutOutlined />, danger: true, label: t('logout'), onClick: handleLogout },
  ] };
  const densityMenu = { items: [
    { key: 'compact',     label: t('density.compact', 'Compact'),         onClick: () => setDensity('compact') },
    { key: 'comfortable', label: t('density.comfortable', 'Comfortable'), onClick: () => setDensity('comfortable') },
    { key: 'spacious',    label: t('density.spacious', 'Spacious'),       onClick: () => setDensity('spacious') },
  ], selectedKeys: [density] };

  // Theme-aware colors
  const headerBg = isDark
    ? 'linear-gradient(180deg, rgba(17,26,46,0.86) 0%, rgba(17,26,46,0.78) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.82) 100%)';
  const borderCol = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
  const searchBg  = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
  const searchBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const searchInk = isDark ? 'rgba(255,255,255,0.62)' : palette.ink500;
  const kbdBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)';
  const userInk = isDark ? palette.darkInk : palette.ink900;

  return (
    <Header style={{
      padding: `0 ${space.lg}px`,
      background: headerBg,
      borderBottom: `1px solid ${borderCol}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: space.md, position: 'sticky', top: 0, zIndex: 99,
      height: layout.topbarHeight,
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      boxShadow: isDark
        ? '0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.18)'
        : '0 1px 0 rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)',
    }}>
      <style>{topbarCss}</style>

      {/* Left: collapse + breadcrumb */}
      <Space size={space.sm} align="center" style={{ minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
        <Button
          type="text"
          icon={collapseIcon}
          onClick={onToggle}
          size="large"
          aria-label={t('toggle_menu', 'Toggle menu')}
          className="tb-icon-btn"
        />
        <Breadcrumb isDark={isDark} isRTL={isRTL} />
      </Space>

      {/* Center: pill command search */}
      <button
        type="button"
        onClick={onOpenPalette}
        aria-label={t('search_or_jump', 'Search or jump to\u2026')}
        className="tb-search"
        style={{
          display: 'flex', alignItems: 'center', gap: space.sm,
          background: searchBg,
          border: `1px solid ${searchBorder}`,
          borderRadius: radius.pill,
          padding: `8px 14px`,
          color: searchInk,
          cursor: 'pointer',
          minWidth: 320, maxWidth: 460, fontSize: 13,
          transition: transitions.base,
          flexShrink: 0,
          height: 38,
        }}
      >
        <SearchOutlined style={{ fontSize: 14 }} />
        <span style={{ flex: 1, textAlign: 'start', color: searchInk }}>
          {t('search_or_jump', 'Search or jump to\u2026')}
        </span>
        <kbd style={{
          background: kbdBg,
          border: `1px solid ${searchBorder}`,
          borderRadius: 6,
          padding: '2px 7px',
          fontSize: 11,
          color: searchInk,
          fontFamily: '"SF Mono","JetBrains Mono",Consolas,monospace',
          fontWeight: 500,
        }}>⌘K</kbd>
      </button>

      {/* Right: action cluster */}
      <Space size={4} align="center" style={{ flexShrink: 0 }}>
        <Tooltip title={t('topbar.quick_create', 'Quick create')}>
          <Button
            type="primary"
            shape="circle"
            icon={<PlusOutlined />}
            onClick={() => setQuickCreateOpen(true)}
            aria-label={t('topbar.quick_create', 'Quick create')}
            className="tb-cta-btn"
            style={{
              background: 'linear-gradient(135deg, #1F6FEB 0%, #114393 100%)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(31,111,235,0.32)',
            }}
          />
        </Tooltip>

        <span className="tb-divider" style={{ background: borderCol }} />

        <Tooltip title={t('topbar.notifications', 'Notifications')}>
          <Badge count={unread} size="small" offset={[-4, 4]} color="#EF4444">
            <Button
              type="text"
              shape="circle"
              icon={<BellOutlined />}
              onClick={() => setNotificationsOpen(true)}
              aria-label={t('topbar.notifications', 'Notifications')}
              className="tb-icon-btn"
            />
          </Badge>
        </Tooltip>

        <Tooltip title={t('topbar.help', 'Help')}>
          <Button
            type="text"
            shape="circle"
            icon={<QuestionCircleOutlined />}
            onClick={() => setShortcutsOpen(true)}
            aria-label={t('topbar.help', 'Help')}
            className="tb-icon-btn"
          />
        </Tooltip>

        <Dropdown menu={densityMenu} placement={isRTL ? 'bottomLeft' : 'bottomRight'} trigger={['click']}>
          <Tooltip title={t('topbar.density', 'Density')}>
            <Button
              type="text"
              shape="circle"
              icon={<ColumnHeightOutlined />}
              aria-label={t('topbar.density', 'Density')}
              className="tb-icon-btn"
            />
          </Tooltip>
        </Dropdown>

        <Tooltip title={isDark ? t('light_mode') : t('dark_mode')}>
          <Button
            type="text"
            shape="circle"
            icon={isDark ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggleTheme}
            aria-label={isDark ? t('light_mode') : t('dark_mode')}
            className="tb-icon-btn"
          />
        </Tooltip>

        <Tooltip title={i18n.language === 'ku' ? 'English' : '\u06A9\u0648\u0631\u062F\u06CC'}>
          <Button
            type="text"
            icon={<GlobalOutlined />}
            onClick={toggleLanguage}
            aria-label="Language"
            className="tb-icon-btn tb-lang-btn"
          >
            <span style={{ fontSize: 11, fontWeight: 600, marginInlineStart: 4 }}>
              {i18n.language === 'ku' ? 'EN' : '\u06A9\u0648'}
            </span>
          </Button>
        </Tooltip>

        <span className="tb-divider" style={{ background: borderCol }} />

        <OrgSwitcher isRTL={isRTL} />

        <Dropdown menu={userMenu} placement={isRTL ? 'bottomLeft' : 'bottomRight'} trigger={['click']}>
          <button
            type="button"
            className="tb-user-btn"
            aria-label={t('user_menu', 'User menu')}
            style={{
              display: 'flex', alignItems: 'center', gap: space.sm,
              background: searchBg,
              border: `1px solid ${searchBorder}`,
              cursor: 'pointer',
              padding: `4px 10px 4px 4px`,
              borderRadius: radius.pill,
              transition: transitions.base,
            }}
          >
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Avatar
                size={30}
                style={{
                  background: 'linear-gradient(135deg, #5B8DEF 0%, #1F6FEB 60%, #114393 100%)',
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: '0 2px 8px rgba(31,111,235,0.32)',
                }}
              >
                {(userName || 'U').slice(0, 1).toUpperCase()}
              </Avatar>
              <span style={{
                position: 'absolute', bottom: 0, insetInlineEnd: 0,
                width: 9, height: 9, borderRadius: '50%',
                background: '#16A34A',
                border: `2px solid ${isDark ? '#111A2E' : '#fff'}`,
              }} />
            </span>
            <span style={{
              fontSize: 13, fontWeight: 500,
              color: userInk,
              maxWidth: 110, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {userName ?? 'User'}
            </span>
            <DownOutlined style={{ fontSize: 9, color: searchInk }} />
          </button>
        </Dropdown>
      </Space>
    </Header>
  );
};

const topbarCss = `
  .tb-icon-btn {
    border-radius: 10px !important;
    transition: background 0.18s, transform 0.12s !important;
  }
  .tb-icon-btn:hover {
    background: rgba(31,111,235,0.08) !important;
    transform: translateY(-1px);
  }
  .tb-icon-btn:active { transform: translateY(0); }
  .tb-cta-btn:hover {
    transform: translateY(-1px) scale(1.04);
    box-shadow: 0 6px 18px rgba(31,111,235,0.42) !important;
  }
  .tb-cta-btn { transition: transform 0.15s, box-shadow 0.2s !important; }
  .tb-search:hover {
    border-color: rgba(31,111,235,0.32) !important;
    background: rgba(31,111,235,0.05) !important;
  }
  .tb-search:focus-visible {
    outline: 2px solid rgba(31,111,235,0.45);
    outline-offset: 2px;
  }
  .tb-user-btn:hover {
    border-color: rgba(31,111,235,0.32) !important;
    background: rgba(31,111,235,0.06) !important;
  }
  .tb-divider {
    width: 1px;
    height: 22px;
    margin: 0 6px;
    display: inline-block;
    align-self: center;
  }
  .tb-lang-btn { border-radius: 10px !important; padding-inline: 10px !important; }
  @media (max-width: 960px) {
    .tb-search { min-width: 200px !important; }
  }
  @media (max-width: 720px) {
    .tb-search { display: none !important; }
  }
`;

export default TopBar;
