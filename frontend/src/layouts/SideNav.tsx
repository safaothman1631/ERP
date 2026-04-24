import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Layout, Input, Tooltip, Typography } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  CaretDownFilled,
  ClockCircleOutlined,
  InfoCircleOutlined,
  MacCommandOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import { palette, radius, space, shadow, motion as motionTk, fontSize } from '../theme/tokens';
import { buildNavSections, buildNavZones, flattenRoutes, type FlattenedNavLeaf, type NavSection, type NavZone } from './navigation';
import { getModuleKeyForPath } from './moduleMap';
import { isModuleEnabled, useOnboardingStore } from '../onboarding/store';

const { Sider } = Layout;
const { Text } = Typography;

const MAX_RECENTS = 7;

const readStoredPaths = (storageKey: string): string[] => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

const writeStoredPaths = (storageKey: string, values: string[]) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(values));
  } catch {
    // ignore storage errors
  }
};

const pathMatchesRoute = (pathname: string, route: FlattenedNavLeaf) =>
  pathname === route.key || (route.key !== '/' && pathname.startsWith(`${route.key}/`));

const findMatchingRoute = (pathname: string, routes: FlattenedNavLeaf[]) =>
  [...routes]
    .sort((left, right) => right.key.length - left.key.length)
    .find((route) => pathMatchesRoute(pathname, route));

const routeMatchesQuery = (route: FlattenedNavLeaf, section: NavSection, zone: NavZone, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  const haystack = [
    route.label,
    route.description || '',
    route.key,
    ...(route.keywords || []),
    section.label,
    section.blurb || '',
    zone.label,
    zone.blurb,
  ].join(' ').toLowerCase();
  return haystack.includes(normalizedQuery);
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
 * SideNav — sectioned + collapsible groups + animated indicator + search-friendly.
 * Token-driven (theme/tokens.ts). Hover lift + selected pill.
 */
export const SideNav: React.FC<SideNavProps> = ({ collapsed, width, collapsedWidth, isRTL, isDark, density = 'comfortable', onDensityChange, onOpenPalette, onOpenSectionDocs }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  const sections = useMemo<NavSection[]>(() => buildNavSections(t), [t]);
  const zones = useMemo<NavZone[]>(() => buildNavZones(t), [t]);

  // ── Onboarding-driven module filter ────────────────────────────────────
  // When user finished onboarding, hide sidebar items whose ModuleKey isn't enabled.
  // Sections that become empty are dropped to avoid dangling headers.
  const enabledModules = useOnboardingStore(s => s.enabledModules);
  const filteredSections = useMemo<NavSection[]>(() => {
    if (!enabledModules) return sections; // not yet onboarded → show all
    return sections
      .map(sec => ({
        ...sec,
        items: sec.items.filter(it => isModuleEnabled(getModuleKeyForPath(it.key) ?? undefined, enabledModules)),
      }))
      .filter(sec => sec.items.length > 0);
  }, [sections, enabledModules]);

  const flattenedRoutes = useMemo(() => flattenRoutes(filteredSections, zones), [filteredSections, zones]);

  const storageScope = useMemo(() => {
    try {
      return localStorage.getItem('orgId') || 'global';
    } catch {
      return 'global';
    }
  }, []);

  const favoritesKey = `nav.favorites.${storageScope}`;
  const recentsKey = `nav.recents.${storageScope}`;

  const [query, setQuery] = useState('');
  const [favoritePaths, setFavoritePaths] = useState<string[]>(() => readStoredPaths(favoritesKey));
  const [recentPaths, setRecentPaths] = useState<string[]>(() => readStoredPaths(recentsKey));
  const [flyout, setFlyout] = useState<{ sectionKey: string; top: number } | null>(null);

  const delayedQuery = useDeferredValue(query);

  const activeLeaf = useMemo(
    () => findMatchingRoute(location.pathname, flattenedRoutes),
    [location.pathname, flattenedRoutes]
  );

  // ئەو section کە route ئێستای تێدایە، خۆکار بکرێتەوە
  const activeSectionKey = activeLeaf?.sectionKey;
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const defaults = filteredSections.filter((s) => s.defaultOpen).map((s) => s.key);
    return activeSectionKey ? [...new Set([...defaults, activeSectionKey])] : defaults;
  });

  const routeByKey = useMemo(() => new Map(flattenedRoutes.map((route) => [route.key, route])), [flattenedRoutes]);
  const zoneByKey = useMemo(() => new Map(zones.map((zone) => [zone.key, zone])), [zones]);

  const visibleSections = useMemo(() => {
    const normalizedQuery = delayedQuery.trim().toLowerCase();
    if (!normalizedQuery) return filteredSections;

    return filteredSections.reduce<NavSection[]>((acc, section) => {
      const zone = zoneByKey.get(section.zone);
      if (!zone) return acc;

      const sectionMatches = [section.label, section.blurb || '', zone.label, zone.blurb]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);

      const visibleItems = flattenedRoutes
        .filter((route) => route.sectionKey === section.key)
        .filter((route) => (sectionMatches ? true : routeMatchesQuery(route, section, zone, normalizedQuery)));

      if (visibleItems.length === 0) return acc;

      acc.push({
        ...section,
        items: visibleItems.map((route) => ({
          key: route.key,
          label: route.label,
          description: route.description,
          keywords: route.keywords,
          favoriteEligible: route.favoriteEligible,
        })),
      });
      return acc;
    }, []);
  }, [delayedQuery, flattenedRoutes, filteredSections, zoneByKey]);

  const visibleZones = useMemo(
    () => zones.map((zone) => ({ ...zone, sections: visibleSections.filter((section) => section.zone === zone.key) })).filter((zone) => zone.sections.length > 0),
    [visibleSections, zones]
  );

  const favoriteRoutes = useMemo(
    () => favoritePaths.map((path) => routeByKey.get(path)).filter((route): route is FlattenedNavLeaf => Boolean(route)),
    [favoritePaths, routeByKey]
  );

  const recentRoutes = useMemo(
    () => recentPaths.map((path) => routeByKey.get(path)).filter((route): route is FlattenedNavLeaf => Boolean(route)),
    [recentPaths, routeByKey]
  );

  const isSearching = delayedQuery.trim().length > 0;
  const animationSeconds = prefersReducedMotion ? 0 : motionTk.durBase / 1000;
  const isCompact = density === 'compact';
  const sizing = useMemo(() => ({
    brandPx: isCompact ? 32 : 36,
    sectionIconPx: isCompact ? 26 : 30,
    sectionPadY: isCompact ? 8 : 10,
    sectionPadX: isCompact ? 10 : 12,
    sectionGap: isCompact ? 8 : 10,
    leafPadY: isCompact ? 5 : 7,
    leafPadX: isCompact ? 8 : 10,
    leafFont: isCompact ? 12.5 : 13.5,
    sectionTitleFont: isCompact ? 12.5 : 13.5,
    showLeafDescription: !isCompact,
    zoneGap: isCompact ? 12 : 16,
    leafGap: isCompact ? 4 : 6,
  }), [isCompact]);

  useEffect(() => {
    if (activeSectionKey && !openKeys.includes(activeSectionKey)) {
      setOpenKeys((prev) => [...prev, activeSectionKey]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionKey]);

  useEffect(() => {
    writeStoredPaths(favoritesKey, favoritePaths);
  }, [favoritePaths, favoritesKey]);

  useEffect(() => {
    writeStoredPaths(recentsKey, recentPaths);
  }, [recentPaths, recentsKey]);

  useEffect(() => {
    if (!activeLeaf) return;
    setRecentPaths((prev) => [activeLeaf.key, ...prev.filter((path) => path !== activeLeaf.key)].slice(0, MAX_RECENTS));
  }, [activeLeaf]);

  useEffect(() => {
    if (!collapsed) {
      setFlyout(null);
    }
  }, [collapsed]);

  useEffect(() => {
    setFlyout(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!flyout) return;
    const handlePointerDown = (event: MouseEvent) => {
      const element = event.target as HTMLElement | null;
      if (!element) return;
      if (element.closest('[data-nav-flyout="true"]') || element.closest('[data-nav-section-button="true"]')) {
        return;
      }
      setFlyout(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [flyout]);

  const sidebarBg = isDark ? palette.darkSurface : palette.surface;
  const borderCol = isDark ? palette.darkBorder : palette.border;
  const elevatedSurface = isDark ? palette.darkElevated : '#F5F7FB';
  const ink = isDark ? palette.darkInk : palette.ink900;
  const inkMuted = isDark ? palette.darkInkMuted : palette.ink500;
  const fadeTop = isDark
    ? 'linear-gradient(180deg, rgba(17,26,46,0.96), rgba(17,26,46,0))'
    : 'linear-gradient(180deg, rgba(248,250,252,0.94), rgba(248,250,252,0))';
  const fadeBottom = isDark
    ? 'linear-gradient(0deg, rgba(17,26,46,0.98), rgba(17,26,46,0))'
    : 'linear-gradient(0deg, rgba(248,250,252,0.96), rgba(248,250,252,0))';
  const shellGradient = isDark
    ? 'radial-gradient(circle at top right, rgba(31,111,235,0.16), transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))'
    : 'radial-gradient(circle at top left, rgba(31,111,235,0.12), transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))';

  const toggleSection = (sectionKey: string) => {
    if (isSearching) return;
    setOpenKeys((prev) => (prev.includes(sectionKey) ? prev.filter((key) => key !== sectionKey) : [...prev, sectionKey]));
  };

  const toggleFavorite = (path: string) => {
    setFavoritePaths((prev) => (prev.includes(path) ? prev.filter((item) => item !== path) : [path, ...prev].slice(0, 10)));
  };

  const handleSectionFlyout = (sectionKey: string, target: HTMLElement) => {
    const bounds = target.getBoundingClientRect();
    const nextTop = Math.max(76, Math.min(bounds.top - 10, window.innerHeight - 340));
    setFlyout((prev) => (prev?.sectionKey === sectionKey ? null : { sectionKey, top: nextTop }));
  };

  const navigateTo = (path: string) => {
    navigate(path);
  };

  const renderLeaf = (route: FlattenedNavLeaf, compact = false) => {
    const isActive = activeLeaf?.key === route.key;
    const showDescription = !compact && sizing.showLeafDescription && Boolean(route.description);
    return (
      <div
        key={route.key}
        role="button"
        tabIndex={0}
        onClick={() => navigateTo(route.key)}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigateTo(route.key); } }}
        className={`premium-nav-focus premium-nav-leaf${isActive ? ' is-active' : ''}`}
        data-dark={isDark ? 'true' : 'false'}
        style={{
          position: 'relative',
          width: '100%',
          color: ink,
          borderRadius: radius.md,
          padding: `${sizing.leafPadY}px ${sizing.leafPadX}px`,
          display: 'flex',
          alignItems: showDescription ? 'flex-start' : 'center',
          gap: 8,
          textAlign: 'start',
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        {isActive && (
          <motion.span
            layoutId="premium-nav-active-rail"
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            style={{
              position: 'absolute',
              top: 6,
              bottom: 6,
              [isRTL ? 'right' : 'left']: 4,
              width: 3,
              borderRadius: radius.pill,
              background: `linear-gradient(180deg, ${palette.primary400}, ${palette.primary700})`,
              boxShadow: shadow.primary,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0, paddingInlineStart: isActive ? 8 : 0 }}>
          <div style={{ fontSize: sizing.leafFont, fontWeight: isActive ? 700 : 500, lineHeight: 1.25 }}>{route.label}</div>
          {showDescription && (
            <div className="premium-nav-leaf__desc" style={{ marginTop: 2, fontSize: 11, lineHeight: 1.3, color: inkMuted }}>{route.description}</div>
          )}
        </div>
        {!compact && route.favoriteEligible && (
          <span
            role="button"
            tabIndex={0}
            aria-label={favoritePaths.includes(route.key) ? t('remove_favorite', 'Remove favorite') : t('add_favorite', 'Add favorite')}
            onClick={(event) => {
              event.stopPropagation();
              toggleFavorite(route.key);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                toggleFavorite(route.key);
              }
            }}
            className="premium-nav-focus premium-nav-fav"
            data-active={favoritePaths.includes(route.key) ? 'true' : 'false'}
            style={{
              color: favoritePaths.includes(route.key) ? palette.primary500 : inkMuted,
              cursor: 'pointer',
              padding: 3,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              fontSize: 12,
            }}
          >
            {favoritePaths.includes(route.key) ? <StarFilled /> : <StarOutlined />}
          </span>
        )}
      </div>
    );
  };

  const flyoutSection = flyout ? filteredSections.find((section) => section.key === flyout.sectionKey) : null;

  return (
    <>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={width}
        collapsedWidth={collapsedWidth}
        className="premium-sidenav-shell"
        style={{
          background: sidebarBg,
          borderInlineEnd: `1px solid ${borderCol}`,
          position: 'fixed',
          top: 0,
          bottom: 0,
          [isRTL ? 'right' : 'left']: 0,
          zIndex: 100,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ position: 'relative', padding: collapsed ? `${space.md}px ${space.sm}px ${space.sm}px` : `${space.lg}px ${space.lg}px ${space.md}px` }}>
          <div style={{
            position: 'absolute',
            inset: 8,
            borderRadius: radius.xl,
            background: shellGradient,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(148,163,184,0.12)'}`,
            boxShadow: shadow.sm,
          }} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: space.md }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: space.sm }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: space.md, minWidth: 0 }}>
                <div style={{
                  width: collapsed ? 40 : 44,
                  height: collapsed ? 40 : 44,
                  borderRadius: radius.lg,
                  background: `linear-gradient(135deg, ${palette.primary500}, ${palette.primary800})`,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 16,
                  boxShadow: shadow.primary,
                  flexShrink: 0,
                }}>
                  Z
                </div>
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0, x: isRTL ? 8 : -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: isRTL ? 8 : -8 }}
                      transition={{ duration: animationSeconds }}
                      style={{ minWidth: 0 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Text strong style={{ fontSize: 15, color: ink, lineHeight: 1.1 }}>{t('app_name')}</Text>
                        <span style={{ width: 8, height: 8, borderRadius: radius.pill, background: palette.success, boxShadow: `0 0 0 4px ${isDark ? 'rgba(22,163,74,0.14)' : 'rgba(22,163,74,0.16)'}` }} />
                      </div>
                      <Text style={{ display: 'block', marginTop: 2, fontSize: 11, color: inkMuted }}>
                        {t('app_subtitle')} · ERP cockpit
                      </Text>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {!collapsed && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  borderRadius: radius.pill,
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.14)'}`,
                  color: inkMuted,
                  fontSize: 11,
                }}>
                  <AppstoreOutlined />
                  {flattenedRoutes.length}
                </div>
              )}
            </div>

            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: animationSeconds }}
                  style={{ display: 'grid', gap: space.sm }}
                >
                  <Input
                    allowClear
                    size="large"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    prefix={<SearchOutlined style={{ color: inkMuted }} />}
                    placeholder={t('search_or_jump', 'Search or jump to…')}
                    className="premium-nav-search"
                    style={{
                      borderRadius: radius.lg,
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.16)'}`,
                      background: isDark ? 'rgba(11,18,32,0.72)' : 'rgba(255,255,255,0.82)',
                      boxShadow: 'none',
                      fontSize: 13.5,
                    }}
                    suffix={
                      <span style={{ fontSize: 11, color: inkMuted }}>
                        {visibleSections.reduce((sum, section) => sum + section.items.length, 0)}
                      </span>
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <div className="premium-sidenav-fade premium-sidenav-fade--top" style={{ opacity: collapsed ? 0 : 1, background: fadeTop }} />
          <div className="premium-sidenav-scroll" data-dark={isDark ? 'true' : 'false'} style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', padding: `${space.sm}px ${space.sm}px ${space.xl}px` }}>
            {!collapsed && !isSearching && favoriteRoutes.length > 0 && (
              <div style={{ marginBottom: space.lg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: inkMuted, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 10 }}>
                  <StarFilled style={{ color: palette.primary500 }} />
                  {t('favorites', 'Favorites')}
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {favoriteRoutes.slice(0, 4).map((route) => renderLeaf(route, true))}
                </div>
              </div>
            )}

            {!collapsed && !isSearching && recentRoutes.length > 0 && (
              <div style={{ marginBottom: space.lg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: inkMuted, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 10 }}>
                  <ClockCircleOutlined style={{ color: palette.info }} />
                  {t('recent', 'Recent')}
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {recentRoutes.slice(0, 2).map((route) => renderLeaf(route, true))}
                </div>
              </div>
            )}

            {!collapsed && visibleZones.map((zone, zoneIndex) => (
              <div key={zone.key} style={{ marginBottom: zoneIndex === visibleZones.length - 1 ? 0 : space.lg }}>
                <div style={{ padding: `0 ${space.sm}px`, marginBottom: 8 }}>
                  <div style={{ color: inkMuted, fontSize: 11, fontWeight: 700, letterSpacing: 0.35, textTransform: 'uppercase' }}>{zone.label}</div>
                  <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.35, color: inkMuted }}>{zone.blurb}</div>
                </div>

                <div style={{ display: 'grid', gap: sizing.sectionGap }}>
                  {zone.sections.map((section) => {
                    const isOpen = isSearching || openKeys.includes(section.key) || section.key === activeSectionKey;
                    return (
                      <div key={section.key} className={`premium-nav-section${isOpen ? ' is-open' : ''}`} data-dark={isDark ? 'true' : 'false'} onMouseLeave={() => {
                        if (isSearching) return;
                        setOpenKeys((prev) => prev.filter((key) => key !== section.key));
                      }} style={{
                        borderRadius: radius.lg,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'stretch' }}>
                          <button
                            type="button"
                            data-nav-section-button="true"
                            onClick={() => toggleSection(section.key)}
                            onMouseEnter={() => {
                              if (isSearching) return;
                              if (!openKeys.includes(section.key)) {
                                setOpenKeys((prev) => [...prev, section.key]);
                              }
                            }}
                            className="premium-nav-focus premium-nav-section__toggle"
                            style={{
                              flex: 1,
                              minWidth: 0,
                              border: 'none',
                              background: 'transparent',
                              color: ink,
                              padding: `${sizing.sectionPadY}px ${sizing.sectionPadX}px`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              cursor: 'pointer',
                              textAlign: 'start',
                              borderRadius: radius.lg,
                            }}
                          >
                            <div className="premium-nav-section__icon" style={{
                              width: sizing.sectionIconPx,
                              height: sizing.sectionIconPx,
                              borderRadius: radius.md,
                              display: 'grid',
                              placeItems: 'center',
                              background: isOpen ? `linear-gradient(135deg, ${palette.primary100}, ${palette.primary50})` : elevatedSurface,
                              color: isOpen ? palette.primary600 : ink,
                              flexShrink: 0,
                              fontSize: 14,
                            }}>
                              {section.icon}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: sizing.sectionTitleFont, fontWeight: 700, lineHeight: 1.2 }}>{section.label}</div>
                              {!isCompact && section.blurb && (
                                <div style={{ marginTop: 2, fontSize: 10.5, lineHeight: 1.3, color: inkMuted }}>{section.blurb}</div>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{
                                minWidth: 20,
                                height: 18,
                                borderRadius: radius.pill,
                                paddingInline: 6,
                                background: isDark ? 'rgba(255,255,255,0.06)' : '#EEF2FF',
                                color: isOpen ? palette.primary600 : inkMuted,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 700,
                              }}>
                                {section.items.length}
                              </span>
                              <motion.span
                                animate={{ rotate: isOpen ? 0 : isRTL ? 90 : -90 }}
                                transition={{ duration: animationSeconds }}
                                style={{ color: inkMuted, fontSize: 9 }}
                              >
                                <CaretDownFilled />
                              </motion.span>
                            </div>
                          </button>
                          {onOpenSectionDocs && (
                            <Tooltip title={t('nav.section_info', 'About this section')}>
                              <button
                                type="button"
                                onClick={() => onOpenSectionDocs(section.key)}
                                className="premium-nav-focus premium-nav-section__info"
                                aria-label={t('nav.section_info', 'About this section')}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: inkMuted,
                                  cursor: 'pointer',
                                  padding: `0 ${sizing.sectionPadX}px`,
                                  display: 'grid',
                                  placeItems: 'center',
                                  fontSize: 13,
                                  flexShrink: 0,
                                }}
                              >
                                <InfoCircleOutlined />
                              </button>
                            </Tooltip>
                          )}
                        </div>

                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: animationSeconds, ease: [0.2, 0, 0, 1] }}
                              style={{ overflow: 'hidden', padding: `0 6px ${sizing.sectionPadY}px` }}
                            >
                              <div style={{ display: 'grid', gap: sizing.leafGap, paddingTop: 2 }}>
                                {section.items.map((item) => renderLeaf(routeByKey.get(item.key) || {
                                  key: item.key,
                                  label: item.label,
                                  description: item.description,
                                  keywords: item.keywords,
                                  favoriteEligible: item.favoriteEligible ?? true,
                                  icon: section.icon,
                                  sectionKey: section.key,
                                  sectionLabel: section.label,
                                  zone: section.zone,
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

            {collapsed && (
              <div style={{ display: 'grid', gap: 10 }}>
                {zones.map((zone, zoneIndex) => {
                  const zoneSections = filteredSections.filter((section) => section.zone === zone.key);
                  return (
                    <div key={zone.key} style={{ display: 'grid', gap: 8 }}>
                      {zoneIndex > 0 && <div style={{ height: 1, margin: `4px ${space.md}px`, background: borderCol }} />}
                      {zoneSections.map((section) => {
                        const isActiveSection = section.key === activeSectionKey;
                        return (
                          <Tooltip key={section.key} placement={isRTL ? 'left' : 'right'} title={`${section.label} · ${section.items.length}`}>
                            <button
                              type="button"
                              data-nav-section-button="true"
                              onClick={(event) => handleSectionFlyout(section.key, event.currentTarget)}
                              className="premium-nav-focus"
                              style={{
                                width: 48,
                                height: 48,
                                marginInline: 'auto',
                                borderRadius: radius.xl,
                                border: `1px solid ${isActiveSection ? palette.primary200 : 'transparent'}`,
                                background: isActiveSection ? (isDark ? 'rgba(31,111,235,0.18)' : 'rgba(31,111,235,0.09)') : elevatedSurface,
                                color: isActiveSection ? palette.primary600 : ink,
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                                boxShadow: isActiveSection ? shadow.sm : 'none',
                              }}
                            >
                              {section.icon}
                            </button>
                          </Tooltip>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {!collapsed && visibleZones.length === 0 && (
              <div style={{ padding: `${space.xxl}px ${space.md}px`, textAlign: 'center', color: inkMuted }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t('no_results', 'No results')}</div>
                <div style={{ marginTop: 6, fontSize: 11 }}>{t('nav_search_no_results', 'Try another keyword or open the command palette')}</div>
              </div>
            )}
          </div>
          <div className="premium-sidenav-fade premium-sidenav-fade--bottom" style={{ opacity: collapsed ? 0 : 1, background: fadeBottom }} />
        </div>

        <div style={{
          padding: collapsed ? `${space.sm}px` : `${space.sm}px ${space.lg}px ${space.md}px`,
          borderTop: `1px solid ${borderCol}`,
          background: isDark ? 'rgba(11,18,32,0.76)' : 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(18px)',
        }}>
          {collapsed ? (
            <div style={{ display: 'grid', placeItems: 'center', color: inkMuted, fontSize: 11 }}>v1</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: ink }}>v1.1 · ECC</div>
                <div style={{ fontSize: 10.5, color: inkMuted }}>{t('nav_footer_hint', 'Fast lane for every ERP surface')}</div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Tooltip title={t('nav.density_comfortable', 'Comfortable')}>
                  <button
                    type="button"
                    onClick={() => onDensityChange?.('comfortable')}
                    className="premium-nav-focus"
                    aria-pressed={density === 'comfortable'}
                    style={{
                      border: `1px solid ${density === 'comfortable' ? palette.primary400 : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(148,163,184,0.18)')}`,
                      background: density === 'comfortable' ? (isDark ? 'rgba(31,111,235,0.22)' : 'rgba(31,111,235,0.1)') : 'transparent',
                      color: density === 'comfortable' ? palette.primary500 : inkMuted,
                      borderRadius: radius.md,
                      padding: '3px 7px',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      letterSpacing: 0.2,
                    }}
                  >C</button>
                </Tooltip>
                <Tooltip title={t('nav.density_compact', 'Compact')}>
                  <button
                    type="button"
                    onClick={() => onDensityChange?.('compact')}
                    className="premium-nav-focus"
                    aria-pressed={density === 'compact'}
                    style={{
                      border: `1px solid ${density === 'compact' ? palette.primary400 : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(148,163,184,0.18)')}`,
                      background: density === 'compact' ? (isDark ? 'rgba(31,111,235,0.22)' : 'rgba(31,111,235,0.1)') : 'transparent',
                      color: density === 'compact' ? palette.primary500 : inkMuted,
                      borderRadius: radius.md,
                      padding: '3px 7px',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      letterSpacing: 0.2,
                    }}
                  >S</button>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
      </Sider>

      <AnimatePresence>
        {collapsed && flyoutSection && (
          <motion.aside
            key={flyoutSection.key}
            data-nav-flyout="true"
            initial={{ opacity: 0, x: isRTL ? 14 : -14, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: isRTL ? 14 : -14, scale: 0.98 }}
            transition={{ duration: animationSeconds }}
            style={{
              position: 'fixed',
              top: flyout?.top ?? 76,
              [isRTL ? 'right' : 'left']: collapsedWidth + 12,
              width: 272,
              maxHeight: 'calc(100vh - 88px)',
              overflowY: 'auto',
              background: isDark ? palette.darkSurface : palette.surface,
              border: `1px solid ${borderCol}`,
              borderRadius: radius.xl,
              boxShadow: shadow.lg,
              zIndex: 140,
              padding: space.md,
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: space.md }}>
              <div style={{ width: 38, height: 38, borderRadius: radius.lg, background: elevatedSurface, display: 'grid', placeItems: 'center', color: palette.primary600 }}>
                {flyoutSection.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: fontSize.md, fontWeight: 700, color: ink }}>{flyoutSection.label}</div>
                {flyoutSection.blurb && <div style={{ marginTop: 2, fontSize: 11, color: inkMuted }}>{flyoutSection.blurb}</div>}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {flyoutSection.items.map((item) => renderLeaf(routeByKey.get(item.key) || {
                key: item.key,
                label: item.label,
                description: item.description,
                keywords: item.keywords,
                favoriteEligible: item.favoriteEligible ?? true,
                icon: flyoutSection.icon,
                sectionKey: flyoutSection.key,
                sectionLabel: flyoutSection.label,
                zone: flyoutSection.zone,
                zoneLabel: zoneByKey.get(flyoutSection.zone)?.label || '',
              }))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};

export default SideNav;
