import React from 'react';
import { Layout, Button, Tooltip, Avatar, Dropdown, Space, Badge } from 'antd';
import {
  MenuFoldOutlined, MenuUnfoldOutlined, MoonOutlined, SunOutlined,
  LogoutOutlined, UserOutlined, BellOutlined, SearchOutlined, DownOutlined, PlusOutlined,
  QuestionCircleOutlined, ColumnHeightOutlined, SettingOutlined, MenuOutlined,
  StarOutlined, StarFilled,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store';
import { useUiStore } from '../stores/uiStore';
import { useNavStore } from '../stores/navStore';
import { palette, space, radius, layout, transitions, glass, zIndex } from '../theme/tokens';
import Breadcrumb from './Breadcrumb';
import { useUnreadCount } from './NotificationsDrawer';
import OrgSwitcher from './OrgSwitcher';
import BranchSwitcher from './BranchSwitcher';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useViewport } from '../hooks/useViewport';

const { Header } = Layout;

interface TopBarProps {
  collapsed: boolean;
  onToggle: () => void;
  isRTL: boolean;
  isDark: boolean;
  onOpenPalette?: () => void;
  /** Whether the mobile SideNav drawer is open — used for aria-expanded */
  drawerOpen?: boolean;
}

/**
 * TopBar — sticky glass-morphism header.
 *
 * - position: sticky; top: 0; z-index: 1100 (zIndex.sticky)
 * - Glass Morphism: backdrop-filter blur(20px) saturate(160%) from glass.topbar tokens
 * - @supports not (backdrop-filter) fallback to solid surface token
 * - Includes: OrgSwitcher, BranchSwitcher, QuickSearch (⌘K), NotificationsDrawer trigger,
 *   LanguageSwitcher, ThemeToggle
 *
 * Requirements: 4.5, 4.6, 4.9, 12.1
 */
export const TopBar: React.FC<TopBarProps> = ({ collapsed, onToggle, isRTL, isDark, onOpenPalette, drawerOpen = false }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { userName, logout, toggleTheme } = useAuthStore();
  const setNotificationsOpen = useUiStore((s) => s.setNotificationsOpen);
  const setQuickCreateOpen = useUiStore((s) => s.setQuickCreateOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const density = useUiStore((s) => s.density);
  const setDensity = useUiStore((s) => s.setDensity);
  const unread = useUnreadCount();
  const { isMobile } = useViewport();

  // Favorite toggle for current page — mobile only
  const navFavorites = useNavStore((s) => s.favorites);
  const navPin = useNavStore((s) => s.pin);
  const navUnpin = useNavStore((s) => s.unpin);
  const currentPath = location.pathname;
  const isCurrentFav = navFavorites.some((f) => f.key === currentPath);
  const toggleCurrentFav = () => {
    if (isCurrentFav) {
      navUnpin(currentPath);
    } else {
      // Derive a label from the path — capitalize last segment
      const segments = currentPath.split('/').filter(Boolean);
      const label = segments.length > 0
        ? segments[segments.length - 1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : currentPath;
      navPin({ key: currentPath, label, section: segments[0] ?? '' });
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const collapseIcon = isRTL
    ? (collapsed ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />)
    : (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />);

  // Glass morphism tokens — Requirements 4.6, 12.1
  const glassTokens = isDark ? glass.topbar.dark : glass.topbar.light;
  const solidFallbackBg = isDark ? palette.darkSurface : palette.surface;
  const borderCol  = glassTokens.border;
  const searchBg   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
  const searchBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const searchInk  = isDark ? 'rgba(255,255,255,0.62)' : palette.ink500;
  const kbdBg      = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)';
  const userInk    = isDark ? palette.darkInk : palette.ink900;

  // ─── Mobile compact TopBar — Requirements 2.1–2.8 ───────────────────────
  if (isMobile) {
    return (
      <Header
        className="topbar topbar--mobile"
        style={{
          // Safe-area padding — Requirement 2.7, 10.3
          paddingInlineStart: 'max(16px, env(safe-area-inset-left, 0px))',
          paddingInlineEnd: 'max(16px, env(safe-area-inset-right, 0px))',
          paddingBlockStart: 'env(safe-area-inset-top, 0px)',
          background: glassTokens.bg,
          borderBlockEnd: `1px solid ${borderCol}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          insetBlockStart: 0,
          zIndex: zIndex.sticky,
          // 56px height — Requirement 2.1
          height: 56,
          backdropFilter: glassTokens.blur,
          WebkitBackdropFilter: glassTokens.blur,
          boxShadow: isDark
            ? '0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.18)'
            : '0 1px 0 rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)',
        }}
      >
        <style>{topbarCss(solidFallbackBg, isDark)}</style>

        {/* RTL: hamburger on inline-end, bell on inline-start — Requirement 2.8, 11.6 */}
        {isRTL ? (
          <>
            {/* Star + Bell on inline-start for RTL */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                type="text"
                shape="circle"
                icon={isCurrentFav
                  ? <StarFilled style={{ color: '#F59E0B', fontSize: 16 }} />
                  : <StarOutlined style={{ fontSize: 16 }} />
                }
                onClick={toggleCurrentFav}
                aria-label={isCurrentFav ? t('remove_favorite', 'Remove favorite') : t('add_favorite', 'Add favorite')}
                className="tb-icon-btn tb-mobile-touch"
                style={{ color: isCurrentFav ? '#F59E0B' : undefined }}
              />
              <Badge count={unread} size="small" offset={[-4, 4]} color="#EF4444">
                <Button
                  type="text"
                  shape="circle"
                  icon={<BellOutlined />}
                  onClick={() => setNotificationsOpen(true)}
                  aria-label={t('topbar.notifications', 'Notifications')}
                  className="tb-icon-btn tb-mobile-touch"
                />
              </Badge>
            </div>

            {/* Centered logo */}
            <span style={{ fontWeight: 700, fontSize: 16, color: isDark ? '#fff' : palette.ink900, flex: 1, textAlign: 'center' }}>
              {t('app_name', 'ERP IQ')}
            </span>

            {/* Hamburger on inline-end for RTL */}
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={onToggle}
              aria-label={t('toggle_menu', 'Toggle menu')}
              aria-expanded={drawerOpen}
              className="tb-icon-btn tb-mobile-touch"
            />
          </>
        ) : (
          <>
            {/* Hamburger on inline-start for LTR */}
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={onToggle}
              aria-label={t('toggle_menu', 'Toggle menu')}
              aria-expanded={drawerOpen}
              className="tb-icon-btn tb-mobile-touch"
            />

            {/* Centered logo */}
            <span style={{ fontWeight: 700, fontSize: 16, color: isDark ? '#fff' : palette.ink900, flex: 1, textAlign: 'center' }}>
              {t('app_name', 'ERP IQ')}
            </span>

            {/* Star + Bell on inline-end for LTR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                type="text"
                shape="circle"
                icon={isCurrentFav
                  ? <StarFilled style={{ color: '#F59E0B', fontSize: 16 }} />
                  : <StarOutlined style={{ fontSize: 16 }} />
                }
                onClick={toggleCurrentFav}
                aria-label={isCurrentFav ? t('remove_favorite', 'Remove favorite') : t('add_favorite', 'Add favorite')}
                className="tb-icon-btn tb-mobile-touch"
                style={{ color: isCurrentFav ? '#F59E0B' : undefined }}
              />
              <Badge count={unread} size="small" offset={[-4, 4]} color="#EF4444">
                <Button
                  type="text"
                  shape="circle"
                  icon={<BellOutlined />}
                  onClick={() => setNotificationsOpen(true)}
                  aria-label={t('topbar.notifications', 'Notifications')}
                  className="tb-icon-btn tb-mobile-touch"
                />
              </Badge>
            </div>
          </>
        )}
      </Header>
    );
  }

  // ─── Desktop / Tablet full TopBar ────────────────────────────────────────

  const userMenu = {
    items: [
      { key: 'profile',   icon: <UserOutlined />,           label: t('profile', 'Profile') },
      { key: 'settings',  icon: <SettingOutlined />,        label: t('settings'), onClick: () => navigate('/settings') },
      { key: 'shortcuts', icon: <QuestionCircleOutlined />, label: `${t('shortcuts.title', 'Keyboard shortcuts')}  ?`, onClick: () => setShortcutsOpen(true) },
      { type: 'divider' as const },
      { key: 'logout',    icon: <LogoutOutlined />, danger: true, label: t('logout'), onClick: handleLogout },
    ],
  };
  const densityMenu = {
    items: [
      { key: 'compact',     label: t('density.compact', 'Compact'),         onClick: () => setDensity('compact') },
      { key: 'comfortable', label: t('density.comfortable', 'Comfortable'), onClick: () => setDensity('comfortable') },
      { key: 'spacious',    label: t('density.spacious', 'Spacious'),       onClick: () => setDensity('spacious') },
    ],
    selectedKeys: [density],
  };

  return (
    <Header
      className="topbar"
      style={{
        padding: `0 ${space.lg}px`,
        // Glass morphism background — Requirement 12.1
        background: glassTokens.bg,
        borderBottom: `1px solid ${borderCol}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.md,
        // Sticky positioning — Requirement 4.5
        position: 'sticky',
        top: 0,
        // z-index 1100 per spec — Requirement 4.5
        zIndex: zIndex.sticky,
        height: layout.topbarHeight,
        // Glass morphism blur — Requirement 4.6, 12.1
        backdropFilter: glassTokens.blur,
        WebkitBackdropFilter: glassTokens.blur,
        boxShadow: isDark
          ? '0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.18)'
          : '0 1px 0 rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)',
      }}
    >
      {/* Inline CSS: @supports not (backdrop-filter) fallback + micro-interactions */}
      <style>{topbarCss(solidFallbackBg, isDark)}</style>

      {/* Left: collapse toggle + breadcrumb */}
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

      {/* Center: pill command search — QuickSearch ⌘K trigger — Requirement 4.9 */}
      <button
        type="button"
        onClick={onOpenPalette}
        aria-label={t('search_or_jump', 'Search or jump to\u2026')}
        className="tb-search"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space.sm,
          background: searchBg,
          border: `1px solid ${searchBorder}`,
          borderRadius: radius.pill,
          padding: `8px 14px`,
          color: searchInk,
          cursor: 'pointer',
          minWidth: 320,
          maxWidth: 460,
          fontSize: 13,
          transition: transitions.base,
          flexShrink: 0,
          height: 38,
        }}
      >
        <SearchOutlined style={{ fontSize: 14 }} />
        <span style={{ flex: 1, textAlign: 'start', color: searchInk }}>
          {t('search_or_jump', 'Search or jump to\u2026')}
        </span>
        <kbd
          style={{
            background: kbdBg,
            border: `1px solid ${searchBorder}`,
            borderRadius: 6,
            padding: '2px 7px',
            fontSize: 11,
            color: searchInk,
            fontFamily: '"SF Mono","JetBrains Mono",Consolas,monospace',
            fontWeight: 500,
          }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Right: action cluster */}
      <Space size={4} align="center" style={{ flexShrink: 0 }}>
        {/* Quick create */}
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

        {/* OrgSwitcher — Requirement 4.9 */}
        <OrgSwitcher isRTL={isRTL} />

        {/* BranchSwitcher — Requirement 4.9 */}
        <BranchSwitcher isRTL={isRTL} />

        <span className="tb-divider" style={{ background: borderCol }} />

        {/* NotificationsDrawer trigger — Requirement 4.9 */}
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

        {/* Help / shortcuts */}
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

        {/* Density switcher */}
        <Dropdown
          menu={densityMenu}
          placement={isRTL ? 'bottomLeft' : 'bottomRight'}
          trigger={['click']}
        >
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

        {/* ThemeToggle — Requirement 4.9 */}
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

        {/* LanguageSwitcher — Requirement 4.9, 3.2 */}
        <LanguageSwitcher size="small" type="text" showLabel className="tb-icon-btn tb-lang-btn" />

        <span className="tb-divider" style={{ background: borderCol }} />

        {/* User menu */}
        <Dropdown
          menu={userMenu}
          placement={isRTL ? 'bottomLeft' : 'bottomRight'}
          trigger={['click']}
        >
          <button
            type="button"
            className="tb-user-btn"
            aria-label={t('user_menu', 'User menu')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space.sm,
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
              {/* Online presence dot */}
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  insetInlineEnd: 0,
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: '#16A34A',
                  border: `2px solid ${isDark ? '#111A2E' : '#fff'}`,
                }}
              />
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: userInk,
                maxWidth: 110,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {userName ?? 'User'}
            </span>
            <DownOutlined style={{ fontSize: 9, color: searchInk }} />
          </button>
        </Dropdown>
      </Space>
    </Header>
  );
};

/**
 * Generates topbar CSS including:
 * - @supports not (backdrop-filter) fallback to solid surface — Requirement 12.5
 * - Micro-interaction hover/active states — Requirement 8.1–8.8
 * - Responsive hiding of search bar on small screens
 */
function topbarCss(solidFallbackBg: string, isDark: boolean): string {
  return `
    /* Glass morphism @supports fallback — Requirement 12.5 */
    @supports not (backdrop-filter: blur(1px)) {
      .topbar {
        background: ${solidFallbackBg} !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
    }

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

    .tb-lang-btn {
      border-radius: 10px !important;
      padding-inline: 10px !important;
    }

    @media (max-width: 960px) {
      .tb-search { min-width: 200px !important; }
    }
    @media (max-width: 720px) {
      .tb-search { display: none !important; }
    }

    /* Mobile touch targets ≥ 44×44px — Requirement 9.5 */
    .tb-mobile-touch {
      min-inline-size: 44px !important;
      min-block-size: 44px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
  `;
}

export default TopBar;
