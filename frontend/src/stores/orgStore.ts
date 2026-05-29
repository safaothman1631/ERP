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

export interface Company {
  id: string;
  name: string;
  code?: string;
  is_primary?: boolean;
}

interface OrgState {
  /** Currently selected organisation */
  currentOrg: Org | null;
  /** Currently selected branch within the org */
  currentBranch: Branch | null;
  /** Currently selected legal entity (company) within the org */
  currentCompany: Company | null;

  // Actions
  setCurrentOrg: (org: Org | null) => void;
  setCurrentBranch: (branch: Branch | null) => void;
  setCurrentCompany: (company: Company | null) => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      currentOrg: null,
      currentBranch: null,
      currentCompany: null,

      setCurrentOrg: (org) =>
        set({ currentOrg: org, currentBranch: null, currentCompany: null }),
      setCurrentBranch: (branch) => set({ currentBranch: branch }),
      setCurrentCompany: (company) => set({ currentCompany: company }),
    }),
    {
      name: 'org.store.v1',
      partialize: (s) => ({
        currentOrg: s.currentOrg,
        currentBranch: s.currentBranch,
        currentCompany: s.currentCompany,
      }),
    }
  )
);
