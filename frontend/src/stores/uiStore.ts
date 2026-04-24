import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * uiStore — Sprint 1 v2 — global UI state for chrome.
 * Persisted to localStorage (key: shell.ui.v2).
 */

export type Density = 'compact' | 'comfortable' | 'spacious';
export type ThemeMode = 'light' | 'dark' | 'high-contrast';

interface UiState {
  // Layout
  sidebarCollapsed: boolean;
  density: Density;
  highContrast: boolean;

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
  setNotificationsOpen: (v: boolean) => void;
  setQuickCreateOpen: (v: boolean) => void;
  setShortcutsOpen: (v: boolean) => void;
  togglePinned: (path: string) => void;
  setPinned: (paths: string[]) => void;
  pushRecent: (path: string) => void;
  setUiV2Enabled: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      density: 'comfortable',
      highContrast: false,
      notificationsOpen: false,
      quickCreateOpen: false,
      shortcutsOpen: false,
      pinnedFavorites: ['/', '/invoices', '/bills', '/contacts', '/items'],
      recentItems: [],
      uiV2Enabled: true,

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setDensity: (d) => set({ density: d }),
      toggleHighContrast: () => set((s) => ({ highContrast: !s.highContrast })),
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
      name: 'shell.ui.v2',
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        density: s.density,
        highContrast: s.highContrast,
        pinnedFavorites: s.pinnedFavorites,
        recentItems: s.recentItems,
        uiV2Enabled: s.uiV2Enabled,
      }),
    }
  )
);
