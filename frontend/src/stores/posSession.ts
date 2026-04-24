import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Employee {
  id: string;
  name: string;
  name_ku?: string;
  role: string;
}

interface POSSessionStore {
  employeeToken: string | null;
  employee: Employee | null;
  tokenExpiry: string | null;
  
  setEmployee: (employee: Employee, token: string, expiresAt: string) => void;
  clearEmployee: () => void;
  isTokenValid: () => boolean;
}

export const usePOSSessionStore = create<POSSessionStore>()(
  persist(
    (set, get) => ({
      employeeToken: null,
      employee: null,
      tokenExpiry: null,

      setEmployee: (employee, token, expiresAt) => {
        set({
          employee,
          employeeToken: token,
          tokenExpiry: expiresAt,
        });
      },

      clearEmployee: () => {
        set({
          employee: null,
          employeeToken: null,
          tokenExpiry: null,
        });
      },

      isTokenValid: () => {
        const { tokenExpiry } = get();
        if (!tokenExpiry) return false;
        return new Date(tokenExpiry) > new Date();
      },
    }),
    {
      name: 'pos-session-storage',
    }
  )
);
