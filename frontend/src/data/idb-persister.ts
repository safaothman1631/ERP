/**
 * @file idb-persister.ts
 * @description IndexedDB-backed persister for TanStack Query's
 * `persistQueryClient`. Implements the design in `design.md` §1.4.
 *
 * Storage layout
 * --------------
 * - Database name:    caller-supplied (default `'zoho-rq-cache'`)
 * - Object store:     `cache`
 * - Document key:     `'react-query-cache'`
 * - Value:            JSON-serializable `PersistedClient`
 *
 * A monotonically-increasing schema version lets us blow away the store on
 * shape changes without surprising the caller.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient
 */

import { openDB, type IDBPDatabase } from 'idb';
import type {
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client';

/* ------------------------------------------------------------------------- */
/* Constants                                                                 */
/* ------------------------------------------------------------------------- */

/** Bumping this drops the existing store (and all persisted cache). */
export const IDB_PERSISTER_VERSION = 1;

/** Hard-coded object store name; one persister per database. */
const STORE_NAME = 'cache';

/** Hard-coded document key inside the store. */
const CACHE_KEY = 'react-query-cache';

/* ------------------------------------------------------------------------- */
/* Schema definition                                                         */
/* ------------------------------------------------------------------------- */

/**
 * Minimal `idb` schema description. Kept loose intentionally — the persister
 * only ever stores one document under one key.
 */
interface PersisterSchema {
  [STORE_NAME]: {
    key: string;
    value: string; // JSON-encoded PersistedClient
  };
}

/* ------------------------------------------------------------------------- */
/* Persister factory                                                         */
/* ------------------------------------------------------------------------- */

/**
 * Build a {@link Persister} backed by IndexedDB. Safe to call once at module
 * scope; the database is opened lazily on first use.
 *
 * @param dbName Database name; defaults to `'zoho-rq-cache'`.
 *
 * @example
 * import { persistQueryClient } from '@tanstack/react-query-persist-client';
 * import { createIDBPersister } from './idb-persister';
 *
 * persistQueryClient({
 *   queryClient,
 *   persister: createIDBPersister(),
 *   maxAge: 24 * 60 * 60 * 1000,
 * });
 */
export function createIDBPersister(
  dbName = 'zoho-rq-cache',
): Persister {
  let dbPromise: Promise<IDBPDatabase<PersisterSchema>> | null = null;

  /** Open (or reuse) the IDB connection, creating the store on first run. */
  const getDB = (): Promise<IDBPDatabase<PersisterSchema>> => {
    // Some environments (Node tests, SSR) lack `indexedDB`. The persister
    // becomes a no-op in those cases rather than throwing.
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('indexedDB is not available'));
    }
    if (!dbPromise) {
      dbPromise = openDB<PersisterSchema>(dbName, IDB_PERSISTER_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        },
        blocked() {
          // Another tab is holding an older version open. Best effort: log it
          // and let the upgrade wait for that tab to close.
          // eslint-disable-next-line no-console
          console.warn(
            `[idb-persister] Upgrade of ${dbName} blocked by another tab.`,
          );
        },
        terminated() {
          // Connection was forcibly closed; clear the cached promise so the
          // next operation reopens.
          dbPromise = null;
        },
      });
    }
    return dbPromise;
  };

  return {
    /**
     * Serialize the in-memory client to JSON and write it under the fixed
     * key. Swallows errors so a quota / disk failure never breaks the app.
     */
    persistClient: async (client: PersistedClient): Promise<void> => {
      try {
        const db = await getDB();
        const json = JSON.stringify(client);
        await db.put(STORE_NAME, json, CACHE_KEY);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[idb-persister] persistClient failed:', err);
      }
    },

    /**
     * Read the JSON document and parse it. Returns `undefined` when nothing
     * was persisted (or the parse fails — corruption shouldn't crash boot).
     */
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const db = await getDB();
        const json = await db.get(STORE_NAME, CACHE_KEY);
        if (!json) return undefined;
        return JSON.parse(json) as PersistedClient;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[idb-persister] restoreClient failed:', err);
        return undefined;
      }
    },

    /** Wipe the persisted document. Called on cache invalidation events. */
    removeClient: async (): Promise<void> => {
      try {
        const db = await getDB();
        await db.delete(STORE_NAME, CACHE_KEY);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[idb-persister] removeClient failed:', err);
      }
    },
  };
}
