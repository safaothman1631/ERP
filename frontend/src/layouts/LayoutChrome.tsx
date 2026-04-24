import React, { useEffect, useMemo, useState } from 'react';
import { Button, Tooltip } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AppstoreOutlined, CloseOutlined, DashboardOutlined, FileTextOutlined,
  HomeOutlined, MenuOutlined, SearchOutlined, ShoppingCartOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { buildNavSections, flattenRoutes } from './navigation';
import type { LayoutMode } from '../store';
import { palette, radius, shadow, space } from '../theme/tokens';
import api from '../api';

const BRAND = palette.primary500;
const INK = palette.ink900;
const INK_MUTED = palette.ink500;

/* ------------- Top Mega-Menu ------------- */
export const TopMegaMenu: React.FC<{ isDark: boolean; isRTL: boolean; onOpenPalette: () => void }> = ({
  isDark, isRTL, onOpenPalette,
}) => {
  const { t } = useTranslation();
  const sections = useMemo(() => buildNavSections(t), [t]);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const navigate = useNavigate();
  return (
    <div
      onMouseLeave={() => setOpenSection(null)}
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: isDark ? palette.darkSurface : palette.surface,
        borderBottom: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', height: 48, padding: `0 ${space.lg}px`, gap: 8, overflowX: 'auto' }}>
        <Link to="/" style={{ marginInlineEnd: 12, color: isDark ? '#fff' : INK, textDecoration: 'none', fontWeight: 700 }}>ERP</Link>
        {sections.map(sec => (
          <button
            key={sec.key}
            onMouseEnter={() => setOpenSection(sec.key)}
            onClick={() => setOpenSection(openSection === sec.key ? null : sec.key)}
            style={{
              background: openSection === sec.key ? (isDark ? '#1f2937' : '#eef2ff') : 'transparent',
              border: 'none', padding: '6px 12px', borderRadius: radius.sm, cursor: 'pointer',
              color: isDark ? '#e5e7eb' : INK, fontWeight: 600, fontSize: 13,
              whiteSpace: 'nowrap',
            }}
          >
            {sec.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <Button icon={<SearchOutlined />} onClick={onOpenPalette}>âŒ˜K</Button>
      </div>
      {openSection && (
        <div
          style={{
            position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, top: 48,
            background: isDark ? palette.darkSurface : palette.surface,
            borderBottom: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
            boxShadow: shadow.lg,
            padding: space.lg,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6,
            direction: isRTL ? 'rtl' : 'ltr',
            maxHeight: '60vh', overflowY: 'auto',
          }}
        >
          {sections.find(s => s.key === openSection)?.items.map(item => (
            <button
              key={item.key}
              onClick={() => { navigate(item.key); setOpenSection(null); }}
              style={{
                textAlign: isRTL ? 'right' : 'left', background: 'transparent',
                border: '1px solid transparent', borderRadius: radius.sm, padding: 8, cursor: 'pointer',
                color: isDark ? '#e5e7eb' : INK,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = isDark ? '#1f2937' : '#f3f4f6'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</div>
              {item.description && (
                <div style={{ fontSize: 11, color: INK_MUTED, marginTop: 2 }}>{item.description}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ------------- Bottom Nav (mobile-style) ------------- */
export const BottomNav: React.FC<{ isDark: boolean; onOpenPalette: () => void }> = ({ isDark, onOpenPalette }) => {
  const { t } = useTranslation();
  const loc = useLocation();
  const items = [
    { key: '/', icon: <HomeOutlined />, label: t('home', 'Home') },
    { key: '/invoices', icon: <FileTextOutlined />, label: t('invoices') },
    { key: '/items', icon: <ShoppingCartOutlined />, label: t('items') },
    { key: '/banking', icon: <WalletOutlined />, label: t('banking', 'Banking') },
  ];
  return (
    <nav
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: isDark ? palette.darkSurface : palette.surface,
        borderTop: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
        boxShadow: '0 -8px 24px rgba(0,0,0,0.08)',
        display: 'flex', justifyContent: 'space-around', padding: '8px 0',
      }}
    >
      {items.map(it => {
        const active = loc.pathname === it.key;
        return (
          <Link
            key={it.key}
            to={it.key}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              fontSize: 11, color: active ? BRAND : (isDark ? '#9ca3af' : INK_MUTED),
              textDecoration: 'none', minWidth: 56,
            }}
          >
            <span style={{ fontSize: 20 }}>{it.icon}</span>
            <span>{it.label}</span>
          </Link>
        );
      })}
      <button
        onClick={onOpenPalette}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          fontSize: 11, color: isDark ? '#9ca3af' : INK_MUTED, minWidth: 56,
        }}
      >
        <SearchOutlined style={{ fontSize: 20 }} />
        <span>âŒ˜K</span>
      </button>
    </nav>
  );
};

/* ------------- Workspace tabs ------------- */
const TABS_KEY = 'shell.workspaceTabs';
const MAX_TABS = 8;
const readTabs = (): string[] => {
  try { return JSON.parse(localStorage.getItem(TABS_KEY) || '[]'); } catch { return []; }
};
const writeTabs = (v: string[]) => { try { localStorage.setItem(TABS_KEY, JSON.stringify(v)); } catch { /* ignore */ } };

export const WorkspaceTabs: React.FC<{ isDark: boolean; isRTL: boolean }> = ({ isDark, isRTL }) => {
  const { t } = useTranslation();
  const loc = useLocation();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<string[]>(readTabs);
  const routes = useMemo(() => flattenRoutes(buildNavSections(t)), [t]);
  const labelOf = (path: string) =>
    routes.find(r => r.key === path)?.label || path;

  useEffect(() => {
    setTabs(prev => {
      if (!loc.pathname || prev.includes(loc.pathname)) return prev;
      const next = [loc.pathname, ...prev.filter(p => p !== loc.pathname)].slice(0, MAX_TABS);
      writeTabs(next);
      return next;
    });
  }, [loc.pathname]);

  const close = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => {
      const next = prev.filter(p => p !== path);
      writeTabs(next);
      if (loc.pathname === path && next.length) navigate(next[0]);
      return next;
    });
  };

  // ⌘1..⌘9 → jump to tab N; ⌘W → close current tab. (Sprint 4)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      // ⌘W close current
      if (e.key.toLowerCase() === 'w' && loc.pathname) {
        const idx = tabs.indexOf(loc.pathname);
        if (idx >= 0) {
          e.preventDefault();
          const next = tabs.filter(p => p !== loc.pathname);
          writeTabs(next);
          setTabs(next);
          if (next.length) navigate(next[Math.max(0, idx - 1)]);
        }
        return;
      }
      // ⌘1..⌘9 jump
      const n = parseInt(e.key, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 9 && tabs[n - 1]) {
        e.preventDefault();
        navigate(tabs[n - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tabs, loc.pathname, navigate]);

  if (!tabs.length) return null;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-end', gap: 2, padding: `4px ${space.lg}px 0`,
        background: isDark ? palette.darkBg : palette.bg,
        borderBottom: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
        overflowX: 'auto', direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      {tabs.map(p => {
        const active = loc.pathname === p;
        return (
          <div
            key={p}
            onClick={() => navigate(p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              background: active ? (isDark ? palette.darkSurface : palette.surface) : 'transparent',
              borderRadius: '8px 8px 0 0',
              border: active ? `1px solid ${isDark ? palette.darkBorder : palette.border}` : '1px solid transparent',
              borderBottom: 'none',
              cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400,
              color: isDark ? '#e5e7eb' : INK, whiteSpace: 'nowrap',
            }}
            title={`${labelOf(p)} — ${p}`}
          >
            <span>{labelOf(p)}</span>
            <CloseOutlined style={{ fontSize: 10, opacity: 0.6 }} onClick={e => close(p, e)} />
          </div>
        );
      })}
      <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 4, paddingInlineEnd: space.sm, opacity: 0.55, fontSize: 10, color: INK_MUTED }}>
        <span>⌘1..9 / ⌘W</span>
      </div>
    </div>
  );
};

/* ------------- Apps Launcher (replaces dashboard when active) ------------- */
export const AppsLauncher: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const { t } = useTranslation();
  const sections = useMemo(() => buildNavSections(t), [t]);
  const navigate = useNavigate();
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#a855f7'];
  return (
    <div style={{ padding: space.xl }}>
      <h2 style={{ color: isDark ? '#fff' : INK, marginBottom: space.lg }}>
        {t('apps_launcher_title', 'Apps')}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: space.lg }}>
        {sections.map((sec, i) => (
          <button
            key={sec.key}
            onClick={() => sec.items[0] && navigate(sec.items[0].key)}
            style={{
              aspectRatio: '1', border: 'none', cursor: 'pointer',
              borderRadius: radius.lg, background: colors[i % colors.length],
              color: '#fff', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: shadow.md, transition: 'transform 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <span style={{ fontSize: 32 }}>{sec.icon}</span>
            <span style={{ fontWeight: 600, fontSize: 14, textAlign: 'center', padding: '0 8px' }}>{sec.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

/* ------------- Command-Centric hero (always-visible big âŒ˜K button) ------------- */
export const CommandHero: React.FC<{ isDark: boolean; onOpenPalette: () => void }> = ({ isDark, onOpenPalette }) => (
  <div
    onClick={onOpenPalette}
    style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 60, padding: '8px 18px', borderRadius: 999, cursor: 'pointer',
      background: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)',
      border: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
      boxShadow: shadow.lg, display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 13, color: isDark ? '#e5e7eb' : INK,
      backdropFilter: 'blur(8px)', minWidth: 280, justifyContent: 'space-between',
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <SearchOutlined /> Type a command or searchâ€¦
    </span>
    <kbd style={{
      background: isDark ? '#1f2937' : '#f3f4f6', padding: '2px 6px',
      borderRadius: 4, fontSize: 11, fontFamily: 'monospace',
    }}>âŒ˜K</kbd>
  </div>
);

/* ─────────────── Layout Quick Dock (Home + Gallery escape hatch) ─────────────── */
export const LayoutQuickDock: React.FC<{ isDark: boolean; isRTL: boolean; topOffset?: number }> = ({ isDark, isRTL, topOffset = 12 }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const dockBg = isDark ? 'rgba(17,24,39,0.92)' : 'rgba(255,255,255,0.96)';
  const borderClr = isDark ? palette.darkBorder : palette.border;
  const itemBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: radius.md,
    color: isDark ? '#e5e7eb' : INK, textDecoration: 'none',
    fontWeight: 600, fontSize: 13, transition: 'background 0.15s',
  };
  const isHome = location.pathname === '/';
  const isGallery = location.pathname === '/ui-gallery';
  return (
    <div
      style={{
        position: 'fixed', top: topOffset, insetInlineStart: 12, zIndex: 1000,
        display: 'flex', alignItems: 'center', gap: 4,
        background: dockBg, border: `1px solid ${borderClr}`, borderRadius: radius.lg,
        padding: 4, boxShadow: shadow.md, backdropFilter: 'blur(8px)',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      <Tooltip title={t('nav.home', 'Home')}>
        <Link
          to="/"
          style={{ ...itemBase, background: isHome ? (isDark ? '#1f2937' : '#eef2ff') : 'transparent', color: isHome ? BRAND : itemBase.color }}
        >
          <HomeOutlined />
          <span>{t('nav.home', 'Home')}</span>
        </Link>
      </Tooltip>
      <Tooltip title={t('ui_gallery', 'Layout Gallery')}>
        <Link
          to="/ui-gallery"
          style={{ ...itemBase, background: isGallery ? (isDark ? '#1f2937' : '#eef2ff') : 'transparent', color: isGallery ? BRAND : itemBase.color }}
        >
          <AppstoreOutlined />
          <span>{t('ui_gallery', 'Layouts')}</span>
        </Link>
      </Tooltip>
    </div>
  );
};

/* ─────────────── helpers ─────────────── */
export const SIDEBAR_HIDDEN_MODES: LayoutMode[] = [
  'top-megamenu', 'command-centric', 'apps-launcher', 'mobile-bottom-nav',
];
export const FORCE_COLLAPSED_MODES: LayoutMode[] = [
  'icon-rail', 'dual-rail', 'split-master-detail',
];
export const SHOW_TABS_MODES: LayoutMode[] = ['workspace-tabs'];

/* ─────────────── Dashboard-First KPI Strip (Sprint 5) ─────────────── */
type KpiSummary = {
  revenue?: number;
  receivables?: number;
  payables?: number;
  cash?: number;
};

const fmtMoney = (n?: number) => {
  if (typeof n !== 'number') return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString();
};

/**
 * DashboardKpiStrip — persistent thin KPI strip for `dashboard-first` mode.
 * Pulls summary from /api/dashboard; gracefully degrades when offline.
 */
export const DashboardKpiStrip: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KpiSummary>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.get('/api/dashboard').then((res) => {
      if (!alive) return;
      const d = res.data || {};
      setKpis({
        revenue:     Number(d.total_revenue ?? d.revenue ?? d.totalRevenue ?? 0),
        receivables: Number(d.total_receivables ?? d.receivables ?? d.outstanding_invoices ?? 0),
        payables:    Number(d.total_payables ?? d.payables ?? d.outstanding_bills ?? 0),
        cash:        Number(d.cash_balance ?? d.cash ?? d.bank_balance ?? 0),
      });
    }).catch(() => { /* offline → leave zeros */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const items: Array<{ key: string; label: string; value: string; color: string; goTo: string }> = [
    { key: 'rev', label: t('kpi.revenue', 'داهات'),       value: fmtMoney(kpis.revenue),     color: palette.success, goTo: '/reports' },
    { key: 'ar',  label: t('kpi.receivables', 'وەرگرتنی پێشتر'), value: fmtMoney(kpis.receivables), color: palette.primary500, goTo: '/invoices' },
    { key: 'ap',  label: t('kpi.payables', 'دانانی پێشتر'),     value: fmtMoney(kpis.payables),    color: palette.warning, goTo: '/bills' },
    { key: 'cash',label: t('kpi.cash', 'پارەی نەخت'),     value: fmtMoney(kpis.cash),        color: palette.info, goTo: '/banking' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        gap: space.md,
        padding: `${space.md}px ${space.lg}px`,
        background: isDark ? palette.darkSurface : palette.surface,
        borderBottom: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
      }}
    >
      {items.map(it => (
        <button
          key={it.key}
          onClick={() => navigate(it.goTo)}
          style={{
            display: 'flex', flexDirection: 'column', gap: 4, padding: `${space.sm}px ${space.md}px`,
            border: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
            borderRadius: radius.md,
            background: isDark ? 'rgba(255,255,255,0.02)' : palette.bg,
            cursor: 'pointer', textAlign: 'start',
            transition: 'transform 0.12s, box-shadow 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = shadow.sm; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <span style={{ fontSize: 11, color: INK_MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{it.label}</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: it.color }}>
            {loading ? '…' : it.value}
          </span>
        </button>
      ))}
    </div>
  );
};

/* ─────────────── Split-Master-Detail Companion Panel (Sprint 4) ─────────────── */
const SPLIT_PANEL_KEY = 'shell.splitPanelWidth';
const SPLIT_PANEL_MIN = 260;
const SPLIT_PANEL_MAX = 520;
const SPLIT_PANEL_DEFAULT = 320;

const readSplitWidth = (): number => {
  const v = parseInt(localStorage.getItem(SPLIT_PANEL_KEY) || '', 10);
  return Number.isFinite(v) && v >= SPLIT_PANEL_MIN && v <= SPLIT_PANEL_MAX ? v : SPLIT_PANEL_DEFAULT;
};

/**
 * SplitMasterPanel — companion master-list pane between the icon rail and content.
 * Lists items of the active section (or default to Workspace utilities).
 * Resizable 260–520px, persisted to localStorage.
 */
export const SplitMasterPanel: React.FC<{ isDark: boolean; isRTL: boolean }> = ({ isDark, isRTL }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const loc = useLocation();
  const sections = useMemo(() => buildNavSections(t), [t]);
  const [width, setWidth] = useState<number>(readSplitWidth);
  const draggingRef = React.useRef(false);

  // Determine active section by current pathname; fall back to "Workspace" group (Approvals/Audit/Trash).
  const activeSection = useMemo(() => {
    const found = sections.find(sec => sec.items.some(it => loc.pathname === it.key || loc.pathname.startsWith(it.key + '/')));
    if (found) return found;
    // Fallback: build a virtual workspace section
    const workspacePaths = ['/approvals', '/audit-log', '/trash'];
    const items = sections.flatMap(s => s.items).filter(it => workspacePaths.includes(it.key));
    return { key: 'workspace', label: t('nav.workspace', 'Workspace'), icon: null, zone: 'finance-control' as const, items };
  }, [sections, loc.pathname, t]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const next = isRTL ? window.innerWidth - e.clientX - 72 : e.clientX - 72;
      const clamped = Math.max(SPLIT_PANEL_MIN, Math.min(SPLIT_PANEL_MAX, next));
      setWidth(clamped);
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.userSelect = '';
      try { localStorage.setItem(SPLIT_PANEL_KEY, String(width)); } catch { /* ignore */ }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isRTL, width]);

  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        background: isDark ? palette.darkSurface : palette.surface,
        borderInlineEnd: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
        display: 'flex',
        flexDirection: 'column',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      <div style={{
        padding: `${space.md}px ${space.lg}px`,
        borderBottom: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: INK_MUTED }}>
          {t('split_master.section', 'Section')}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: isDark ? '#e5e7eb' : INK, marginTop: 2 }}>
          {activeSection.label}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: space.sm }}>
        {activeSection.items.length === 0 ? (
          <div style={{ padding: space.lg, fontSize: 12, color: INK_MUTED, textAlign: 'center' }}>
            {t('split_master.empty', 'No items in this section')}
          </div>
        ) : (
          activeSection.items.map(item => {
            const active = loc.pathname === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                style={{
                  width: '100%',
                  textAlign: isRTL ? 'right' : 'left',
                  padding: `${space.sm}px ${space.md}px`,
                  borderRadius: radius.md,
                  border: 'none',
                  background: active ? (isDark ? 'rgba(31,111,235,0.18)' : palette.primary50) : 'transparent',
                  color: active ? BRAND : (isDark ? '#e5e7eb' : INK),
                  cursor: 'pointer',
                  marginBottom: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 500 }}>{item.label}</span>
                {item.description && (
                  <span style={{ fontSize: 11, color: INK_MUTED, lineHeight: 1.3 }}>{item.description}</span>
                )}
              </button>
            );
          })
        )}
      </div>
      {/* Resize handle */}
      <div
        onMouseDown={() => {
          draggingRef.current = true;
          document.body.style.userSelect = 'none';
        }}
        style={{
          position: 'absolute',
          top: 0,
          insetInlineEnd: -3,
          width: 6,
          height: '100%',
          cursor: 'ew-resize',
          zIndex: 5,
        }}
        title={t('split_master.resize', 'Drag to resize')}
      />
    </aside>
  );
};
