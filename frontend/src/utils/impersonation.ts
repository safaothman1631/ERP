/**
 * Impersonation token helpers (G2 / R2.3).
 *
 * Token storage: sessionStorage (per ADR-G-05). Lives only for the tab and
 * is wiped on close, so a forgotten browser session can't be hijacked.
 *
 * The decoded payload exposes:
 *   - tenant_id   — the tenant being impersonated
 *   - audit_id    — server-side audit doc id
 *   - act.sub     — the impersonator's original user id
 *   - exp         — token expiry (seconds since epoch)
 *   - read_only   — always true for impersonation tokens
 */

const STORAGE_KEY = 'imp_token';
const AUDIT_KEY = 'imp_audit_id';
const TENANT_KEY = 'imp_tenant_id';
const EXP_KEY = 'imp_exp';

export interface ImpersonationClaims {
  sub: string;
  act?: { sub: string };
  tenant_id?: string;
  org_id?: string;
  audit_id?: string;
  impersonation?: boolean;
  read_only?: boolean;
  exp?: number;
}

/** Best-effort JWT payload decoder. Never throws — returns null on failure. */
export function decodeJwt<T = ImpersonationClaims>(token: string): T | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

export function storeImpersonationToken(
  token: string,
  meta: { audit_id: string; tenant_id: string; expires_at?: string | number },
): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
    sessionStorage.setItem(AUDIT_KEY, meta.audit_id);
    sessionStorage.setItem(TENANT_KEY, meta.tenant_id);
    if (meta.expires_at) {
      const exp =
        typeof meta.expires_at === 'string'
          ? Date.parse(meta.expires_at)
          : meta.expires_at * 1000;
      if (!Number.isNaN(exp)) sessionStorage.setItem(EXP_KEY, String(exp));
    }
  } catch {
    // Storage may be disabled in private mode; we silently skip.
  }
}

export function getImpersonationToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getImpersonationMeta(): {
  audit_id: string | null;
  tenant_id: string | null;
  expires_at_ms: number | null;
} {
  try {
    return {
      audit_id: sessionStorage.getItem(AUDIT_KEY),
      tenant_id: sessionStorage.getItem(TENANT_KEY),
      expires_at_ms: sessionStorage.getItem(EXP_KEY)
        ? Number(sessionStorage.getItem(EXP_KEY))
        : null,
    };
  } catch {
    return { audit_id: null, tenant_id: null, expires_at_ms: null };
  }
}

export function clearImpersonationToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(AUDIT_KEY);
    sessionStorage.removeItem(TENANT_KEY);
    sessionStorage.removeItem(EXP_KEY);
  } catch {
    /* noop */
  }
}

export function isImpersonationExpired(now: number = Date.now()): boolean {
  const { expires_at_ms } = getImpersonationMeta();
  if (!expires_at_ms) return false;
  return now >= expires_at_ms;
}

export function secondsRemaining(now: number = Date.now()): number {
  const { expires_at_ms } = getImpersonationMeta();
  if (!expires_at_ms) return 0;
  return Math.max(0, Math.floor((expires_at_ms - now) / 1000));
}

export function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
