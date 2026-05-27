import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getPOSDB } from './pos/db';

/**
 * Zustand-persisted session blob lives in the dedicated `sessions` IDB
 * store using the persistence `name` as the row id. This replaces the
 * previous `zustand` default (`localStorage`) which would be lost when the
 * browser cleared site data.
 */
const indexedDBStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const db = await getPOSDB();
      const row = await db.get('sessions', name);
      if (!row) return null;
      // The persisted blob is stored as the JSON-stringified employee
      // object in the `employee` field. We round-trip via JSON to satisfy
      // Zustand's expectation of a string return.
      const wrapper = {
        state: {
          employeeToken: row.employeeToken,
          employee: row.employee,
          tokenExpiry: row.tokenExpiry,
        },
        version: 0,
      };
      return JSON.stringify(wrapper);
    } catch {
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const db = await getPOSDB();
      let parsed: { state?: Partial<POSSessionStore> } = {};
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = {};
      }
      const state = parsed.state ?? {};
      await db.put('sessions', {
        sessionId: name,
        employeeToken: (state.employeeToken as string | null) ?? null,
        employee: state.employee ?? null,
        tokenExpiry: (state.tokenExpiry as string | null) ?? null,
        updatedAt: Date.now(),
      });
    } catch {
      /* noop */
    }
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      const db = await getPOSDB();
      await db.delete('sessions', name);
    } catch {
      /* noop */
    }
  },
};

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
      storage: createJSONStorage(() => indexedDBStorage),
    }
  )
);
