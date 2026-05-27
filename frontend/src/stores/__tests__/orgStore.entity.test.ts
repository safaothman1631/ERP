import { describe, it, expect, beforeEach } from 'vitest';
import { useOrgStore } from '../orgStore';

describe('orgStore — company context', () => {
  beforeEach(() => {
    useOrgStore.setState({
      currentOrg: null,
      currentBranch: null,
      currentCompany: null,
    });
  });

  it('setCurrentCompany stores the active company', () => {
    const company = { id: 'co-1', name: 'Subsidiary A', code: 'SUB-A' };
    useOrgStore.getState().setCurrentCompany(company);
    expect(useOrgStore.getState().currentCompany).toEqual(company);
  });

  it('setCurrentOrg clears currentCompany', () => {
    useOrgStore.getState().setCurrentCompany({ id: 'co-1', name: 'HQ' });
    useOrgStore.getState().setCurrentOrg({ id: 'org-1', name: 'Acme' });
    expect(useOrgStore.getState().currentCompany).toBeNull();
  });
});
