import { create } from 'zustand';

/**
 * commandStore — session-only state for the Command Palette (⌘K / Ctrl+K).
 * Not persisted — resets on page reload.
 */
interface CommandState {
  /** Whether the command palette is open */
  open: boolean;
  /** Current search query string */
  query: string;

  // Actions
  setOpen: (open: boolean) => void;
  setQuery: (query: string) => void;
  /** Convenience: open the palette and optionally pre-fill a query */
  openPalette: (query?: string) => void;
  /** Convenience: close the palette and clear the query */
  closePalette: () => void;
}

export const useCommandStore = create<CommandState>()((set) => ({
  open: false,
  query: '',

  setOpen: (open) => set({ open }),
  setQuery: (query) => set({ query }),

  openPalette: (query = '') => set({ open: true, query }),
  closePalette: () => set({ open: false, query: '' }),
}));
