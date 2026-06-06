import React from 'react';
import { Layout, Button, Tooltip, Space, Badge, Avatar, Dropdown } from 'antd';
import {
  MenuFoldOutlined, MenuUnfoldOutlined, MoonOutlined, SunOutlined,
  BellOutlined, SearchOutlined, PlusOutlined,
  QuestionCircleOutlined, MenuOutlined,
  ShopOutlined,
  UserOutlined, SettingOutlined, LogoutOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { useUiStore } from '../stores/uiStore';
import { palette, space, radius, transitions, glass, zIndex } from '../theme/tokens';
import Breadcrumb from './Breadcrumb';
import { useUnreadCount } from './NotificationsDrawer';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useViewport } from '../hooks/useViewport';
import RoleIdentityChip from '../components/role/RoleIdentityChip';
import { useRoleUx } from '../hooks/useRoleUx';

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
  const { t, i18n: _i18n } = useTranslation();
  const navigate = useNavigate();
  const { logout, toggleTheme } = useAuthStore();
  const setNotificationsOpen = useUiStore((s) => s.setNotificationsOpen);
  const setQuickCreateOpen = useUiStore((s) => s.setQuickCreateOpen);
  const { roleLabel } = useRoleUx();
  const density = useUiStore((s) => s.density);
  const setDensity = useUiStore((s) => s.setDensity);
  const unread = useUnreadCount();
  const { isMobile } = useViewport();

  // Favorite/star toggle was removed from the mobile TopBar (the user asked
  // to drop the star icon entirely). The favorite logic still lives in
  // useNavStore for the sidebar's pinned-favorites list; we just no longer
  // surface a one-tap toggle in the TopBar.

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
  const _userInk    = isDark ? palette.darkInk : palette.ink900;

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

        {/* Mobile right cluster — kit-parity essentials (the user explicitly
            asked for ALL important sections to be reachable on mobile, not
            just hamburger+bell). Order: + New · Bell · Help · Theme · Lang ·
            Favorite · Avatar dropdown. Each control is 36px to fit comfortably
            in the 56px header while keeping a 44px touch target via padding. */}
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={onToggle}
          aria-label={t('toggle_menu', 'Toggle menu')}
          aria-expanded={drawerOpen}
          className="tb-icon-btn tb-mobile-touch"
          style={{ flexShrink: 0 }}
        />

        {/* Compact title — kept short so it doesn't push action icons off
            screen on narrow viewports. Hidden via CSS at &lt;360px. */}
        <span
          className="tb-mobile-title"
          style={{
            fontWeight: 700, fontSize: 15,
            color: isDark ? '#fff' : palette.ink900,
            flex: 1, textAlign: 'center',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {t('app_name', 'ERP IQ')}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {/* Bell */}
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

          {/* Help */}
          <Button
            type="text"
            shape="circle"
            icon={<QuestionCircleOutlined />}
            onClick={() => window.dispatchEvent(new Event('open-help-panel'))}
            aria-label={t('help.openHelp', 'Help & support')}
            className="tb-icon-btn tb-mobile-touch tb-mobile-secondary"
          />

          {/* Theme */}
          <Button
            type="text"
            shape="circle"
            icon={isDark ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggleTheme}
            aria-label={isDark ? t('light_mode') : t('dark_mode')}
            className="tb-icon-btn tb-mobile-touch tb-mobile-secondary"
          />

          {/* Language */}
          <LanguageSwitcher
            size="small"
            type="text"
            showLabel
            className="tb-icon-btn tb-mobile-touch tb-mobile-secondary tb-lang-btn"
          />

          {/* Profile / user menu — the user said profile is "very important"
              on mobile; we put it last (closest to the inline-end so it's
              thumb-reachable on RTL too via the flip) with a dropdown that
              exposes Profile, Settings, Theme, Language, Logout. */}
          <Dropdown
            placement={isRTL ? 'bottomLeft' : 'bottomRight'}
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'role',
                  type: 'group',
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <Avatar size={28} style={{ background: 'var(--accent-soft)', color: 'var(--accent-500)' }}>
                        {(useAuthStore.getState().userName || 'U').slice(0, 1).toUpperCase()}
                      </Avatar>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--ink-900)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {useAuthStore.getState().userName || t('profile', 'Profile')}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--accent-400)', fontWeight: 600 }}>
                          {roleLabel}
                        </div>
                      </div>
                    </div>
                  ),
                },
                { type: 'divider' },
                { key: 'profile', icon: <UserOutlined />, label: t('profile', 'Profile'), onClick: () => navigate('/settings?s=profile') },
                { key: 'settings', icon: <SettingOutlined />, label: t('settings', 'Settings'), onClick: () => navigate('/settings') },
                // Theme + Language live in the menu too — when the viewport is
                // narrow (≤480px) the visible quick-icons hide; the user can
                // still toggle them from here.
                {
                  key: 'theme',
                  icon: isDark ? <SunOutlined /> : <MoonOutlined />,
                  label: isDark ? t('light_mode', 'Light mode') : t('dark_mode', 'Dark mode'),
                  onClick: toggleTheme,
                },
                {
                  key: 'help',
                  icon: <QuestionCircleOutlined />,
                  label: t('help.openHelp', 'Help & support'),
                  onClick: () => window.dispatchEvent(new Event('open-help-panel')),
                },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, danger: true, label: t('logout', 'Log out'), onClick: handleLogout },
              ],
            }}
          >
            <Button
              type="text"
              shape="circle"
              aria-label={t('profile', 'Profile')}
              className="tb-mobile-touch"
              style={{ padding: 0, marginInlineStart: 4 }}
              icon={
                <Avatar size={30} style={{ background: 'var(--accent-soft)', color: 'var(--accent-500)' }}>
                  {(useAuthStore.getState().userName || 'U').slice(0, 1).toUpperCase()}
                </Avatar>
              }
            />
          </Dropdown>
        </div>
      </Header>
    );
  }

  // ─── Desktop / Tablet full TopBar — Vertex kit shell.jsx parity ─────────
  // The user explicitly asked: "make the TopBar look like the kit, only those
  // sections, nothing else". Per the kit (shell.jsx TopBar) the right cluster
  // is, IN ORDER: role pill · + New · bell · help · language · theme ·
  // divider · avatar dropdown. Everything else the previous TopBar showed
  // (quick-action buttons, OrgSwitcher, BranchSwitcher, EntitySwitcher,
  // density dropdown, extra dividers around switchers) is REMOVED here.
  // density/setDensity/Dropdown imports stay reserved for a future settings
  // location, but the topbar control itself is gone.
  void density; void setDensity;

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
        // Vertex shell: 56px glass top bar (mobile header is already 56)
        height: 56,
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

      {/* Right cluster — kit TopBar (shell.jsx) order:
            role pill · + New · bell · help · language · theme · divider · avatar */}
      <Space size={4} align="center" style={{ flexShrink: 0 }}>
        {/* Role pill (Owner / Accountant / …) — the kit's vx-rolebadge */}
        <span
          className="tb-rolebadge"
          aria-label={t('role.current', 'Current role: {{role}}', { role: roleLabel })}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 28, padding: '0 11px', borderRadius: 999,
            background: 'var(--accent-soft)', color: 'var(--accent-400)',
            fontSize: 12, fontWeight: 600, marginInlineEnd: 6,
            border: '1px solid color-mix(in srgb, var(--accent-500) 28%, transparent)',
            whiteSpace: 'nowrap',
          }}
        >
          <ShopOutlined style={{ fontSize: 13 }} />{roleLabel}
        </span>

        {/* + New — kit shows accent button with "New" text, not bare circle */}
        <Tooltip title={t('topbar.quick_create', 'Quick create')}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setQuickCreateOpen(true)}
            aria-label={t('topbar.quick_create', 'Quick create')}
            className="tb-cta-btn"
            style={{ marginInlineEnd: 6 }}
          >
            {t('new', 'New')}
          </Button>
        </Tooltip>

        {/* Bell */}
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

        {/* Help */}
        <Tooltip title={t('help.openHelp', 'Help & support')}>
          <Button
            type="text"
            shape="circle"
            icon={<QuestionCircleOutlined />}
            onClick={() => window.dispatchEvent(new Event('open-help-panel'))}
            aria-label={t('help.openHelp', 'Help & support')}
            className="tb-icon-btn"
          />
        </Tooltip>

        {/* Language */}
        <LanguageSwitcher size="small" type="text" showLabel className="tb-icon-btn tb-lang-btn" />

        {/* Theme */}
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

        <span className="tb-divider" style={{ background: borderCol }} />

        {/* User avatar dropdown */}
        <RoleIdentityChip isDark={isDark} onLogout={handleLogout} />
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
function topbarCss(solidFallbackBg: string, _isDark: boolean): string {
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
      background: rgba(123,97,255,0.08) !important;
      transform: translateY(-1px);
    }
    .tb-icon-btn:active { transform: translateY(0); }

    .tb-cta-btn:hover {
      transform: translateY(-1px) scale(1.04);
      box-shadow: 0 6px 18px rgba(123,97,255,0.42) !important;
    }
    .tb-cta-btn { transition: transform 0.15s, box-shadow 0.2s !important; }

    .tb-search:hover {
      border-color: rgba(123,97,255,0.32) !important;
      background: rgba(123,97,255,0.05) !important;
    }
    .tb-search:focus-visible {
      outline: 2px solid rgba(123,97,255,0.45);
      outline-offset: 2px;
    }

    .tb-user-btn:hover {
      border-color: rgba(123,97,255,0.32) !important;
      background: rgba(123,97,255,0.06) !important;
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

    /* Mobile responsive cluster — when the viewport gets too narrow,
       the "secondary" controls (Theme, Language, Favorite, Help) collapse
       into the profile menu so the primary actions (+New, Bell, Avatar)
       always remain reachable on a thumb-friendly 44×44 target. */
    @media (max-width: 480px) {
      .tb-mobile-secondary { display: none !important; }
      .tb-mobile-title { font-size: 14px !important; }
    }
    @media (max-width: 380px) {
      .tb-mobile-title { display: none !important; }
    }
  `;
}

export default TopBar;
