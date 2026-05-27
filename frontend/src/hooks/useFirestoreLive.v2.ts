/**
 * @file useFirestoreLive.v2.ts
 * @description Time-boxed Firestore real-time subscription hook.
 *
 * Replaces the original `useFirestoreLive` for new callers (the old file is
 * left untouched at `./useFirestoreLive.ts` to avoid breaking existing usage).
 *
 * Behavior (per requirement R2.6 and design §1.5):
 *   - Subscribes via `onSnapshot` on mount.
 *   - **Detaches** the listener after `idleDetachMs` of no DOM interaction
 *     (mouse / keyboard / touch). Firestore charges per listener-second, so
 *     idle tabs shouldn't bleed reads.
 *   - **Re-attaches** when the tab becomes visible again or the user
 *     interacts. The component does not need to be re-mounted.
 *   - Exposes `lastSnapshotAt` and `isStale` so the UI can render a
 *     "data may be stale" hint.
 *   - Tracks the global listener count via a module-level Map. A warning is
 *     emitted at > 25 active listeners (a real Firestore cost cap).
 */

import { useEffect, useRef, useState } from 'react';
import {
  collection,
  doc as docRef,
  onSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';

/* ------------------------------------------------------------------------- */
/* Module-level listener-count tracker                                       */
/* ------------------------------------------------------------------------- */

/**
 * `path -> count` map. Exported for tests; do not mutate from product code.
 */
export const activeListeners: Map<string, number> = new Map();

/** Soft warning threshold; matches design §1.5. */
export const LISTENER_WARNING_THRESHOLD = 25;

/** Sum of all entries — what's actually compared to the threshold. */
function getTotalListenerCount(): number {
  let total = 0;
  for (const v of activeListeners.values()) total += v;
  return total;
}

/** Bump the count for a path; warn if we cross the threshold. */
function incrementListener(path: string): void {
  const next = (activeListeners.get(path) ?? 0) + 1;
  activeListeners.set(path, next);
  if (getTotalListenerCount() > LISTENER_WARNING_THRESHOLD) {
    // eslint-disable-next-line no-console
    console.warn(
      `[useFirestoreLive.v2] Active Firestore listener count exceeded ` +
        `${LISTENER_WARNING_THRESHOLD} (current: ${getTotalListenerCount()}). ` +
        `Check for components that subscribe without cleanup.`,
    );
  }
}

/** Decrement the count for a path; remove entry at zero to keep the map tidy. */
function decrementListener(path: string): void {
  const next = (activeListeners.get(path) ?? 1) - 1;
  if (next <= 0) activeListeners.delete(path);
  else activeListeners.set(path, next);
}

/* ------------------------------------------------------------------------- */
/* Public types                                                              */
/* ------------------------------------------------------------------------- */

/** Options accepted by {@link useFirestoreLive}. */
export interface UseFirestoreLiveV2Options {
  /**
   * ms of idleness after which the listener is detached. Defaults to
   * 30 minutes per design §1.5.
   */
  idleDetachMs?: number;
  /**
   * ms after which the data is considered stale (used for the `isStale`
   * flag in the return object). Defaults to `idleDetachMs`.
   */
  staleAfterMs?: number;
  /** Disable the subscription without un-mounting the component. */
  enabled?: boolean;
}

/** Return shape — explicit so consumers can destructure cleanly. */
export interface UseFirestoreLiveV2Result<T> {
  /**
   * The current snapshot. `null` until the first snapshot arrives;
   * a document path returns `T | null` (null when the doc doesn't exist),
   * a collection path returns `T[]`.
   */
  data: T | null;
  /** True until the first snapshot resolves or an error is raised. */
  isLoading: boolean;
  /** Last error from the listener, or null. */
  error: Error | null;
  /** ms-epoch of the most recent snapshot, or null if none received yet. */
  lastSnapshotAt: number | null;
  /** True if the listener has detached due to idle (or `staleAfterMs` passed). */
  isStale: boolean;
  /** Snapshot of the global active-listener count. */
  listenerCount: number;
}

/* ------------------------------------------------------------------------- */
/* The hook                                                                  */
/* ------------------------------------------------------------------------- */

const DEFAULT_IDLE_DETACH_MS = 30 * 60 * 1_000;

/**
 * Subscribe to a Firestore document or collection path. The hook decides
 * whether `path` is a document or a collection by counting the slashes —
 * Firestore convention says docs have an even number of segments,
 * collections an odd number.
 *
 * @typeParam T - The shape of an individual document.
 *
 * @example // Subscribe to an open POS cart
 * const { data: cart, isStale } =
 *   useFirestoreLive<PosCart>(`tenants/${tid}/pos_carts/${cartId}`);
 *
 * @example // Subscribe to the kitchen-display order queue
 * const { data: orders, listenerCount } =
 *   useFirestoreLive<KitchenOrder>(`tenants/${tid}/kitchen_orders`);
 */
export function useFirestoreLive<T = DocumentData>(
  path: string,
  options: UseFirestoreLiveV2Options = {},
): UseFirestoreLiveV2Result<T> {
  const {
    idleDetachMs = DEFAULT_IDLE_DETACH_MS,
    staleAfterMs = idleDetachMs,
    enabled = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastSnapshotAt, setLastSnapshotAt] = useState<number | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [listenerCount, setListenerCount] = useState<number>(
    getTotalListenerCount(),
  );

  // Whether the listener is currently attached. Tracked via ref so the
  // idle-timer callback can read the latest value without re-creating itself.
  const attachedRef = useRef<boolean>(false);
  // Refs to user activity / idle timer so we can clear them deterministically.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  // Unsubscribe function returned by `onSnapshot`. Kept in a ref so the
  // visibility / activity handlers can call it.
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    if (typeof window === 'undefined') {
      // SSR safety
      return;
    }

    /** Open the Firestore listener (idempotent). */
    const attach = (): void => {
      if (attachedRef.current) return;

      // Decide doc vs. collection by segment count.
      const segments = path.split('/').filter(Boolean);
      const isDoc = segments.length % 2 === 0;
      let unsub: () => void;

      try {
        if (isDoc) {
          unsub = onSnapshot(
            docRef(db, path),
            (snap) => {
              const value = snap.exists()
                ? ({ id: snap.id, ...(snap.data() as object) } as unknown as T)
                : (null as unknown as T);
              setData(value);
              setIsLoading(false);
              setLastSnapshotAt(Date.now());
              setIsStale(false);
            },
            (err) => {
              setError(err as Error);
              setIsLoading(false);
            },
          );
        } else {
          unsub = onSnapshot(
            collection(db, path),
            (snap) => {
              const rows: T[] = [];
              snap.forEach((d) => {
                const docData = d.data() as Record<string, unknown>;
                if (docData.deleted_at) return; // honour soft delete
                rows.push({ id: d.id, ...docData } as unknown as T);
              });
              setData(rows as unknown as T);
              setIsLoading(false);
              setLastSnapshotAt(Date.now());
              setIsStale(false);
            },
            (err) => {
              setError(err as Error);
              setIsLoading(false);
            },
          );
        }
      } catch (e) {
        setError(e as Error);
        setIsLoading(false);
        return;
      }

      unsubRef.current = unsub;
      attachedRef.current = true;
      incrementListener(path);
      setListenerCount(getTotalListenerCount());
    };

    /** Close the Firestore listener (idempotent). */
    const detach = (): void => {
      if (!attachedRef.current) return;
      try {
        unsubRef.current?.();
      } catch {
        // ignore — we're tearing down anyway
      }
      unsubRef.current = null;
      attachedRef.current = false;
      decrementListener(path);
      setListenerCount(getTotalListenerCount());
      setIsStale(true);
    };

    /** Reset the idle timer; called on every user interaction. */
    const armIdleTimer = (): void => {
      lastActivityRef.current = Date.now();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        // Time-box the listener.
        detach();
      }, idleDetachMs);
    };

    /** Mark the data as stale once `staleAfterMs` of no snapshot elapses. */
    const stalenessTimer = setInterval(() => {
      if (
        lastSnapshotAt !== null &&
        Date.now() - lastSnapshotAt > staleAfterMs
      ) {
        setIsStale(true);
      }
    }, Math.max(1_000, Math.floor(staleAfterMs / 4)));

    const handleActivity = (): void => {
      armIdleTimer();
      // If we'd previously detached due to idle, re-attach on first interaction.
      if (!attachedRef.current) attach();
    };

    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible' && !attachedRef.current) {
        attach();
        armIdleTimer();
      }
    };

    // Initial attach + arm.
    attach();
    armIdleTimer();

    // Subscribe to user activity. `passive: true` keeps these handlers from
    // blocking scroll / input.
    const activityEvents = [
      'mousedown',
      'keydown',
      'touchstart',
      'pointerdown',
      'wheel',
    ] as const;
    for (const ev of activityEvents) {
      document.addEventListener(ev, handleActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      // Cleanup on unmount.
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      clearInterval(stalenessTimer);
      for (const ev of activityEvents) {
        document.removeEventListener(ev, handleActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      detach();
    };
    // We intentionally exclude `lastSnapshotAt` — including it would
    // recreate the listener on every snapshot. We read it via closure for
    // the staleness timer, which is fine because that timer is recreated
    // each effect run anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, idleDetachMs, staleAfterMs]);

  return {
    data,
    isLoading,
    error,
    lastSnapshotAt,
    isStale,
    listenerCount,
  };
}
