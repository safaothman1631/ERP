import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Input, Layout, Tag, Tooltip } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  DownOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import { radius, space, motion as motionTk } from '../theme/tokens';
import { buildNavSections, buildNavZones, flattenRoutes, type FlattenedNavLeaf, type NavSection, type NavZone } from './navigation';
import { getModuleKeyForPath } from './moduleMap';
import { getModuleMaturity, getMaturityBadge } from '../onboarding/moduleMaturity';
import { isModuleEnabled, useOnboardingStore } from '../onboarding/store';
import { useNavStore, type NavItem } from '../stores/navStore';
import { useUiStore } from '../stores/uiStore';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useRoleUx } from '../hooks/useRoleUx';
import { applyNavProfile, getNavProfileConfig } from '../personas/navProfiles';

const { Sider } = Layout;

/** Breakpoint below which the sidebar renders as a Drawer overlay (Requirement 4.4) */
const MOBILE_BREAKPOINT = 768;

const pathMatchesRoute = (pathname: string, route: FlattenedNavLeaf) =>
  pathname === route.key || (route.key !== '/' && pathname.startsWith(`${route.key}/`));
const findMatchingRoute = (pathname: string, routes: FlattenedNavLeaf[]) =>
  [...routes].sort((a, b) => b.key.length - a.key.length).find((r) => pathMatchesRoute(pathname, r));
const routeMatchesQuery = (route: FlattenedNavLeaf, section: NavSection, zone: NavZone, q: string) => {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return [route.label, route.description || '', route.key, ...(route.keywords || []),
    section.label, zone.label].join(' ').toLowerCase().includes(n);
};

interface SideNavProps {
  collapsed: boolean;
  width: number;
  collapsedWidth: number;
  isRTL: boolean;
  isDark: boolean;
  density?: 'comfortable' | 'compact';
  onDensityChange?: (density: 'comfortable' | 'compact') => void;
  onOpenPalette?: () => void;
  onOpenSectionDocs?: (sectionKey: string) => void;
}

/**
 * SideNav — collapsible sectioned navigation.
 *
 * Features:
 * - 240px expanded / 64px collapsed on desktop (Requirements 4.2, 4.3)
 * - Drawer overlay on screens < 768px (Requirement 4.4)
 * - Favorites section (top) + Recents section from navStore (Requirements 4.7, 4.8, 5.7)
 * - Inline search with debounced filtering ≤ 200ms (Requirement 5.2, 5.3)
 * - Hover-intent section opening at 700ms (Requirement 5.5)
 * - Flyout panel for collapsed mode (Requirement 5.6)
 * - Active item highlight with primary color + accent rail (Requirement 5.4)
 * - Module visibility from onboarding (Requirement 5.9)
 * - LanguageSwitcher in footer (Requirement 5.8)
 * - Collapsed state persisted to uiStore (Requirement 4.10)
 */
export const SideNav: React.FC<SideNavProps> = ({
  collapsed, width, collapsedWidth, isRTL, isDark,
  density = 'comfortable', onOpenPalette, onOpenSectionDocs,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  void onOpenSectionDocs; // not surfaced in v3 (kept for API compat)

  // ── Responsive: detect mobile viewport ────────────────────────
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── Nav data ───────────────────────────────────────────────────
  const sections = useMemo<NavSection[]>(() => buildNavSections(t), [t]);
  const zones = useMemo<NavZone[]>(() => buildNavZones(t), [t]);

  const enabledModules = useOnboardingStore((s) => s.enabledModules);
  const { theme } = useRoleUx();
  const navProfile = getNavProfileConfig(theme.navProfile);

  const filteredSections = useMemo<NavSection[]>(() => {
    let base = sections;
    if (enabledModules) {
      base = sections
        .map((sec) => ({
          ...sec,
          items: sec.items.filter((it) => isModuleEnabled(getModuleKeyForPath(it.key) ?? undefined, enabledModules)),
        }))
        .filter((sec) => sec.items.length > 0);
    }
    return applyNavProfile(base, theme.navProfile);
  }, [sections, enabledModules, theme.navProfile]);

  useEffect(() => {
    if (!navProfile.defaultCollapsed) return;
    setSidebarCollapsed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply POS minimal collapse once per profile
  }, [theme.navProfile]);

  const flattenedRoutes = useMemo(() => flattenRoutes(filteredSections, zones), [filteredSections, zones]);

  // ── navStore: favorites + recents (Requirements 4.7, 4.8, 5.7, 5.10) ──
  const navFavorites = useNavStore((s) => s.favorites);
  const navRecents = useNavStore((s) => s.recents);
  const navPin = useNavStore((s) => s.pin);
  const navUnpin = useNavStore((s) => s.unpin);
  const navAddRecent = useNavStore((s) => s.addRecent);

  // ── Search ─────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [flyout, setFlyout] = useState<{ sectionKey: string; top: number } | null>(null);

  const delayedQuery = useDeferredValue(query);
  const activeLeaf = useMemo(() => findMatchingRoute(location.pathname, flattenedRoutes),
    [location.pathname, flattenedRoutes]);
  const activeSectionKey = activeLeaf?.sectionKey;

  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const defaults = filteredSections.filter((s) => s.defaultOpen).map((s) => s.key);
    return activeSectionKey ? [...new Set([...defaults, activeSectionKey])] : defaults;
  });

  const routeByKey = useMemo(() => new Map(flattenedRoutes.map((r) => [r.key, r])), [flattenedRoutes]);
  const zoneByKey = useMemo(() => new Map(zones.map((z) => [z.key, z])), [zones]);

  const visibleSections = useMemo(() => {
    const n = delayedQuery.trim().toLowerCase();
    if (!n) return filteredSections;
    return filteredSections.reduce<NavSection[]>((acc, section) => {
      const zone = zoneByKey.get(section.zone);
      if (!zone) return acc;
      const sectionMatches = [section.label, zone.label].join(' ').toLowerCase().includes(n);
      const visibleItems = flattenedRoutes
        .filter((r) => r.sectionKey === section.key)
        .filter((r) => (sectionMatches ? true : routeMatchesQuery(r, section, zone, n)));
      if (visibleItems.length === 0) return acc;
      acc.push({ ...section, items: visibleItems.map((r) => ({
        key: r.key, label: r.label, description: r.description,
        keywords: r.keywords, favoriteEligible: r.favoriteEligible,
      })) });
      return acc;
    }, []);
  }, [delayedQuery, flattenedRoutes, filteredSections, zoneByKey]);

  const visibleZones = useMemo(
    () => zones.map((z) => ({ ...z, sections: visibleSections.filter((s) => s.zone === z.key) }))
              .filter((z) => z.sections.length > 0),
    [visibleSections, zones]
  );

  // Resolve navStore recents to FlattenedNavLeaf for rendering
  const recentRoutes = useMemo(
    () => navRecents.map((r) => routeByKey.get(r.key)).filter((r): r is FlattenedNavLeaf => Boolean(r)),
    [navRecents, routeByKey]
  );

  // Resolve navStore favorites to FlattenedNavLeaf for rendering
  const favoriteRoutes = useMemo(
    () => navFavorites.map((r) => routeByKey.get(r.key)).filter((r): r is FlattenedNavLeaf => Boolean(r)),
    [navFavorites, routeByKey]
  );

  const isSearching = delayedQuery.trim().length > 0;
  const animSec = prefersReducedMotion ? 0 : motionTk.durBase / 1000;
  const isCompact = density === 'compact';
  const itemPadY = isMobile ? 1 : (isCompact ? 5 : 6);
  const itemFont = isMobile ? 12.5 : (isCompact ? 13 : 13.5);
  const _itemGap = isMobile ? 7 : 8;
  const _itemBorderRadius = isMobile ? 5 : (radius.md as number | string);

  // Auto-expand active section
  useEffect(() => {
    if (activeSectionKey && !openKeys.includes(activeSectionKey)) {
      setOpenKeys((prev) => [...prev, activeSectionKey]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionKey]);

  // Track page visits → navStore.addRecent (Requirement 4.8, 5.7)
  useEffect(() => {
    if (!activeLeaf) return;
    const item: NavItem = {
      key: activeLeaf.key,
      label: activeLeaf.label,
      icon: undefined,
      section: activeLeaf.sectionKey,
    };
    navAddRecent(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeaf?.key]);

  useEffect(() => { if (!collapsed) setFlyout(null); }, [collapsed]);
  useEffect(() => { setFlyout(null); }, [location.pathname]);
  useEffect(() => {
    if (!flyout) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.closest('[data-nav-flyout="true"]') || el.closest('[data-nav-section-button="true"]')) return;
      setFlyout(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [flyout]);

  // Cleanup any pending hover-open timers on unmount
  useEffect(() => () => {
    Object.values(hoverTimers.current).forEach((tid) => clearTimeout(tid));
    hoverTimers.current = {};
  }, []);

  // ── Theme tokens — Vertex kit (shell.jsx SideNav): surface aside, hairline
  //    border, slate ink ramp. Section label = ink-700, muted icon = ink-500,
  //    zone label / meta = ink-300/400, active tint = accent-soft. ──
  const sidebarBg  = 'var(--surface)';
  const borderCol  = 'var(--border)';
  const ink        = 'var(--ink-900)';
  const inkSection = 'var(--ink-700)';
  const inkMuted   = 'var(--ink-500)';
  const inkDim     = 'var(--ink-300)';
  const activeBg   = 'var(--accent-soft)';
  void isDark; // theme handled entirely via CSS-var tokens (auto-flip)

  const toggleSection = (key: string) => {
    if (isSearching) return;
    setOpenKeys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
    hoverOpened.current.delete(key);
  };
  const openSection = (key: string) => {
    if (isSearching) return;
    setOpenKeys((prev) => prev.includes(key) ? prev : [...prev, key]);
  };
  const closeSection = (key: string) => {
    setOpenKeys((prev) => prev.filter((k) => k !== key));
  };

  // Hover-intent: open after ~700ms; auto-close on leave (only if hover-opened).
  const HOVER_OPEN_MS = 700;
  const hoverTimers = useRef<Record<string, number>>({});
  const hoverOpened = useRef<Set<string>>(new Set());

  const handleSectionHoverEnter = (key: string) => {
    if (isSearching || collapsed) return;
    if (openKeys.includes(key)) return;
    if (hoverTimers.current[key]) return;
    hoverTimers.current[key] = window.setTimeout(() => {
      hoverOpened.current.add(key);
      openSection(key);
      delete hoverTimers.current[key];
    }, HOVER_OPEN_MS);
  };
  const handleSectionHoverLeave = (key: string) => {
    const tid = hoverTimers.current[key];
    if (tid) {
      clearTimeout(tid);
      delete hoverTimers.current[key];
    }
    if (hoverOpened.current.has(key) && key !== activeSectionKey) {
      hoverOpened.current.delete(key);
      closeSection(key);
    }
  };

  // Toggle favorite via navStore (Requirement 5.10)
  const toggleFavorite = (route: FlattenedNavLeaf) => {
    const isFav = navFavorites.some((f) => f.key === route.key);
    if (isFav) {
      navUnpin(route.key);
    } else {
      navPin({ key: route.key, label: route.label, section: route.sectionKey });
    }
  };

  const handleSectionFlyout = (key: string, target: HTMLElement) => {
    const b = target.getBoundingClientRect();
    const top = Math.max(76, Math.min(b.top - 10, window.innerHeight - 340));
    setFlyout((prev) => prev?.sectionKey === key ? null : { sectionKey: key, top });
  };

  // ── Leaf renderer ──────────────────────────────────────────────
  //    Kit sub-link (shell.jsx): a `.vx-nav` button — 32px tall, 13px, accent-soft
  //    tint + accent text + 3px leading accent bar (.vx-nav.on::before) when active.
  const renderLeaf = (route: FlattenedNavLeaf) => {
    const isActive = activeLeaf?.key === route.key;
    const isFav = navFavorites.some((f) => f.key === route.key);
    const modKey = getModuleKeyForPath(route.key);
    const maturityBadge = modKey ? getMaturityBadge(getModuleMaturity(modKey)) : null;
    return (
      <button
        key={route.key}
        type="button"
        onClick={() => navigate(route.key)}
        className={`vx-nav sn3-leaf${isActive ? ' on' : ''}`}
        aria-label={route.label}
        aria-current={isActive ? 'page' : undefined}
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          border: 'none',
          cursor: 'pointer',
          background: isActive ? activeBg : 'transparent',
          borderRadius: 'var(--radius-md)',
          height: 'auto',
          minHeight: isMobile ? 0 : undefined,
          padding: isMobile ? '6px 10px' : `${itemPadY}px ${space.md}px`,
          gap: 6,
          fontSize: itemFont,
          fontWeight: isActive ? 600 : 500,
          color: isActive ? 'var(--accent-500)' : inkSection,
          lineHeight: isMobile ? 1.3 : 1.35,
          transition: 'background 0.12s, color 0.12s',
        }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {route.label}
          </span>
          {maturityBadge && (
            <Tag
              bordered={false}
              className="sn3-badge"
              style={{
                margin: 0,
                flexShrink: 0,
                fontSize: 9,
                lineHeight: '14px',
                padding: '0 4px',
                fontWeight: 600,
              }}
            >
              {maturityBadge}
            </Tag>
          )}
        </span>
        {route.favoriteEligible && !isMobile && (
          <span
            role="button"
            tabIndex={-1}
            aria-label={isFav ? t('remove_favorite', 'Remove favorite') : t('add_favorite', 'Add favorite')}
            onClick={(e) => { e.stopPropagation(); toggleFavorite(route); }}
            className="sn3-fav"
            data-active={isFav ? 'true' : 'false'}
            style={{
              color: isFav ? 'var(--warning-500)' : inkDim,
              padding: 2, lineHeight: 1, fontSize: 11,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              opacity: isFav ? 1 : 0,
              transition: 'opacity 0.12s, color 0.12s',
            }}
          >
            {isFav ? <StarFilled /> : <StarOutlined />}
          </span>
        )}
      </button>
    );
  };

  const flyoutSection = flyout ? filteredSections.find((s) => s.key === flyout.sectionKey) : null;

  // ── Sidebar body content (shared between Sider and Drawer) ─────
  const sidebarContent = (
    <>
      {/* ── Logo row (kit shell.jsx) — flat surface, sticky, topbar-height ─
          Hidden on mobile (TopBar already shows brand in the drawer header). */}
      {!isMobile && (
      <div className="sn3-logo" style={{
        height: 'var(--topbar-h, 56px)',
        padding: collapsed ? '0' : '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10,
        flexShrink: 0,
        background: sidebarBg,
      }}>
        <div className="sn3-logo-mark" style={{
          width: 26, height: 26,
          borderRadius: 7,
          background: 'var(--accent-500)',
          display: 'grid', placeItems: 'center', color: 'var(--on-accent)',
          fontFamily: 'var(--font-display)',
          fontWeight: 800, fontSize: 13,
          boxShadow: 'var(--accent-glow)',
          flexShrink: 0,
          letterSpacing: '-0.5px',
        }}>Z</div>
        {!collapsed && (
          <div style={{
            minWidth: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 700,
            color: ink,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            letterSpacing: '-0.2px',
          }}>
            {t('app_name')}
          </div>
        )}
      </div>
      )}

      {/* ── Search — kit shell.jsx search button styling (surface-2 + hairline,
          36px, radius-md, search icon + ⌘K hint). Kept as a live filter input
          (drives visibleZones); ⌘K opens the command palette. ─ */}
      {(!collapsed || isMobile) && (
        <div style={{ padding: isMobile ? '0 12px 8px' : '0 12px 10px', flexShrink: 0 }}>
          <Input
            allowClear
            size="middle"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onPressEnter={() => { if (!query.trim()) onOpenPalette?.(); }}
            prefix={<SearchOutlined style={{ color: inkDim, fontSize: 15 }} />}
            suffix={!query && !isMobile ? (
              <kbd className="sn3-kbd" aria-hidden>⌘K</kbd>
            ) : undefined}
            placeholder={t('search_or_jump', 'Search or jump to…')}
            aria-label={t('nav.search_label', 'Search navigation')}
            aria-controls="sn3-results"
            aria-expanded={isSearching}
            className="sn3-search"
            style={{
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              height: 36,
            }}
          />
        </div>
      )}

      {/* ── Body (scrollable nav) — kit padding 0 10px 14px ─── */}
      <nav id="sn3-results" className="sn3-scroll vx-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: (collapsed && !isMobile) ? '0 6px 14px' : (isMobile ? '0 10px 12px' : '0 10px 14px') }}>

        {/* aria-live region for search result count — Requirement 17.1 */}
        {(!collapsed || isMobile) && (
          <div
            aria-live="polite"
            aria-atomic="true"
            style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
          >
            {isSearching
              ? t('nav.search_results_count', '{{n}} results found', { n: visibleZones.reduce((acc, z) => acc + z.sections.reduce((a, s) => a + s.items.length, 0), 0) })
              : ''}
          </div>
        )}

        {/* ── Favorites zone (top) — from navStore (Requirement 5.7) ── */}
        {(!collapsed || isMobile) && !isSearching && favoriteRoutes.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div className="sn3-zone">{t('favorites', 'Favorites')}</div>
            <div style={{ display: 'grid', gap: 1 }}>
              {favoriteRoutes.map((r) => renderLeaf(r))}
            </div>
          </div>
        )}

        {/* ── Recents zone — from navStore (Requirement 5.7) ── */}
        {(!collapsed || isMobile) && !isSearching && recentRoutes.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div className="sn3-zone">{t('recent', 'Recent')}</div>
            <div style={{ display: 'grid', gap: 1 }}>
              {recentRoutes.slice(0, 3).map((r) => renderLeaf(r))}
            </div>
          </div>
        )}

        {/* Expanded view: ZONE label → SECTION toggle (.vx-nav) → SUB-LINKS (.vx-subnav) */}
        {(!collapsed || isMobile) && visibleZones.map((zone) => (
          <div key={zone.key} style={{ marginBottom: 10 }}>
            <div className="sn3-zone">{zone.label}</div>
            <div>
              {zone.sections.map((section) => {
                const isOpen = isSearching || openKeys.includes(section.key) || section.key === activeSectionKey;
                const hasActive = section.key === activeSectionKey;
                return (
                  <div
                    key={section.key}
                    onMouseEnter={() => handleSectionHoverEnter(section.key)}
                    onMouseLeave={() => handleSectionHoverLeave(section.key)}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(section.key)}
                      className="vx-nav sn3-section-toggle"
                      aria-expanded={isOpen}
                      aria-controls={`sn3-section-${section.key}`}
                      aria-label={section.label}
                      style={{
                        position: 'relative',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        border: 'none',
                        cursor: 'pointer',
                        background: 'transparent',
                        borderRadius: 'var(--radius-md)',
                        height: 'auto',
                        minHeight: isMobile ? 0 : undefined,
                        padding: isMobile ? '6px 8px' : `${itemPadY}px 11px`,
                        gap: 11,
                        fontSize: itemFont,
                        fontWeight: 600,
                        color: hasActive ? ink : inkSection,
                        lineHeight: isMobile ? 1.3 : 1.35,
                        transition: 'background 0.12s, color 0.12s',
                      }}
                    >
                      <span className="sn3-section-icon" style={{
                        color: hasActive ? 'var(--accent-500)' : inkMuted,
                        fontSize: isMobile ? 15 : 17,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'color 0.15s',
                      }}>
                        {section.icon}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {section.label}
                      </span>
                      <motion.span
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: animSec }}
                        style={{
                          color: inkDim,
                          fontSize: isMobile ? 12 : 14,
                          lineHeight: 1, flexShrink: 0,
                          display: 'inline-flex',
                        }}
                      >
                        <DownOutlined />
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: animSec, ease: [0.2, 0, 0, 1] }}
                          id={`sn3-section-${section.key}`}
                          className="sn3-subnav"
                          style={{
                            overflow: 'hidden',
                            marginInlineStart: isMobile ? 12 : 14,
                            paddingInlineStart: 12,
                            borderInlineStart: `1px solid ${borderCol}`,
                          }}
                        >
                          <div style={{ display: 'grid', gap: isMobile ? 0 : 1, paddingBottom: 4 }}>
                            {section.items.map((item) => renderLeaf(routeByKey.get(item.key) || {
                              key: item.key, label: item.label,
                              description: item.description, keywords: item.keywords,
                              favoriteEligible: item.favoriteEligible ?? true,
                              icon: section.icon, sectionKey: section.key,
                              sectionLabel: section.label, zone: section.zone,
                              zoneLabel: zone.label,
                            }))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Collapsed view: just icons */}
        {collapsed && !isMobile && (
          <div style={{ display: 'grid', gap: 4 }}>
            {zones.map((zone, zi) => {
              const zoneSections = filteredSections.filter((s) => s.zone === zone.key);
              return (
                <React.Fragment key={zone.key}>
                  {zi > 0 && <div style={{ height: 1, margin: '6px 8px', background: borderCol }} />}
                  {zoneSections.map((section) => {
                    const isActiveSec = section.key === activeSectionKey;
                    return (
                      <Tooltip key={section.key} placement={isRTL ? 'left' : 'right'} title={section.label}>
                        <button
                          type="button"
                          data-nav-section-button="true"
                          onClick={(e) => handleSectionFlyout(section.key, e.currentTarget)}
                          className="sn3-collapsed-btn"
                          style={{
                            width: 38, height: 38, marginInline: 'auto',
                            borderRadius: 'var(--radius-md)', border: 'none',
                            background: isActiveSec ? activeBg : 'transparent',
                            color: isActiveSec ? 'var(--accent-500)' : inkMuted,
                            display: 'grid', placeItems: 'center',
                            cursor: 'pointer', fontSize: 17,
                            transition: 'background 0.12s, color 0.12s',
                          }}
                        >
                          {section.icon}
                        </button>
                      </Tooltip>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {(!collapsed || isMobile) && visibleZones.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: inkMuted }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{t('no_results', 'No results')}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: inkDim }}>
              {t('nav_search_no_results', 'Try another keyword or open the command palette')}
            </div>
          </div>
        )}
      </nav>

      {/* ── Footer — LanguageSwitcher + version (Requirement 5.8) ── */}
      <div style={{
        flexShrink: 0,
        padding: (collapsed && !isMobile) ? '8px 0' : '8px 12px',
        display: 'flex', alignItems: 'center',
        justifyContent: (collapsed && !isMobile) ? 'center' : 'space-between',
        borderTop: `1px solid ${borderCol}`,
        gap: 8,
      }}>
        {(collapsed && !isMobile) ? (
          <Tooltip placement={isRTL ? 'left' : 'right'} title={t('language', 'Language')}>
            <LanguageSwitcher showLabel={false} size="small" type="text" />
          </Tooltip>
        ) : (
          <>
            <LanguageSwitcher showLabel size="small" type="text" />
            <span style={{ fontSize: 10.5, color: inkDim, opacity: 0.7, whiteSpace: 'nowrap' }}>
              {t('app_subtitle')}
            </span>
          </>
        )}
      </div>
    </>
  );

  // ── Mobile: render content directly (AppShell wraps in Drawer) ──
  if (isMobile) {
    return (
      <>
        <style>{sn3Css}</style>
        {sidebarContent}
      </>
    );
  }

  // ── Desktop: render as fixed Sider ────────────────────────────
  return (
    <>
      <style>{sn3Css}</style>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={width}
        collapsedWidth={collapsedWidth}
        className="sn3-sider"
        role="navigation"
        aria-label={t('nav.sidebar', 'Navigation')}
        style={{
          background: sidebarBg,
          borderInlineEnd: `1px solid ${borderCol}`,
          position: 'fixed',
          top: 0, bottom: 0,
          [isRTL ? 'right' : 'left']: 0,
          zIndex: 100,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {sidebarContent}
      </Sider>

      {/* ── Flyout (collapsed mode) ─────────────────────────── */}
      <AnimatePresence>
        {collapsed && flyoutSection && (
          <motion.aside
            key={flyoutSection.key}
            data-nav-flyout="true"
            className="vx-scroll"
            initial={{ opacity: 0, x: isRTL ? 10 : -10, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: isRTL ? 10 : -10, scale: 0.98 }}
            transition={{ duration: animSec }}
            style={{
              position: 'fixed',
              top: flyout?.top ?? 76,
              [isRTL ? 'right' : 'left']: collapsedWidth + 8,
              width: 248,
              maxHeight: 'calc(100vh - 88px)',
              overflowY: 'auto',
              background: 'var(--surface)',
              border: `1px solid ${borderCol}`,
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 140,
              padding: '8px 6px',
            }}
          >
            <div className="sn3-zone" style={{ paddingBlockStart: 6 }}>
              {flyoutSection.label}
            </div>
            <div style={{ display: 'grid', gap: 1 }}>
              {flyoutSection.items.map((item) => renderLeaf(routeByKey.get(item.key) || {
                key: item.key, label: item.label,
                description: item.description, keywords: item.keywords,
                favoriteEligible: item.favoriteEligible ?? true,
                icon: flyoutSection.icon, sectionKey: flyoutSection.key,
                sectionLabel: flyoutSection.label, zone: flyoutSection.zone,
                zoneLabel: zoneByKey.get(flyoutSection.zone)?.label || '',
              }))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   SideNav styles — Vertex kit (shell.jsx SideNav + kit.css .vx-nav idiom).
   Token-only + theme-aware: every colour is a CSS var that auto-flips for dark
   via html[data-theme="dark"]. Direction is logical (inset-inline-*, never L/R).
   Structural box (flex/size/radius) is set inline on each button; these rules
   add the kit hover/active tint, the 3px leading accent bar, zone label, search
   chrome, and scrollbar — all scoped to the SideNav's own .sn3-* classes so they
   never leak onto the /vertex proof (which ships its own .vx-nav via vx-kit.css).
   ────────────────────────────────────────────────────────────────────────── */
const sn3Css = `
  .sn3-sider > .ant-layout-sider-children {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .sn3-sider { font-family: inherit; }

  /* ── ZONE label (kit shell.jsx: 10.5px / 700 / .12em uppercase / ink-300) ── */
  .sn3-zone {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-300);
    padding: 10px 8px 6px;
    line-height: 1;
  }

  /* ── Logo row hairline (kit: flat surface, sits over scroll) ── */
  .sn3-logo { border-bottom: 1px solid var(--border); }

  /* ── SECTION toggle (kit .vx-nav, fontWeight 600) — text-align follows dir ── */
  .sn3-section-toggle { text-align: start; }
  .sn3-section-toggle:hover { background: var(--surface-2); color: var(--ink-900); }
  [data-theme='dark'] .sn3-section-toggle:hover { background: rgba(255,255,255,0.04); }
  .sn3-section-toggle:hover .sn3-section-icon { color: var(--accent-400); }

  /* ── SUB-LINK (kit .vx-nav / .vx-nav.on) ─────────────────────────────────── */
  .sn3-leaf { text-align: start; }
  .sn3-leaf:hover:not(.on) { background: var(--surface-2); color: var(--ink-900); }
  [data-theme='dark'] .sn3-leaf:hover:not(.on) { background: rgba(255,255,255,0.04); }
  .sn3-leaf.on {
    color: var(--accent-500);
    background: var(--accent-soft);
    font-weight: 600;
  }
  /* Signature Vertex detail: 3px leading accent bar on the active sub-link
     (kit .vx-nav.on::before). Default sits on the leaf's own leading edge
     (favorites/recents); inside a bordered subnav it shifts to -12px so it
     overlaps the subnav guide line. Logical insets mirror correctly in RTL. */
  .sn3-leaf.on::before {
    content: '';
    position: absolute;
    inset-inline-start: 0;
    inset-block: 8px;
    width: 3px;
    border-radius: 3px;
    background: var(--accent-500);
  }
  .sn3-subnav .sn3-leaf.on::before { inset-inline-start: -12px; }

  /* Maturity badge — neutral surface chip, theme-aware */
  .sn3-badge.ant-tag {
    background: var(--surface-2);
    color: var(--ink-500);
    border-radius: var(--radius-xs);
  }

  /* ── Favorite star ───────────────────────────────────────────── */
  .sn3-leaf:hover .sn3-fav { opacity: 0.55 !important; }
  .sn3-leaf .sn3-fav[data-active='true'] { opacity: 1 !important; }
  .sn3-leaf .sn3-fav:hover { opacity: 1 !important; color: var(--warning-500) !important; }

  /* ── Collapsed icon button ───────────────────────────────────── */
  .sn3-collapsed-btn {
    transition: background 0.15s, color 0.15s, transform 0.12s !important;
  }
  .sn3-collapsed-btn:hover {
    background: var(--accent-soft) !important;
    color: var(--accent-400) !important;
    transform: scale(1.05);
  }

  /* ── Search — kit search button look (surface-2 + hairline, radius-md) ── */
  .sn3-search.ant-input-affix-wrapper {
    transition: border-color 0.18s, box-shadow 0.18s, background 0.18s !important;
    border-radius: var(--radius-md) !important;
    border: 1px solid var(--border) !important;
    background: var(--surface-2) !important;
    box-shadow: none !important;
    outline: none !important;
  }
  .sn3-search.ant-input-affix-wrapper .ant-input {
    background: transparent !important;
    color: var(--ink-900) !important;
  }
  .sn3-search.ant-input-affix-wrapper:hover {
    border-color: var(--border-strong) !important;
    box-shadow: none !important;
  }
  .sn3-search.ant-input-affix-wrapper-focused,
  .sn3-search.ant-input-affix-wrapper:focus-within {
    border-color: var(--accent-500) !important;
    box-shadow: 0 0 0 3px var(--accent-soft) !important;
    background: var(--surface) !important;
    outline: none !important;
  }
  .sn3-search input::placeholder { color: var(--ink-300) !important; }
  .sn3-search.ant-input-affix-wrapper input:focus {
    outline: none !important;
    box-shadow: none !important;
  }
  /* ⌘K hint (kit kbd: mono, hairline chip on surface) */
  .sn3-kbd {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-400);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 1px 5px;
    line-height: 1.4;
  }

  /* ── Scrollbar — kit .vx-scroll (slate thumb, theme-aware) ── */
  .sn3-scroll::-webkit-scrollbar { width: 9px; }
  .sn3-scroll::-webkit-scrollbar-track { background: transparent; }
  .sn3-scroll::-webkit-scrollbar-thumb {
    background: var(--slate-300);
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
  [data-theme='dark'] .sn3-scroll::-webkit-scrollbar-thumb {
    background: var(--slate-700);
    background-clip: padding-box;
  }

  /* ── Mobile — tighter rows, same kit idiom ────────────────────── */
  @media (max-width: 768px) {
    .sn3-zone { padding: 8px 8px 2px; font-size: 10px; }

    .sn3-section-toggle,
    button.sn3-section-toggle {
      font-size: 13px !important;
      padding: 6px 8px !important;
      gap: 9px !important;
      min-height: 0 !important;
      min-width: 0 !important;
      height: auto !important;
    }

    .sn3-leaf,
    button.sn3-leaf {
      font-size: 13px !important;
      padding: 6px 10px !important;
      gap: 6px !important;
      line-height: 1.3 !important;
      min-height: 0 !important;
      min-width: 0 !important;
      height: auto !important;
      max-height: 36px !important;
    }

    .sn3-search.ant-input-affix-wrapper {
      height: 34px !important;
      font-size: 12.5px !important;
    }

    .sn3-scroll { padding: 2px 10px 16px !important; }
  }
`;

export default SideNav;
