import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Org {
  id: string;
  name: string;
  logoUrl?: string;
  currency?: 'IQD' | 'USD';
  /** Enabled module keys, e.g. ['sales', 'inventory', 'hr'] */
  enabledModules?: string[];
}

export interface Branch {
  id: string;
  name: string;
  orgId: string;
  address?: string;
}

interface OrgState {
  /** Currently selected organisation */
  currentOrg: Org | null;
  /** Currently selected branch within the org */
  currentBranch: Branch | null;

  // Actions
  setCurrentOrg: (org: Org | null) => void;
  setCurrentBranch: (branch: Branch | null) => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      currentOrg: null,
      currentBranch: null,

      setCurrentOrg: (org) => set({ currentOrg: org, currentBranch: null }),
      setCurrentBranch: (branch) => set({ currentBranch: branch }),
    }),
    {
      name: 'org.store.v1',
      partialize: (s) => ({
        currentOrg: s.currentOrg,
        currentBranch: s.currentBranch,
      }),
    }
  )
);
