import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * NavItem — a navigable destination in the sidebar.
 */
export interface NavItem {
  /** Unique route key, e.g. '/invoices' */
  key: string;
  /** Translated display label */
  label: string;
  /** Optional icon identifier */
  icon?: string;
  /** Module/section this item belongs to */
  section?: string;
}

const MAX_FAVORITES = 10;
const MAX_RECENTS = 5;

interface NavState {
  /** Pinned favorites — max 10 items */
  favorites: NavItem[];
  /** Recently visited pages — max 5 items, most recent first (FIFO eviction) */
  recents: NavItem[];

  /** Pin an item to favorites (no-op if already pinned or limit reached) */
  pin: (item: NavItem) => void;
  /** Unpin an item from favorites by key */
  unpin: (key: string) => void;
  /** Add a page to recents; evicts oldest entry when limit is exceeded */
  addRecent: (item: NavItem) => void;
}

export const useNavStore = create<NavState>()(
  persist(
    (set, get) => ({
      favorites: [],
      recents: [],

      pin: (item) => {
        const { favorites } = get();
        // No-op if already pinned
        if (favorites.some((f) => f.key === item.key)) return;
        // Enforce max 10 favorites
        if (favorites.length >= MAX_FAVORITES) return;
        set({ favorites: [...favorites, item] });
      },

      unpin: (key) => {
        set((s) => ({ favorites: s.favorites.filter((f) => f.key !== key) }));
      },

      addRecent: (item) => {
        const { recents } = get();
        // Remove existing entry for this key (dedup), then prepend
        const filtered = recents.filter((r) => r.key !== item.key);
        // Prepend new item and enforce max 5 (FIFO — oldest at end gets evicted)
        const updated = [item, ...filtered].slice(0, MAX_RECENTS);
        set({ recents: updated });
      },
    }),
    {
      name: 'nav.store.v1',
      partialize: (s) => ({
        favorites: s.favorites,
        recents: s.recents,
      }),
    }
  )
);
