/**
 * CommandPalette — ⌘K / Ctrl+K global search overlay.
 *
 * Features:
 * - Glass Morphism background (backdrop-filter: blur(24px)) with glass.palette tokens
 * - Fuzzy/substring search across navDestinations + quick actions + recents
 * - Full keyboard navigation: ↑↓ move, Enter select, Escape close
 * - Focus trap (useFocusTrap) while open; returns focus to trigger on close
 * - ARIA: role="dialog", aria-modal, aria-label, aria-activedescendant, aria-live
 * - RTL/LTR aware layout
 * - commandStore integration for open/close state
 *
 * Requirements: 6.1–6.8, 12.2
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Empty } from 'antd';
import {
  SearchOutlined,
  EnterOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildNavSections, buildNavZones, flattenRoutes } from './navigation';
import { glass, palette, radius, shadow, space, zIndex } from '../theme/tokens';
import { useNavStore } from '../stores/navStore';
import { useAuthStore } from '../store';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useOnboardingStore } from '../onboarding/store';
import { usePermission } from '../hooks/usePermission';
import { buildSettingsCommandItems } from '../settings/utils/settingsCommandItems';
import { useRoleUx } from '../hooks/useRoleUx';
import { applyNavProfile } from '../personas/navProfiles';

// ─────────────────────────────────────────────────────────────────────────────
// CommandItem interface — spec requirement 8 sub-task 3
// ─────────────────────────────────────────────────────────────────────────────
export interface CommandItem {
  id: string;
  label: string;
  labelEn: string;
  category: 'page' | 'action' | 'recent';
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick actions — static actions available in the palette
// ─────────────────────────────────────────────────────────────────────────────
const QUICK_ACTIONS: Array<{ id: string; labelKey: string; labelEn: string; path: string; shortcut?: string }> = [
  { id: 'qa-new-invoice',  labelKey: 'nav.new_invoice',  labelEn: 'New Invoice',       path: '/invoices/new',  shortcut: 'C I' },
  { id: 'qa-new-bill',     labelKey: 'nav.new_bill',     labelEn: 'New Bill',          path: '/bills/new',     shortcut: 'C B' },
  { id: 'qa-new-customer', labelKey: 'nav.new_customer', labelEn: 'New Customer',      path: '/contacts/new',  shortcut: 'C C' },
  { id: 'qa-new-item',     labelKey: 'nav.new_item',     labelEn: 'New Item',          path: '/items/new',     shortcut: 'C P' },
  { id: 'qa-new-quote',    labelKey: 'nav.new_quote',    labelEn: 'New Quote',         path: '/quotes/new',    shortcut: 'C Q' },
  { id: 'qa-settings',     labelKey: 'nav.settings',     labelEn: 'Settings',          path: '/settings' },
  { id: 'qa-dashboard',    labelKey: 'nav.dashboard',    labelEn: 'Dashboard',         path: '/' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Fuzzy/substring search — synchronous, in-memory, < 100ms for < 500 items
// ─────────────────────────────────────────────────────────────────────────────
function scoreItem(item: CommandItem, query: string): number {
  const q = query.toLowerCase();
  const label = item.label.toLowerCase();
  const labelEn = item.labelEn.toLowerCase();

  // Exact match
  if (label === q || labelEn === q) return 100;
  // Starts with
  if (label.startsWith(q) || labelEn.startsWith(q)) return 80;
  // Word boundary match
  const words = [...label.split(/\s+/), ...labelEn.split(/\s+/)];
  if (words.some((w) => w.startsWith(q))) return 60;
  // Substring match
  if (label.includes(q) || labelEn.includes(q)) return 40;
  // No match
  return 0;
}

function searchItems(items: CommandItem[], query: string): CommandItem[] {
  const q = query.trim();
  if (!q) return items.slice(0, 12);

  return items
    .map((item) => ({ item, score: scoreItem(item, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
    .slice(0, 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { theme: appTheme } = useAuthStore();
  const recents = useNavStore((s) => s.recents);
  const enabledModules = useOnboardingStore((s) => s.enabledModules);
  const { role, permissions } = usePermission();
  const { theme } = useRoleUx();

  const isDark = appTheme === 'dark';
  const isRTL = i18n.language === 'ku' || i18n.language === 'ar';

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // Refs for focus management
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus trap while open
  useFocusTrap(containerRef, open);

  // Reset state when palette opens/closes
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  // Build the full search index on mount (and when recents/t changes)
  const allItems: CommandItem[] = useMemo(() => {
    const sections = applyNavProfile(buildNavSections(t), theme.navProfile);
    const zones = buildNavZones(t);
    const flatRoutes = flattenRoutes(sections, zones);

    const pageItems: CommandItem[] = flatRoutes.map((item) => ({
      id: `page:${item.key}`,
      label: item.label,
      labelEn: item.label,
      category: 'page' as const,
      icon: item.icon,
      action: () => navigate(item.key),
    }));

    const roleActionItems: CommandItem[] = theme.quickActions.map((qa) => ({
      id: `role:${qa.id}`,
      label: t(qa.labelKey, qa.fallbackLabel),
      labelEn: qa.fallbackLabel,
      category: 'action' as const,
      icon: <ThunderboltOutlined style={{ color: theme.accent }} />,
      action: () => navigate(qa.route),
    }));

    const actionItems: CommandItem[] = QUICK_ACTIONS.map((qa) => ({
      id: qa.id,
      label: t(qa.labelKey, qa.labelEn),
      labelEn: qa.labelEn,
      category: 'action' as const,
      icon: <ThunderboltOutlined />,
      shortcut: qa.shortcut,
      action: () => navigate(qa.path),
    }));

    const recentItems: CommandItem[] = recents.map((r) => ({
      id: `recent:${r.key}`,
      label: r.label,
      labelEn: r.label,
      category: 'recent' as const,
      icon: <ClockCircleOutlined />,
      action: () => navigate(r.key),
    }));

    const settingsItems = buildSettingsCommandItems(t, navigate, enabledModules, role, permissions);

    return [...recentItems, ...roleActionItems, ...actionItems, ...settingsItems, ...pageItems];
  }, [t, recents, navigate, enabledModules, role, permissions, theme]);

  // Filtered results — synchronous, < 100ms for < 500 items
  const filtered = useMemo(() => searchItems(allItems, query), [allItems, query]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(`[data-active="true"]`);
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Handle item selection
  const selectItem = useCallback(
    (item: CommandItem) => {
      item.action();
      onClose();
      setQuery('');
    },
    [onClose],
  );

  // Keyboard navigation
  const handleKeyDown: React.KeyboardEventHandler = useCallback(
    (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[activeIndex]) {
            selectItem(filtered[activeIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    },
    [filtered, activeIndex, selectItem, onClose],
  );

  // Glass morphism styles
  const glassTokens = isDark ? glass.palette.dark : glass.palette.light;
  const overlayBg = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(15,23,42,0.4)';

  // Category label helper
  const getCategoryLabel = (category: CommandItem['category']): string => {
    switch (category) {
      case 'recent': return isRTL ? 'دواین' : 'Recent';
      case 'action': return isRTL ? 'کردار' : 'Actions';
      case 'page':   return isRTL ? 'لاپەڕە' : 'Pages';
    }
  };

  // Group results by category for display
  const groupedResults = useMemo(() => {
    if (query.trim()) {
      // When searching, show flat list (no grouping)
      return null;
    }
    // Default view: group by category
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [filtered, query]);

  // Active item id for aria-activedescendant
  const activeItemId = filtered[activeIndex]
    ? `cmd-item-${filtered[activeIndex].id}`
    : undefined;

  if (!open) return null;

  return (
    /* Backdrop overlay */
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.modal,
        background: overlayBg,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Dialog container */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('command_palette.title', 'Command Palette')}
        aria-activedescendant={activeItemId}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          maxWidth: 640,
          marginInline: space.lg,
          borderRadius: radius.lg,
          overflow: 'hidden',
          // Glass Morphism — Requirements 6.6, 12.2
          background: glassTokens.bg,
          backdropFilter: glassTokens.blur,
          WebkitBackdropFilter: glassTokens.blur,
          border: `1px solid ${glassTokens.border}`,
          boxShadow: isDark ? shadow.dark.xl : shadow.xl,
          // Fallback for browsers without backdrop-filter support
          // (handled via @supports in globalStyles.css)
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: `${space.md}px ${space.lg}px`,
            borderBottom: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
            gap: space.sm,
          }}
        >
          <SearchOutlined
            style={{
              color: isDark ? palette.darkInkMuted : palette.ink500,
              fontSize: 18,
              flexShrink: 0,
            }}
          />
          <input
            // Using native input for better control over focus/ARIA
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={filtered.length > 0}
            aria-controls="cmd-results-list"
            aria-autocomplete="list"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('command_palette.placeholder', 'Search pages, actions, recents…')}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 16,
              color: isDark ? palette.darkInk : palette.ink900,
              fontFamily: isRTL
                ? "'Vazirmatn', 'Noto Sans Arabic', system-ui, sans-serif"
                : "'Inter', system-ui, sans-serif",
              direction: isRTL ? 'rtl' : 'ltr',
            }}
          />
          <kbd
            style={{
              fontSize: 11,
              color: isDark ? palette.darkInkMuted : palette.ink500,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
              border: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
              borderRadius: radius.xs,
              padding: '2px 6px',
              flexShrink: 0,
            }}
          >
            Esc
          </kbd>
        </div>

        {/* Results list */}
        <div
          id="cmd-results-list"
          ref={listRef}
          role="listbox"
          aria-label={t('command_palette.results', 'Search results')}
          style={{
            maxHeight: 420,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: `${space.xxl}px ${space.lg}px`, textAlign: 'center' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: isDark ? palette.darkInkMuted : palette.ink500 }}>
                    {t('command_palette.no_results', 'No results found')}
                  </span>
                }
              />
            </div>
          ) : groupedResults ? (
            // Grouped view (no query)
            Object.entries(groupedResults).map(([category, items]) => (
              <div key={category}>
                <div
                  style={{
                    padding: `${space.xs}px ${space.lg}px`,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: isDark ? palette.darkInkMuted : palette.ink500,
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
                  }}
                >
                  {getCategoryLabel(category as CommandItem['category'])}
                </div>
                {items.map((item) => {
                  const globalIdx = filtered.indexOf(item);
                  return (
                    <CommandItemRow
                      key={item.id}
                      item={item}
                      isActive={globalIdx === activeIndex}
                      isDark={isDark}
                      isRTL={isRTL}
                      onMouseEnter={() => setActiveIndex(globalIdx)}
                      onClick={() => selectItem(item)}
                    />
                  );
                })}
              </div>
            ))
          ) : (
            // Flat list (with query)
            filtered.map((item, idx) => (
              <CommandItemRow
                key={item.id}
                item={item}
                isActive={idx === activeIndex}
                isDark={isDark}
                isRTL={isRTL}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => selectItem(item)}
              />
            ))
          )}
        </div>

        {/* Footer — result count + keyboard hints */}
        <div
          style={{
            padding: `${space.xs}px ${space.lg}px`,
            borderTop: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: space.md,
          }}
        >
          {/* aria-live region for result count — Requirement 6 ARIA */}
          <span
            aria-live="polite"
            aria-atomic="true"
            style={{
              fontSize: 11,
              color: isDark ? palette.darkInkMuted : palette.ink500,
            }}
          >
            {filtered.length}{' '}
            {isRTL ? 'ئەنجام' : filtered.length === 1 ? 'result' : 'results'}
          </span>
          <span
            style={{
              fontSize: 11,
              color: isDark ? palette.darkInkMuted : palette.ink500,
              display: 'flex',
              gap: space.md,
              alignItems: 'center',
            }}
          >
            <span>↑↓ {isRTL ? 'ناوبردن' : 'navigate'}</span>
            <span>
              <EnterOutlined /> {isRTL ? 'کردن' : 'open'}
            </span>
            <span>Esc {isRTL ? 'داخستن' : 'close'}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CommandItemRow — individual result row
// ─────────────────────────────────────────────────────────────────────────────
interface CommandItemRowProps {
  item: CommandItem;
  isActive: boolean;
  isDark: boolean;
  isRTL: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}

const CommandItemRow: React.FC<CommandItemRowProps> = ({
  item,
  isActive,
  isDark,
  isRTL,
  onMouseEnter,
  onClick,
}) => {
  const activeBg = isDark ? 'rgba(31,111,235,0.18)' : palette.primary50;
  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)';

  const categoryIcon =
    item.category === 'recent' ? (
      <ClockCircleOutlined style={{ fontSize: 13, opacity: 0.6 }} />
    ) : item.category === 'action' ? (
      <ThunderboltOutlined style={{ fontSize: 13, opacity: 0.6 }} />
    ) : (
      <AppstoreOutlined style={{ fontSize: 13, opacity: 0.6 }} />
    );

  return (
    <div
      id={`cmd-item-${item.id}`}
      role="option"
      aria-selected={isActive}
      data-active={isActive}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={-1}
      style={{
        padding: `${space.sm}px ${space.lg}px`,
        cursor: 'pointer',
        background: isActive ? activeBg : 'transparent',
        borderInlineStart: isActive
          ? `3px solid ${palette.primary500}`
          : '3px solid transparent',
        transition: 'background 120ms, border-color 120ms',
        display: 'flex',
        alignItems: 'center',
        gap: space.md,
        minHeight: 44, // a11y touch target
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }
      }}
      onMouseOver={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = hoverBg;
        }
      }}
    >
      {/* Icon */}
      <span
        style={{
          color: isActive
            ? palette.primary500
            : isDark
            ? palette.darkInkMuted
            : palette.ink500,
          fontSize: 16,
          flexShrink: 0,
          width: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {item.icon ?? categoryIcon}
      </span>

      {/* Label + category */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: isDark ? palette.darkInk : palette.ink900,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.label}
        </div>
        {item.category === 'page' && (
          <div
            style={{
              fontSize: 11,
              color: isDark ? palette.darkInkMuted : palette.ink500,
              marginTop: 1,
            }}
          >
            {item.id.replace('page:', '')}
          </div>
        )}
      </div>

      {/* Shortcut badge */}
      {item.shortcut && (
        <kbd
          style={{
            fontSize: 11,
            color: isDark ? palette.darkInkMuted : palette.ink500,
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
            border: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
            borderRadius: 4,
            padding: '1px 5px',
            flexShrink: 0,
          }}
        >
          {item.shortcut}
        </kbd>
      )}

      {/* Enter hint on active item */}
      {isActive && (
        <span
          style={{
            color: palette.primary500,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            flexShrink: 0,
          }}
        >
          <EnterOutlined />
        </span>
      )}
    </div>
  );
};

export default CommandPalette;
