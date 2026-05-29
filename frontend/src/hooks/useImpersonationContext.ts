/**
 * useImpersonationContext — read JWT + sessionStorage and return the
 * current impersonation state (G2 / R2.3).
 *
 * Re-evaluates every second so the countdown stays current. Components
 * should still call `endImpersonation()` (provided here) to trigger the
 * backend revocation rather than just clearing storage.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import {
  clearImpersonationToken,
  decodeJwt,
  getImpersonationMeta,
  getImpersonationToken,
  isImpersonationExpired,
  secondsRemaining,
  type ImpersonationClaims,
} from '../utils/impersonation';

export interface ImpersonationContext {
  isImpersonating: boolean;
  tenantId: string | null;
  auditId: string | null;
  impersonatorId: string | null;
  secondsLeft: number;
  isExpired: boolean;
  endImpersonation: () => Promise<void>;
}

export function useImpersonationContext(): ImpersonationContext {
  const [tick, setTick] = useState<number>(0);

  // Re-tick once a second so the countdown re-renders.
  useEffect(() => {
    if (!getImpersonationToken()) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const token = getImpersonationToken();
  const claims: ImpersonationClaims | null = token ? decodeJwt(token) : null;
  const meta = getImpersonationMeta();
  const isImpersonating = !!(token && claims?.impersonation);

  const endImpersonation = useCallback(async () => {
    const audit_id = meta.audit_id || claims?.audit_id || null;
    try {
      await api.post('/api/admin/impersonate/end', { audit_id });
    } catch (e) {
      // Even if the backend call fails (token already expired, network
      // hiccup), wipe local storage so the UI doesn't loop.
      // eslint-disable-next-line no-console
      console.warn('impersonation.end_failed', e);
    } finally {
      clearImpersonationToken();
      // Force a full page reload so any cached app state is flushed.
      window.location.assign('/admin');
    }
    // tick is referenced to silence linter; safe no-op
    void tick;
  }, [claims?.audit_id, meta.audit_id, tick]);

  return {
    isImpersonating,
    tenantId: meta.tenant_id || claims?.tenant_id || claims?.org_id || null,
    auditId: meta.audit_id || claims?.audit_id || null,
    impersonatorId: claims?.act?.sub ?? null,
    secondsLeft: secondsRemaining(),
    isExpired: isImpersonationExpired(),
    endImpersonation,
  };
}
