/**
 * Shared POS IndexedDB wrapper.
 *
 * One connection per browser tab — never open a fresh connection in store
 * code. Import `getPOSDB()` and reuse the returned promise.
 *
 * Schema is versioned through `POS_DB_VERSION` in `./schema.ts`.
 *
 * On first open of v4 we attempt a best-effort migration from the legacy
 * `zoho-pos-db` (v1) database that the old Zustand persistence layer used.
 * The migration is purely additive — it copies rows it understands into the
 * new stores and then leaves the old DB intact so a rollback is always
 * possible. Any unknown / corrupt rows are skipped, never thrown.
 */
import { openDB, type IDBPDatabase } from 'idb';
import {
  POS_DB_NAME,
  POS_DB_VERSION,
  type CartRow,
  type CartLineRow,
  type OfflineQueueRow,
  type ZohoPOSSchema,
} from './schema';
import { upgradeLine } from './upgradeLine';

const LEGACY_DB_NAME = 'zoho-pos-db';
const LEGACY_CART_STORE = 'pos-cart';
const LEGACY_OFFLINE_STORE = 'pos-offline';

let dbPromise: Promise<IDBPDatabase<ZohoPOSSchema>> | null = null;
let migrationAttempted = false;

/** Detect a browser-like environment with IndexedDB. */
function hasIDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Returns the memoized POS DB promise. Safe to call from anywhere; the
 * underlying `openDB` call is made at most once per tab.
 */
export function getPOSDB(): Promise<IDBPDatabase<ZohoPOSSchema>> {
  if (!hasIDB()) {
    return Promise.reject(new Error('IndexedDB unavailable in this environment'));
  }
  if (!dbPromise) {
    dbPromise = openDB<ZohoPOSSchema>(POS_DB_NAME, POS_DB_VERSION, {
      upgrade(db, oldVersion) {
        // Cumulative migrations — `oldVersion` is 0 for first-time installs.
        if (oldVersion < 1) {
          db.createObjectStore('carts', { keyPath: 'cartId' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('sessions', { keyPath: 'sessionId' });
        }
        if (oldVersion < 3) {
          db.createObjectStore('floors', { keyPath: 'floorId' });
        }
        if (oldVersion < 4) {
          const queueStore = db.createObjectStore('offline-queue', {
            keyPath: 'id',
            autoIncrement: true,
          });
          queueStore.createIndex('by-status', 'status');
        }
      },
      blocked() {
        // Another tab is holding the old version open. Surface this so the
        // app can show a "reload to update" banner. Logging is enough today.
         
        console.warn('[pos/db] upgrade blocked by another tab');
      },
      blocking() {
        // We're holding an old version open while a newer tab wants to upgrade.
        // Close so the other tab can proceed.
        void (async () => {
          try {
            const db = await dbPromise;
            db?.close();
          } finally {
            dbPromise = null;
          }
        })();
      },
      terminated() {
        // Driver kicked us out (storage cleared, quota, etc.). Reset the
        // memoized promise so the next call opens fresh.
        dbPromise = null;
      },
    }).then(async (db) => {
      if (!migrationAttempted) {
        migrationAttempted = true;
        try {
          await migrateFromLegacy(db);
        } catch (err) {
          // Migration must never break boot. Just log and move on.
           
          console.warn('[pos/db] legacy migration skipped', err);
        }
      }
      return db;
    });
  }
  return dbPromise;
}

/** Closes the DB (test helper). */
export async function closePOSDB(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } finally {
      dbPromise = null;
    }
  }
}

/** Test helper — resets memoized promise without closing real DB. */
export function _resetPOSDBForTests(): void {
  dbPromise = null;
  migrationAttempted = false;
}

// ---------------------------------------------------------------------------
// Legacy migration
// ---------------------------------------------------------------------------

interface LegacyZustandWrapper {
  state?: unknown;
  version?: number;
}

interface LegacyCartLine {
  id: string;
  item_id: string;
  item_name: string;
  sku?: string;
  qty: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  note?: string;
  course?: string;
}

interface LegacyCartState {
  orderId?: string | null;
  sessionId?: string | null;
  lines?: LegacyCartLine[];
  customer?: unknown;
  table?: unknown;
  pricelistId?: string | null;
  presetId?: string | null;
  discountTotal?: number;
  notes?: string;
}

interface LegacyOfflineOrder {
  temp_id: string;
  payload: unknown;
  queued_at: string;
}

interface LegacyOfflineState {
  syncQueue?: LegacyOfflineOrder[];
}

async function openLegacyDB(): Promise<IDBDatabase | null> {
  if (!hasIDB()) return null;
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let openReq: IDBOpenDBRequest;
    try {
      openReq = indexedDB.open(LEGACY_DB_NAME);
    } catch {
      resolve(null);
      return;
    }
    // Some browsers leave the request pending forever if no DB exists yet —
    // bail out after 2s so boot stays fast.
    timer = setTimeout(() => resolve(null), 2_000);
    openReq.onsuccess = () => {
      if (timer) clearTimeout(timer);
      resolve(openReq.result);
    };
    openReq.onerror = () => {
      if (timer) clearTimeout(timer);
      resolve(null);
    };
    openReq.onblocked = () => {
      if (timer) clearTimeout(timer);
      resolve(null);
    };
    openReq.onupgradeneeded = () => {
      // We must NOT create new stores in the legacy DB during read.
      // If the DB doesn't exist, the upgrade fires with empty version;
      // abort by closing so we never write to a non-existent legacy DB.
      try {
        openReq.transaction?.abort();
      } catch {
        /* noop */
      }
      if (timer) clearTimeout(timer);
      resolve(null);
    };
  });
}

function legacyGetItem(db: IDBDatabase, storeName: string, key: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve(null);
      return;
    }
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => {
        const result = req.result;
        if (typeof result === 'string') resolve(result);
        else if (result == null) resolve(null);
        else resolve(JSON.stringify(result));
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Copies any usable data from the v1 legacy DB into the new v4 stores. Pure
 * best-effort; idempotent; never throws.
 */
async function migrateFromLegacy(db: IDBPDatabase<ZohoPOSSchema>): Promise<void> {
  const legacyDB = await openLegacyDB();
  if (!legacyDB) return;
  try {
    const now = Date.now();
    const deviceId = getDeviceId();

    // ---- cart ----
    const cartRaw = await legacyGetItem(legacyDB, LEGACY_CART_STORE, 'pos-cart');
    if (cartRaw) {
      const parsed = safeJSON<LegacyZustandWrapper>(cartRaw);
      const legacy = (parsed?.state ?? {}) as LegacyCartState;
      if (Array.isArray(legacy.lines) && legacy.lines.length > 0) {
        const cartId = (legacy.orderId as string | null) ?? `legacy-${now}`;
        const lines: Record<string, CartLineRow> = {};
        for (const l of legacy.lines) {
          if (!l || typeof l !== 'object') continue;
          // upgradeLine() tolerates snake_case legacy field names and
          // synthesises lineId / qtyUpdatedAt / qtyUpdatedBy when they
          // are missing — so existing carts survive the v3 → v4 jump
          // without losing the CRDT metadata `merge.ts` requires.
          const line = upgradeLine(l, deviceId, now);
          if (!line.lineId) continue;
          lines[line.lineId] = line;
        }
        const cart: CartRow = {
          cartId,
          sessionId: legacy.sessionId ?? null,
          lines,
          customer: legacy.customer ?? null,
          table: legacy.table ?? null,
          pricelistId: legacy.pricelistId ?? null,
          presetId: legacy.presetId ?? null,
          discountTotal: Number(legacy.discountTotal) || 0,
          notes: typeof legacy.notes === 'string' ? legacy.notes : '',
          updatedAt: now,
          updatedBy: deviceId,
        };
        // Only write if no cart with this id yet, to keep migration idempotent
        const existing = await db.get('carts', cart.cartId);
        if (!existing) {
          await db.put('carts', cart);
        }
      }
    }

    // ---- offline queue ----
    const offlineRaw = await legacyGetItem(legacyDB, LEGACY_OFFLINE_STORE, 'pos-offline');
    if (offlineRaw) {
      const parsed = safeJSON<LegacyZustandWrapper>(offlineRaw);
      const legacy = (parsed?.state ?? {}) as LegacyOfflineState;
      if (Array.isArray(legacy.syncQueue) && legacy.syncQueue.length > 0) {
        // Only seed the queue when it's empty, otherwise we risk dupes.
        const existing = await db.getAll('offline-queue');
        if (existing.length === 0) {
          for (const order of legacy.syncQueue) {
            const row: OfflineQueueRow = {
              url: '/api/pos/orders/sync',
              method: 'POST',
              body: { temp_id: order.temp_id, ...(order.payload as object) },
              headers: { 'content-type': 'application/json' },
              attempts: 0,
              status: 'pending',
              createdAt: order.queued_at ? Date.parse(order.queued_at) || now : now,
            };
            await db.add('offline-queue', row);
          }
        }
      }
    }
  } finally {
    legacyDB.close();
  }
}

function safeJSON<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Device id (used for CRDT tiebreak)
// ---------------------------------------------------------------------------

const DEVICE_ID_KEY = 'pos:device-id';
let cachedDeviceId: string | null = null;

/** Stable per-browser id; created lazily. */
export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  if (typeof localStorage === 'undefined') {
    cachedDeviceId = `ephemeral-${Math.random().toString(36).slice(2)}`;
    return cachedDeviceId;
  }
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    cachedDeviceId = existing;
    return existing;
  }
  const fresh =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(DEVICE_ID_KEY, fresh);
  cachedDeviceId = fresh;
  return fresh;
}
