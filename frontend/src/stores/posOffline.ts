import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getPOSDB } from './pos/db';

/**
 * Zustand-persisted offline-meta rows piggy-back on the `carts` store with a
 * reserved key prefix (the CRDT helpers ignore it). Heavyweight per-request
 * queue data now lives in `offline-queue` (see `pos/offline-queue.ts`); this
 * store retains only the UI-visible flags and a denormalized in-memory
 * mirror of the queue for read paths that haven't been migrated yet.
 */
const ZUSTAND_KEY_PREFIX = 'zustand:offline:';

const indexedDBStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const db = await getPOSDB();
      const row = await db.get('carts', `${ZUSTAND_KEY_PREFIX}${name}`);
      if (!row || typeof row.notes !== 'string' || row.notes.length === 0) return null;
      return row.notes;
    } catch {
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const db = await getPOSDB();
      await db.put('carts', {
        cartId: `${ZUSTAND_KEY_PREFIX}${name}`,
        sessionId: null,
        lines: {},
        customer: null,
        table: null,
        pricelistId: null,
        presetId: null,
        discountTotal: 0,
        notes: value,
        updatedAt: Date.now(),
        updatedBy: 'zustand-persist',
      });
    } catch {
      /* noop */
    }
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      const db = await getPOSDB();
      await db.delete('carts', `${ZUSTAND_KEY_PREFIX}${name}`);
    } catch {
      /* noop */
    }
  },
};

interface OfflineOrder {
  temp_id: string;
  payload: any;
  queued_at: string;
}

interface POSOfflineState {
  isOnline: boolean;
  syncQueue: OfflineOrder[];
  lastSyncAt: string | null;

  // Actions
  enqueueOrder: (payload: any) => void;
  syncAll: (apiCall: (orders: OfflineOrder[]) => Promise<any>) => Promise<void>;
  setOnline: (online: boolean) => void;
  clearQueue: () => void;
  removeFromQueue: (tempId: string) => void;
}

// Listen to online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    usePOSOfflineStore.getState().setOnline(true);
  });

  window.addEventListener('offline', () => {
    usePOSOfflineStore.getState().setOnline(false);
  });
}

export const usePOSOfflineStore = create<POSOfflineState>()(
  persist(
    (set, get) => ({
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      syncQueue: [],
      lastSyncAt: null,

      enqueueOrder: (payload) => {
        const temp_id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const order: OfflineOrder = {
          temp_id,
          payload,
          queued_at: new Date().toISOString(),
        };

        set((state) => ({
          syncQueue: [...state.syncQueue, order],
        }));
      },

      syncAll: async (apiCall) => {
        const { syncQueue, isOnline } = get();

        if (!isOnline || syncQueue.length === 0) {
          return;
        }

        try {
          // Call the API with all queued orders
          await apiCall(syncQueue);

          // Clear queue on success
          set({
            syncQueue: [],
            lastSyncAt: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Sync failed:', error);
          throw error;
        }
      },

      setOnline: (isOnline) => {
        set({ isOnline });

        // Auto-trigger sync when coming back online
        if (isOnline) {
          const { syncQueue } = get();
          if (syncQueue.length > 0) {
            console.log(`Back online. ${syncQueue.length} orders in queue.`);
          }
        }
      },

      clearQueue: () => set({ syncQueue: [] }),

      removeFromQueue: (tempId) => {
        set((state) => ({
          syncQueue: state.syncQueue.filter((o) => o.temp_id !== tempId),
        }));
      },
    }),
    {
      name: 'pos-offline',
      storage: createJSONStorage(() => indexedDBStorage),
    }
  )
);
