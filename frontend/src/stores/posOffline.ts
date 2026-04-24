import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// IndexedDB storage for offline queue
const indexedDBStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const request = indexedDB.open('zoho-pos-db', 1);
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('pos-offline')) {
          db.createObjectStore('pos-offline');
        }
      };
      
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const transaction = db.transaction(['pos-offline'], 'readonly');
        const store = transaction.objectStore('pos-offline');
        const getRequest = store.get(name);
        
        getRequest.onsuccess = () => {
          resolve(getRequest.result || null);
        };
        
        getRequest.onerror = () => {
          resolve(null);
        };
      };
      
      request.onerror = () => {
        resolve(null);
      };
    });
  },
  
  setItem: async (name: string, value: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('zoho-pos-db', 1);
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('pos-offline')) {
          db.createObjectStore('pos-offline');
        }
      };
      
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const transaction = db.transaction(['pos-offline'], 'readwrite');
        const store = transaction.objectStore('pos-offline');
        const putRequest = store.put(value, name);
        
        putRequest.onsuccess = () => {
          resolve();
        };
        
        putRequest.onerror = () => {
          reject(putRequest.error);
        };
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  },
  
  removeItem: async (name: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('zoho-pos-db', 1);
      
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const transaction = db.transaction(['pos-offline'], 'readwrite');
        const store = transaction.objectStore('pos-offline');
        const deleteRequest = store.delete(name);
        
        deleteRequest.onsuccess = () => {
          resolve();
        };
        
        deleteRequest.onerror = () => {
          reject(deleteRequest.error);
        };
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
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
