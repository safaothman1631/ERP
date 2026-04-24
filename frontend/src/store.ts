import { create } from 'zustand';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';

export type LayoutMode =
  | 'classic-sidebar'
  | 'top-megamenu'
  | 'dual-rail'
  | 'icon-rail'
  | 'dashboard-first'
  | 'command-centric'
  | 'workspace-tabs'
  | 'apps-launcher'
  | 'split-master-detail'
  | 'mobile-bottom-nav';

interface AuthState {
  token: string | null;
  userId: string | null;
  orgId: string | null;
  userName: string | null;
  isAuthenticated: boolean;
  theme: 'light' | 'dark';
  layoutMode: LayoutMode;
  login: (token: string, userId: string, orgId: string, userName: string) => void;
  logout: () => void;
  toggleTheme: () => void;
  setLayoutMode: (mode: LayoutMode) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  userId: localStorage.getItem('userId'),
  orgId: localStorage.getItem('orgId'),
  userName: localStorage.getItem('userName'),
  isAuthenticated: !!localStorage.getItem('token'),
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  layoutMode: (localStorage.getItem('shell.layoutMode') as LayoutMode) || 'classic-sidebar',
  login: (token, userId, orgId, userName) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('orgId', orgId);
    localStorage.setItem('userName', userName);
    set({ token, userId, orgId, userName, isAuthenticated: true });
  },
  logout: () => {
    // Tell backend to revoke the current JWT (jti denylist).
    // Fire-and-forget: even if it fails (offline, server down), we still wipe
    // the local session so the user is logged out client-side.
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('orgId');
    localStorage.removeItem('userName');
    signOut(auth).catch(() => {});
    set({ token: null, userId: null, orgId: null, userName: null, isAuthenticated: false });
  },
  toggleTheme: () => {
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return { theme: next };
    });
  },
  setLayoutMode: (mode) => {
    localStorage.setItem('shell.layoutMode', mode);
    document.documentElement.setAttribute('data-layout', mode);
    set({ layoutMode: mode });
  },
}));
