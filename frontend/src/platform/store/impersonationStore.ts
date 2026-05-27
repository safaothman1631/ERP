import { create } from 'zustand';

interface SavedSession {
  token: string;
  userId: string;
  orgId: string;
  userName: string;
  userRole: string | null;
}

interface ImpersonationState {
  adminSession: SavedSession | null;
  saveAdminSession: (session: SavedSession) => void;
  clearAdminSession: () => void;
}

const STORAGE_KEY = 'platform.adminSession';

function loadSaved(): SavedSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as SavedSession : null;
  } catch {
    return null;
  }
}

export const useImpersonationStore = create<ImpersonationState>((set) => ({
  adminSession: loadSaved(),
  saveAdminSession: (session) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    set({ adminSession: session });
  },
  clearAdminSession: () => {
    sessionStorage.removeItem(STORAGE_KEY);
    set({ adminSession: null });
  },
}));
