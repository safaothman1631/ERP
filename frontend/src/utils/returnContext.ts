/**
 * returnContext — Class C navigate-with-return-token helper.
 *
 * For complex entities where quick-create modal/drawer is not enough,
 * we navigate to the full create page and remember the surface to return to.
 *
 * Pattern (per design.md §3.3):
 *   const token = saveReturnContext({ surface: 'ticket-form/assigned-to', state: {...} })
 *   navigate(`/hr/employees?returnTo=${token}&autoOpen=1`)
 *
 * Destination page on save:
 *   const ctx = restoreReturnContext(token)
 *   if (ctx) { navigate(ctx.surface, { state: { ...ctx.state, newRecordId } }) }
 *   clearReturnContext(token)
 *
 * State is stored in sessionStorage keyed by the token; auto-expires after 1 hour.
 *
 * @see _deltas/EP-5-summary.md
 */

const STORAGE_PREFIX = 'zoho:returnContext:';
const EXPIRY_MS = 3600 * 1000; // 1 hour

export interface ReturnContextPayload {
  /** Logical surface identifier — usually `route#anchor` or `route/field` */
  surface: string;
  /** Arbitrary state for the source surface (form values, selection, etc.) */
  state: unknown;
}

interface StoredContext extends ReturnContextPayload {
  expiresAt: number;
}

/** ULID-ish ID: timestamp prefix + random hex. */
function generateToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

/**
 * Persist a return-context payload to sessionStorage and return a token.
 * The token is appended to the URL as `?returnTo=<token>`.
 */
export function saveReturnContext(payload: ReturnContextPayload): string {
  const token = generateToken();
  const stored: StoredContext = {
    ...payload,
    expiresAt: Date.now() + EXPIRY_MS,
  };
  try {
    sessionStorage.setItem(STORAGE_PREFIX + token, JSON.stringify(stored));
  } catch {
    /* sessionStorage may be full or disabled — caller can fall back to a no-token nav */
  }
  return token;
}

/**
 * Read a stored return-context. Returns null if missing or expired.
 * Does not clear the entry — call `clearReturnContext` after consuming.
 */
export function restoreReturnContext(token: string): ReturnContextPayload | null {
  if (!token) return null;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(STORAGE_PREFIX + token);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredContext;
    if (!parsed || typeof parsed.expiresAt !== 'number') return null;
    if (parsed.expiresAt < Date.now()) {
      clearReturnContext(token);
      return null;
    }
    return { surface: parsed.surface, state: parsed.state };
  } catch {
    return null;
  }
}

/** Remove a stored return-context entry. Idempotent. */
export function clearReturnContext(token: string): void {
  if (!token) return;
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + token);
  } catch {
    /* ignore */
  }
}

/** Convenience: pull the `returnTo` token from a URLSearchParams. */
export function readReturnToken(search: URLSearchParams | string): string | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  return params.get('returnTo');
}

/**
 * Walk every persisted return-context entry and drop the expired ones.
 * Safe to invoke on app boot or as a periodic sweep.
 */
export function purgeExpiredReturnContexts(): void {
  let storage: Storage | null = null;
  try {
    storage = typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return;
  }
  if (!storage) return;
  try {
    const now = Date.now();
    const toRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as StoredContext;
        if (!parsed || typeof parsed.expiresAt !== 'number' || parsed.expiresAt < now) {
          toRemove.push(key);
        }
      } catch {
        toRemove.push(key);
      }
    }
    toRemove.forEach((key) => storage!.removeItem(key));
  } catch {
    /* swallow */
  }
}
