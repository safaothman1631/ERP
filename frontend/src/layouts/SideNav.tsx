import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer, Input, Layout, Tooltip } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  CaretRightOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import { palette, radius, space, motion as motionTk } from '../theme/tokens';
import { buildNavSections, buildNavZones, flattenRoutes, type FlattenedNavLeaf, type NavSection, type NavZone } from './navigation';
import { getModuleKeyForPath } from './moduleMap';
import { isModuleEnabled, useOnboardingStore } from '../onboarding/store';
import { useNavStore, type NavItem } from '../stores/navStore';
import { useUiStore } from '../stores/uiStore';
import LanguageSwitcher from '../components/LanguageSwitcher';

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
  density = 'comfortable', onOpenSectionDocs,
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
  const filteredSections = useMemo<NavSection[]>(() => {
    if (!enabledModules) return sections;
    return sections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((it) => isModuleEnabled(getModuleKeyForPath(it.key) ?? undefined, enabledModules)),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [sections, enabledModules]);

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
  const itemGap = isMobile ? 7 : 8;
  const itemBorderRadius = isMobile ? 5 : (radius.md as number | string);

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

  // ── Theme tokens ───────────────────────────────────────────────
  const sidebarBg  = isDark ? '#0B1220' : '#FAFBFC';
  const borderCol  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
  const ink        = isDark ? '#E5E9F2' : '#0F172A';
  const inkMuted   = isDark ? '#7B8497' : '#64748B';
  const inkDim     = isDark ? '#5A6275' : '#94A3B8';
  const hoverBg    = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
  const activeBg   = isDark ? 'rgba(31,111,235,0.16)' : 'rgba(31,111,235,0.08)';

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
  const renderLeaf = (route: FlattenedNavLeaf) => {
    const isActive = activeLeaf?.key === route.key;
    const isFav = navFavorites.some((f) => f.key === route.key);
    return (
      <button
        key={route.key}
        type="button"
        onClick={() => navigate(route.key)}
        className={`sn3-leaf${isActive ? ' is-active' : ''}`}
        aria-label={route.label}
        aria-current={isActive ? 'page' : undefined}
        style={{
          position: 'relative',
          width: '100%',
          background: isActive ? activeBg : 'transparent',
          color: isActive ? palette.primary600 : ink,
          border: 'none',
          borderRadius: isMobile ? 6 : radius.md,
          padding: isMobile
            ? `6px 10px 6px ${isActive ? 14 : 10}px`
            : `${itemPadY}px 10px ${itemPadY}px ${isActive ? 18 : 12}px`,
          display: 'flex',
          alignItems: 'center',
          gap: itemGap,
          cursor: 'pointer',
          textAlign: 'start',
          fontSize: itemFont,
          fontWeight: isActive ? 600 : 450,
          lineHeight: isMobile ? 1.3 : 1.35,
          transition: 'background 0.12s, color 0.12s',
          ...(isMobile ? { minHeight: 0, height: 'auto', minWidth: 0 } : {}),
        }}>
        {isActive && (
          <motion.span
            layoutId="sn3-active-rail"
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            style={{
              position: 'absolute', top: 6, bottom: 6,
              [isRTL ? 'insetInlineEnd' : 'insetInlineStart']: 4,
              width: 3, borderRadius: 3,
              background: 'linear-gradient(180deg, #6366F1 0%, #4F46E5 100%)',
              boxShadow: '0 0 8px rgba(99,102,241,0.5)',
            }}
          />
        )}
        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {route.label}
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
              color: isFav ? palette.warning : inkDim,
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
      {/* ── Brand row (hidden on mobile — TopBar already shows brand) ─ */}
      {!isMobile && (
      <div style={{
        height: 56,
        padding: collapsed ? '0' : '0 14px',
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10, borderBottom: `1px solid ${borderCol}`,
        flexShrink: 0,
        background: isDark
          ? 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, transparent 60%)'
          : 'linear-gradient(135deg, rgba(99,102,241,0.04) 0%, transparent 60%)',
      }}>
        <div style={{
          width: 28, height: 28,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 50%, #1F6FEB 100%)',
          display: 'grid', placeItems: 'center', color: '#fff',
          fontWeight: 800, fontSize: 13,
          boxShadow: '0 2px 8px rgba(99,102,241,0.40)',
          flexShrink: 0,
          letterSpacing: '-0.5px',
        }}>Z</div>
        {!collapsed && (
          <div style={{
            minWidth: 0,
            fontSize: 13.5,
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

      {/* ── Search (slim) ───────────────────────────────────── */}
      {(!collapsed || isMobile) && (
        <div style={{ padding: isMobile ? '6px 8px 4px' : '12px 12px 8px', flexShrink: 0 }}>
          <Input
            allowClear
            size="middle"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            prefix={<SearchOutlined style={{ color: inkDim, fontSize: isMobile ? 11 : 12, opacity: 0.55 }} />}
            placeholder={t('search_or_jump', 'Search or jump to…')}
            aria-label={t('nav.search_label', 'Search navigation')}
            aria-controls="sn3-results"
            aria-expanded={isSearching}
            className="sn3-search"
            style={{
              borderRadius: 10,
              fontSize: isMobile ? 12 : 12.5,
              height: isMobile ? 30 : 34,
            }}
          />
        </div>
      )}

      {/* ── Body (scrollable) ───────────────────────────────── */}
      <div id="sn3-results" className="sn3-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: (collapsed && !isMobile) ? '8px 6px 16px' : (isMobile ? '0px 6px 12px' : '4px 8px 16px') }}>

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

        {/* ── Favorites section (top) — from navStore (Requirement 5.7) ── */}
        {(!collapsed || isMobile) && !isSearching && favoriteRoutes.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="sn3-zone-label" style={{ color: inkDim }}>
              {t('favorites', 'Favorites')}
            </div>
            <div style={{ display: 'grid', gap: 1 }}>
              {favoriteRoutes.map((r) => renderLeaf(r))}
            </div>
          </div>
        )}

        {/* ── Recents section — from navStore (Requirement 5.7) ── */}
        {(!collapsed || isMobile) && !isSearching && recentRoutes.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="sn3-zone-label" style={{ color: inkDim }}>
              {t('recent', 'Recent')}
            </div>
            <div style={{ display: 'grid', gap: 1 }}>
              {recentRoutes.slice(0, 3).map((r) => renderLeaf(r))}
            </div>
          </div>
        )}

        {/* Expanded view: zones → sections → items */}
        {(!collapsed || isMobile) && visibleZones.map((zone) => (
          <div key={zone.key} style={{ marginBottom: isMobile ? 2 : 14 }}>
            <div className="sn3-zone-label" style={{ color: inkDim, paddingBlockStart: isMobile ? 4 : 14 }}>
              {zone.label}
            </div>
            <div>
              {zone.sections.map((section) => {
                const isOpen = isSearching || openKeys.includes(section.key) || section.key === activeSectionKey;
                return (
                  <div
                    key={section.key}
                    style={{ marginBottom: isMobile ? 0 : 2 }}
                    onMouseEnter={() => handleSectionHoverEnter(section.key)}
                    onMouseLeave={() => handleSectionHoverLeave(section.key)}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(section.key)}
                      className="sn3-section-toggle"
                      aria-expanded={isOpen}
                      aria-controls={`sn3-section-${section.key}`}
                      aria-label={section.label}
                      style={{
                        width: '100%', border: 'none', background: 'transparent',
                        color: ink,
                        padding: isMobile
                          ? '6px 8px'
                          : `${itemPadY}px 10px ${itemPadY}px 12px`,
                        display: 'flex', alignItems: 'center', gap: itemGap,
                        cursor: 'pointer', textAlign: 'start',
                        borderRadius: isMobile ? 5 : radius.md,
                        fontSize: itemFont,
                        fontWeight: 500,
                        lineHeight: isMobile ? 1.3 : 1.35,
                        transition: 'background 0.12s',
                        ...(isMobile ? { minHeight: 0, height: 'auto', minWidth: 0 } : {}),
                      }}
                    >
                      <span style={{
                        color: isOpen ? palette.primary500 : palette.primary500,
                        fontSize: isMobile ? 11 : 13,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: isMobile ? 18 : 22, height: isMobile ? 18 : 22,
                        borderRadius: isMobile ? 4 : 6,
                        background: isOpen
                          ? (isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)')
                          : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'),
                        flexShrink: 0,
                        transition: 'background 0.15s, color 0.15s',
                      }}>
                        {section.icon}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {section.label}
                      </span>
                      <motion.span
                        animate={{ rotate: isOpen ? 90 : 0 }}
                        transition={{ duration: animSec }}
                        style={{
                          color: isOpen ? palette.primary500 : inkDim,
                          fontSize: isMobile ? 10 : 9,
                          lineHeight: 1, flexShrink: 0,
                          opacity: isOpen ? 1 : 0.5,
                        }}
                      >
                        <CaretRightOutlined />
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
                          style={{ overflow: 'hidden', paddingInlineStart: isMobile ? 12 : 22 }}
                        >
                          <div style={{ display: 'grid', gap: isMobile ? 0 : 1, paddingTop: isMobile ? 2 : 1, paddingBottom: isMobile ? 2 : 4 }}>
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
                            width: 36, height: 36, marginInline: 'auto',
                            borderRadius: 8, border: 'none',
                            background: isActiveSec ? activeBg : 'transparent',
                            color: isActiveSec ? palette.primary600 : inkMuted,
                            display: 'grid', placeItems: 'center',
                            cursor: 'pointer', fontSize: 14,
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
      </div>

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
            initial={{ opacity: 0, x: isRTL ? 10 : -10, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: isRTL ? 10 : -10, scale: 0.98 }}
            transition={{ duration: animSec }}
            style={{
              position: 'fixed',
              top: flyout?.top ?? 76,
              [isRTL ? 'right' : 'left']: collapsedWidth + 8,
              width: 240,
              maxHeight: 'calc(100vh - 88px)',
              overflowY: 'auto',
              background: isDark ? '#111A2E' : '#FFFFFF',
              border: `1px solid ${borderCol}`,
              borderRadius: 12,
              boxShadow: isDark
                ? '0 12px 32px rgba(0,0,0,0.45)'
                : '0 12px 32px rgba(15,23,42,0.16)',
              zIndex: 140,
              padding: '8px 6px',
            }}
          >
            <div style={{ padding: '6px 12px 8px', fontSize: 12, fontWeight: 600,
              color: inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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

const sn3Css = `
  .sn3-sider > .ant-layout-sider-children {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  /* ── Zone labels ─────────────────────────────────────────────── */
  .sn3-zone-label {
    padding: 14px 14px 5px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    line-height: 1;
    opacity: 0.45;
  }

  /* ── Section toggle ──────────────────────────────────────────── */
  .sn3-section-toggle {
    position: relative;
    overflow: hidden;
  }
  .sn3-section-toggle::before {
    content: '';
    position: absolute;
    inset: 0;
    background: transparent;
    border-radius: 8px;
    transition: background 0.15s;
  }
  @media (hover: hover) {
    .sn3-section-toggle:hover::before {
      background: rgba(99,102,241,0.06);
    }
    [data-theme='dark'] .sn3-section-toggle:hover::before {
      background: rgba(99,102,241,0.10);
    }
  }

  /* ── Nav leaf ────────────────────────────────────────────────── */
  .sn3-leaf {
    position: relative;
    overflow: hidden;
  }
  .sn3-leaf::before {
    content: '';
    position: absolute;
    inset: 0;
    background: transparent;
    border-radius: 8px;
    transition: background 0.15s;
  }
  @media (hover: hover) {
    .sn3-leaf:hover:not(.is-active)::before {
      background: rgba(15,23,42,0.04);
    }
    [data-theme='dark'] .sn3-leaf:hover:not(.is-active)::before {
      background: rgba(255,255,255,0.05);
    }
  }
  .sn3-leaf.is-active {
    background: linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(31,111,235,0.10) 100%) !important;
    color: #4F46E5 !important;
    font-weight: 600 !important;
  }
  [data-theme='dark'] .sn3-leaf.is-active {
    background: linear-gradient(135deg, rgba(99,102,241,0.20) 0%, rgba(31,111,235,0.16) 100%) !important;
    color: #818CF8 !important;
  }

  /* ── Favorite star ───────────────────────────────────────────── */
  .sn3-leaf:hover .sn3-fav { opacity: 0.5 !important; }
  .sn3-leaf .sn3-fav[data-active='true'] { opacity: 1 !important; }
  .sn3-leaf .sn3-fav:hover { opacity: 1 !important; color: #F59E0B !important; }

  /* ── Collapsed icon button ───────────────────────────────────── */
  .sn3-collapsed-btn {
    transition: background 0.15s, color 0.15s, transform 0.12s !important;
  }
  .sn3-collapsed-btn:hover {
    background: rgba(99,102,241,0.08) !important;
    transform: scale(1.05);
  }
  [data-theme='dark'] .sn3-collapsed-btn:hover {
    background: rgba(99,102,241,0.14) !important;
  }

  /* ── Search input ────────────────────────────────────────────── */
  .sn3-search.ant-input-affix-wrapper {
    transition: border-color 0.18s, box-shadow 0.18s, background 0.18s !important;
    border-radius: 10px !important;
    border: 1px solid rgba(15,23,42,0.09) !important;
    background: rgba(15,23,42,0.05) !important;
    box-shadow: none !important;
    outline: none !important;
  }
  .sn3-search.ant-input-affix-wrapper .ant-input {
    background: transparent !important;
  }
  [data-theme='dark'] .sn3-search.ant-input-affix-wrapper {
    border: 1px solid rgba(255,255,255,0.07) !important;
    background: rgba(255,255,255,0.05) !important;
  }
  .sn3-search.ant-input-affix-wrapper:hover {
    border-color: rgba(99,102,241,0.28) !important;
    background: rgba(15,23,42,0.07) !important;
    box-shadow: none !important;
  }
  [data-theme='dark'] .sn3-search.ant-input-affix-wrapper:hover {
    background: rgba(255,255,255,0.08) !important;
    border-color: rgba(99,102,241,0.22) !important;
  }
  .sn3-search.ant-input-affix-wrapper-focused,
  .sn3-search.ant-input-affix-wrapper:focus-within {
    border-color: rgba(99,102,241,0.50) !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.09) !important;
    background: rgba(15,23,42,0.03) !important;
    outline: none !important;
  }
  [data-theme='dark'] .sn3-search.ant-input-affix-wrapper-focused,
  [data-theme='dark'] .sn3-search.ant-input-affix-wrapper:focus-within {
    background: rgba(255,255,255,0.07) !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.14) !important;
  }
  /* Placeholder color — subtle */
  .sn3-search input::placeholder {
    color: rgba(15,23,42,0.30) !important;
    font-size: 12.5px !important;
  }
  [data-theme='dark'] .sn3-search input::placeholder {
    color: rgba(255,255,255,0.26) !important;
  }
  /* Kill AntD's default blue outline on focus */
  .sn3-search.ant-input-affix-wrapper input:focus {
    outline: none !important;
    box-shadow: none !important;
  }

  /* ── Scrollbar ───────────────────────────────────────────────── */
  .sn3-scroll::-webkit-scrollbar { width: 4px; }
  .sn3-scroll::-webkit-scrollbar-track { background: transparent; }
  .sn3-scroll::-webkit-scrollbar-thumb {
    background: rgba(15,23,42,0.08);
    border-radius: 4px;
  }
  .sn3-scroll::-webkit-scrollbar-thumb:hover { background: rgba(15,23,42,0.16); }
  [data-theme='dark'] .sn3-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }

  .sn3-sider { font-family: inherit; }

  /* ── Mobile: advanced professional layout ────────────────────── */
  @media (max-width: 768px) {
    /* Zone labels */
    .sn3-zone-label {
      padding: 8px 14px 2px;
      font-size: 9.5px;
      letter-spacing: 0.9px;
    }

    /* Section toggle — icon pill + text + chevron */
    .sn3-section-toggle {
      font-size: 13px !important;
      font-weight: 500 !important;
      padding: 8px 10px !important;
      border-radius: 5px !important;
      gap: 7px !important;
      min-height: 0 !important;
      height: auto !important;
    }
    button.sn3-section-toggle {
      min-height: 0 !important;
      min-width: 0 !important;
      height: auto !important;
    }

    /* Nav leaf items — padding fits text height only */
    .sn3-leaf {
      font-size: 13px !important;
      padding: 8px 10px !important;
      border-radius: 5px !important;
      gap: 7px !important;
      line-height: 1.3 !important;
      min-height: 0 !important;
      height: auto !important;
      max-height: 36px !important;
    }
    button.sn3-leaf {
      min-height: 0 !important;
      min-width: 0 !important;
      height: auto !important;
      max-height: 36px !important;
    }

    /* Active leaf — stronger gradient */
    .sn3-leaf.is-active {
      background: linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(31,111,235,0.11) 100%) !important;
    }

    /* Search input */
    .sn3-search.ant-input-affix-wrapper {
      height: 32px !important;
      font-size: 12.5px !important;
      border-radius: 9px !important;
    }

    /* Scroll body */
    .sn3-scroll {
      padding: 2px 8px 16px !important;
    }

    /* Sub-items indent */
    .sn3-scroll [style*="paddingInlineStart: 22"] {
      padding-inline-start: 14px !important;
    }

    /* Zone section gap */
    .sn3-scroll > div {
      margin-bottom: 4px !important;
    }
  }
`;

// suppress unused
void space;

export default SideNav;
