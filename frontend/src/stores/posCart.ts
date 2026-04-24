import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// IndexedDB storage using localforage-like implementation
const indexedDBStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const request = indexedDB.open('zoho-pos-db', 1);
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('pos-cart')) {
          db.createObjectStore('pos-cart');
        }
      };
      
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const transaction = db.transaction(['pos-cart'], 'readonly');
        const store = transaction.objectStore('pos-cart');
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
        if (!db.objectStoreNames.contains('pos-cart')) {
          db.createObjectStore('pos-cart');
        }
      };
      
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const transaction = db.transaction(['pos-cart'], 'readwrite');
        const store = transaction.objectStore('pos-cart');
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
        const transaction = db.transaction(['pos-cart'], 'readwrite');
        const store = transaction.objectStore('pos-cart');
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

interface POSCartLine {
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

interface POSCartState {
  orderId: string | null;
  sessionId: string | null;
  lines: POSCartLine[];
  customer: any | null;
  table: any | null;
  pricelistId: string | null;
  presetId: string | null;
  discountTotal: number;
  notes: string;
  
  // Actions
  setOrder: (orderId: string | null, sessionId: string | null) => void;
  addLine: (line: Omit<POSCartLine, 'id'>) => void;
  updateLine: (id: string, partial: Partial<POSCartLine>) => void;
  removeLine: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  setCustomer: (customer: any | null) => void;
  setTable: (table: any | null) => void;
  setPricelist: (id: string | null) => void;
  setPreset: (id: string | null) => void;
  clearCart: () => void;
  getTotals: () => { subtotal: number; tax: number; total: number; discount: number };
}

export const usePOSCartStore = create<POSCartState>()(
  persist(
    (set, get) => ({
      orderId: null,
      sessionId: null,
      lines: [],
      customer: null,
      table: null,
      pricelistId: null,
      presetId: null,
      discountTotal: 0,
      notes: '',
      
      setOrder: (orderId, sessionId) => set({ orderId, sessionId }),
      
      addLine: (lineData) => {
        const id = `line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const line: POSCartLine = { id, ...lineData };
        set((state) => ({ lines: [...state.lines, line] }));
      },
      
      updateLine: (id, partial) => {
        set((state) => ({
          lines: state.lines.map((line) =>
            line.id === id ? { ...line, ...partial } : line
          ),
        }));
      },
      
      removeLine: (id) => {
        set((state) => ({
          lines: state.lines.filter((line) => line.id !== id),
        }));
      },
      
      setQty: (id, qty) => {
        if (qty <= 0) {
          get().removeLine(id);
        } else {
          get().updateLine(id, { qty });
        }
      },
      
      setCustomer: (customer) => set({ customer }),
      
      setTable: (table) => set({ table }),
      
      setPricelist: (pricelistId) => set({ pricelistId }),
      
      setPreset: (presetId) => set({ presetId }),
      
      clearCart: () => set({
        orderId: null,
        lines: [],
        customer: null,
        table: null,
        pricelistId: null,
        presetId: null,
        discountTotal: 0,
        notes: '',
      }),
      
      getTotals: () => {
        const { lines, discountTotal } = get();
        let subtotal = 0;
        let tax = 0;
        
        for (const line of lines) {
          const lineSubtotal = line.qty * line.unit_price;
          const lineDiscount = lineSubtotal * (line.discount_percent / 100);
          const lineAfterDiscount = lineSubtotal - lineDiscount;
          const lineTax = lineAfterDiscount * (line.tax_rate / 100);
          
          subtotal += lineAfterDiscount;
          tax += lineTax;
        }
        
        const total = subtotal + tax;
        const discount = lines.reduce(
          (sum, line) => sum + (line.qty * line.unit_price * line.discount_percent / 100),
          0
        );
        
        return {
          subtotal: Math.round(subtotal),
          tax: Math.round(tax),
          total: Math.round(total),
          discount: Math.round(discount + discountTotal),
        };
      },
    }),
    {
      name: 'pos-cart',
      storage: createJSONStorage(() => indexedDBStorage),
    }
  )
);
