import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark';
export type LayoutMode = 'default' | 'compact' | 'wide';

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  roles?: string[];
}

interface AuthState {
  /** Authenticated user object; null when logged out */
  user: AuthUser | null;
  /** JWT / session token */
  token: string | null;
  /** User's preferred theme */
  theme: ThemeMode;
  /** User's preferred layout mode */
  layoutMode: LayoutMode;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  setTheme: (theme: ThemeMode) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  /** Clear all auth state and persisted data */
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      theme: 'light',
      layoutMode: 'default',

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setTheme: (theme) => set({ theme }),
      setLayoutMode: (mode) => set({ layoutMode: mode }),

      logout: () =>
        set({
          user: null,
          token: null,
          // Preserve theme and layoutMode preferences on logout
        }),
    }),
    {
      name: 'auth.store.v1',
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        theme: s.theme,
        layoutMode: s.layoutMode,
      }),
    }
  )
);
