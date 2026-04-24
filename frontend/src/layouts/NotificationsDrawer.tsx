import React from 'react';
import { Drawer, Tabs, Button, Empty, Avatar, Badge } from 'antd';
import {
  CheckOutlined, FileTextOutlined, BankOutlined, UserOutlined,
  ShoppingCartOutlined, BellOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '../stores/uiStore';
import { palette, space, radius, layout } from '../theme/tokens';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  ts: Date;
  read: boolean;
  module: 'invoice' | 'bill' | 'banking' | 'inventory' | 'crm' | 'system';
  link?: string;
}

const ICON_MAP: Record<NotificationItem['module'], React.ReactNode> = {
  invoice: <FileTextOutlined />,
  bill: <FileTextOutlined />,
  banking: <BankOutlined />,
  inventory: <ShoppingCartOutlined />,
  crm: <UserOutlined />,
  system: <BellOutlined />,
};

const COLOR_MAP: Record<NotificationItem['module'], string> = {
  invoice: palette.primary500,
  bill: palette.warning,
  banking: palette.success,
  inventory: palette.info,
  crm: '#8B5CF6',
  system: palette.ink500,
};

// Mock seed — replaced by /api/notifications when backend ready
function makeMockNotifications(): NotificationItem[] {
  const now = Date.now();
  return [
    { id: '1', title: 'پسووڵەی نوێ', body: 'INV-000007 ئامادەیە بۆ ناردن', ts: new Date(now - 5 * 60_000), read: false, module: 'invoice', link: '/invoices' },
    { id: '2', title: 'دانان وەرگیراوە', body: 'BILL-000012 پەسەند کرا', ts: new Date(now - 45 * 60_000), read: false, module: 'bill', link: '/bills' },
    { id: '3', title: 'هاوکاتکردنی بانک', body: '٧ تۆمار هاوکاتی نوێ', ts: new Date(now - 3 * 60 * 60_000), read: false, module: 'banking', link: '/banking' },
    { id: '4', title: 'گەڕانەوەی کاڵا', body: 'گەڕانەوەی کاڵای SO-22', ts: new Date(now - 26 * 60 * 60_000), read: true, module: 'inventory', link: '/inventory' },
    { id: '5', title: 'لیدی نوێ', body: 'لیدی نوێ لە CRM', ts: new Date(now - 48 * 60 * 60_000), read: true, module: 'crm', link: '/crm/leads' },
  ];
}

const isToday = (d: Date) => {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
};

const formatRelative = (d: Date, t: ReturnType<typeof useTranslation>['t']): string => {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return t('footer.just_now', 'ئێستا');
  if (diff < 3600) return t('footer.minutes_ago', '{{n}}m ago', { n: Math.floor(diff / 60) });
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

interface NotificationsDrawerProps {
  isDark: boolean;
  isRTL: boolean;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ isDark, isRTL }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = useUiStore((s) => s.notificationsOpen);
  const setOpen = useUiStore((s) => s.setNotificationsOpen);
  const [items, setItems] = React.useState<NotificationItem[]>(makeMockNotifications);

  const today = items.filter((n) => !n.read && isToday(n.ts));
  const earlier = items.filter((n) => !n.read && !isToday(n.ts));
  const read = items.filter((n) => n.read);

  const markAllRead = () => setItems((arr) => arr.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) => setItems((arr) => arr.map((n) => n.id === id ? { ...n, read: true } : n));

  const onItemClick = (n: NotificationItem) => {
    markRead(n.id);
    if (n.link) {
      navigate(n.link);
      setOpen(false);
    }
  };

  const renderList = (list: NotificationItem[]) => {
    if (list.length === 0) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('notifications_v2.empty', 'هیچ ئاگادارییەک نییە')} style={{ marginTop: 40 }} />;
    }
    return (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {list.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onItemClick(n)}
              style={{
                width: '100%', textAlign: isRTL ? 'right' : 'left',
                display: 'flex', alignItems: 'flex-start', gap: space.sm,
                padding: `${space.sm}px ${space.md}px`,
                background: n.read ? 'transparent' : (isDark ? 'rgba(31,111,235,0.08)' : 'rgba(31,111,235,0.04)'),
                border: 'none', borderBottom: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
                cursor: 'pointer', color: 'inherit',
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? palette.darkElevated : palette.bg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = n.read ? 'transparent' : (isDark ? 'rgba(31,111,235,0.08)' : 'rgba(31,111,235,0.04)'); }}
            >
              <Avatar
                size={32}
                style={{ background: `${COLOR_MAP[n.module]}22`, color: COLOR_MAP[n.module], flexShrink: 0 }}
                icon={ICON_MAP[n.module]}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: space.xs }}>
                  <strong style={{ fontSize: 13, color: isDark ? palette.darkInk : palette.ink900 }}>{n.title}</strong>
                  <span style={{ fontSize: 11, color: palette.ink500, flexShrink: 0 }}>{formatRelative(n.ts, t)}</span>
                </div>
                <div style={{ fontSize: 12, color: isDark ? palette.darkInkMuted : palette.ink500, marginTop: 2 }}>{n.body}</div>
              </div>
              {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: palette.primary500, flexShrink: 0, marginTop: 6 }} aria-label="unread" />}
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Drawer
      open={open}
      onClose={() => setOpen(false)}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
          <span>{t('notifications_v2.title', 'ئاگادارییەکان')}</span>
          {(today.length + earlier.length) > 0 && (
            <Button type="link" size="small" icon={<CheckOutlined />} onClick={markAllRead}>
              {t('notifications_v2.mark_all_read', 'هەمووی وەک خوێندراو دانێ')}
            </Button>
          )}
        </div>
      }
      placement={isRTL ? 'left' : 'right'}
      size="default"
      styles={{ body: { padding: 0 } }}
    >
      <Tabs
        defaultActiveKey="today"
        size="small"
        style={{ paddingInline: space.md }}
        items={[
          { key: 'today', label: <span><Badge count={today.length} size="small" offset={[8, -2]} color={palette.primary500}>{t('notifications_v2.tab_today', 'ئەمڕۆ')}</Badge></span>, children: renderList(today) },
          { key: 'earlier', label: <span><Badge count={earlier.length} size="small" offset={[8, -2]} color={palette.ink500}>{t('notifications_v2.tab_earlier', 'پێشتر')}</Badge></span>, children: renderList(earlier) },
          { key: 'read', label: t('notifications_v2.tab_read', 'خوێندراو'), children: renderList(read) },
        ]}
      />
    </Drawer>
  );
};

export default NotificationsDrawer;

// Helper for TopBar to read unread count
export function useUnreadCount(): number {
  const open = useUiStore((s) => s.notificationsOpen);
  // Re-derive on every drawer toggle (cheap). For real backend, replace with store.
  const [n] = React.useState(() => makeMockNotifications().filter((x) => !x.read).length);
  return open ? 0 : n;
}
