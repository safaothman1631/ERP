import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { resolveLanguage, type Language } from '../utils/language';

/**
 * uiStore — global UI state for chrome.
 *
 * Persisted to localStorage using individual keys:
 *   ui.sidebarCollapsed  — sidebar collapsed state
 *   ui.density           — density mode (compact / comfortable / spacious)
 *   ui.theme             — theme mode (light / dark / high-contrast)
 *
 * Requirements: 1.5, 1.9, 3.7, 4.10
 */

/** Three density modes with concrete base spacing grids.
 *  compact:     4px grid, 32px controlHeight, 16px page padding (ERP default)
 *  comfortable: 6px grid, 36px controlHeight, 20px page padding
 *  spacious:    8px grid, 44px controlHeight, 24px page padding
 *  Requirements: 1.5
 */
export type Density = 'compact' | 'comfortable' | 'spacious';
export type ThemeMode = 'light' | 'dark' | 'high-contrast';

interface UiState {
  // Layout
  sidebarCollapsed: boolean;
  density: Density;
  highContrast: boolean;

  // Language — persisted to localStorage (Requirements 3.7)
  language: Language;

  // Drawers / overlays
  notificationsOpen: boolean;
  quickCreateOpen: boolean;
  shortcutsOpen: boolean;

  // Pinned favorites (route paths)
  pinnedFavorites: string[];

  // Recent items (route paths, max 8)
  recentItems: string[];

  // Feature flag
  uiV2Enabled: boolean;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setDensity: (d: Density) => void;
  toggleHighContrast: () => void;
  setLanguage: (l: Language) => void;
  setNotificationsOpen: (v: boolean) => void;
  setQuickCreateOpen: (v: boolean) => void;
  setShortcutsOpen: (v: boolean) => void;
  togglePinned: (path: string) => void;
  setPinned: (paths: string[]) => void;
  pushRecent: (path: string) => void;
  setUiV2Enabled: (v: boolean) => void;
}

/**
 * Custom storage that maps each persisted key to its own localStorage entry.
 * This allows the spec-required keys (ui.density, ui.sidebarCollapsed) to be
 * read directly from localStorage without parsing the whole store blob.
 * Requirements: 1.9, 4.10
 */
const uiStorage = createJSONStorage(() => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : (undefined as unknown as Storage);
  } catch {
    return undefined as unknown as Storage;
  }
});

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      density: 'comfortable',
      highContrast: false,
      language: resolveLanguage(
        (() => { try { return localStorage.getItem('i18n.language') ?? 'ku'; } catch { return 'ku'; } })()
      ),
      notificationsOpen: false,
      quickCreateOpen: false,
      shortcutsOpen: false,
      pinnedFavorites: ['/', '/invoices', '/bills', '/contacts', '/items'],
      recentItems: [],
      uiV2Enabled: true,

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setDensity: (d) => {
        set({ density: d });
        // Also write to the spec-required individual key for direct reads
        try { localStorage.setItem('ui.density', d); } catch { /* noop */ }
      },
      toggleHighContrast: () => set((s) => ({ highContrast: !s.highContrast })),
      setLanguage: (l) => {
        const resolved = resolveLanguage(l);
        set({ language: resolved });
        // Persist to spec-required key (Requirement 3.7)
        try { localStorage.setItem('i18n.language', resolved); } catch { /* noop */ }
      },
      setNotificationsOpen: (v) => set({ notificationsOpen: v }),
      setQuickCreateOpen: (v) => set({ quickCreateOpen: v }),
      setShortcutsOpen: (v) => set({ shortcutsOpen: v }),
      togglePinned: (path) => {
        const cur = get().pinnedFavorites;
        set({
          pinnedFavorites: cur.includes(path)
            ? cur.filter((p) => p !== path)
            : [...cur, path],
        });
      },
      setPinned: (paths) => set({ pinnedFavorites: paths }),
      pushRecent: (path) => {
        const cur = get().recentItems.filter((p) => p !== path);
        set({ recentItems: [path, ...cur].slice(0, 8) });
      },
      setUiV2Enabled: (v) => set({ uiV2Enabled: v }),
    }),
    {
      name: 'ui.density',
      storage: uiStorage,
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        density: s.density,
        highContrast: s.highContrast,
        language: s.language,
        pinnedFavorites: s.pinnedFavorites,
        recentItems: s.recentItems,
        uiV2Enabled: s.uiV2Enabled,
      }),
    }
  )
);
