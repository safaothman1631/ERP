import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getPOSDB } from './pos/db';

/**
 * IndexedDB storage adapter for Zustand persistence.
 *
 * Uses the shared `getPOSDB()` connection (schema v4, store `carts`).
 * Zustand-persisted rows share that object store with CRDT-merged carts
 * but live under a reserved `zustand:` key prefix so the CRDT helpers
 * (`mergeCart`, sync code) skip them. The serialized blob is packed into
 * `notes`; the other CartRow fields are zero-valued and `updatedAt` is
 * stamped so the row still satisfies the typed schema.
 */
const ZUSTAND_KEY_PREFIX = 'zustand:';

const indexedDBStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const db = await getPOSDB();
      const row = await db.get('carts', `${ZUSTAND_KEY_PREFIX}${name}`);
      // Stored blob is in `notes`. Treat empty as missing.
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
      /* persistence is best-effort; never throw from a setItem */
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

export { ZUSTAND_KEY_PREFIX as _ZUSTAND_CART_KEY_PREFIX };

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
