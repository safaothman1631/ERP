/**
 * usePOSTerminal — orchestration hook for the POS terminal route.
 *
 * Composes the smaller hooks (`useOnline`, `usePOSPrinter`, `useBarcodeScanner`)
 * plus a local cart reducer into a single cohesive API for `POSTerminalShell`
 * and the route-level component. The legacy `POSTerminal.tsx` keeps using
 * react-i18next + axios directly, but the hook owns the orchestration of:
 *
 *   - Loading session + config + items + payment methods.
 *   - Cart operations (add, update qty, remove, clear).
 *   - Totals computation.
 *   - Checkout, with the offline-queue fallback when fetch fails.
 *
 * The hook is intentionally framework-agnostic — it doesn't depend on Antd
 * or react-router. UI lives in the components that consume it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import { useOnline } from './useOnline';
import { usePOSPrinter } from './usePOSPrinter';
import { useBarcodeScanner } from './useBarcodeScanner';
import {
  enqueuePayment,
  flushQueue,
  getQueue,
  type OfflineQueueItem,
  type PosOrderLine,
  type PosPaymentPayload,
} from '../pos/posOfflineQueue';

export interface TerminalCartLine {
  item_id: string;
  item_name: string;
  sku: string;
  qty: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  total: number;
}

export interface TerminalProduct {
  id: string;
  name: string;
  name_ku?: string;
  sku?: string;
  selling_price?: number;
  barcode?: string;
  category_id?: string;
}

export interface TerminalState {
  // Loading
  loading: boolean;
  session: unknown | null;
  config: unknown | null;

  // Products
  items: TerminalProduct[];
  filteredItems: TerminalProduct[];
  searchQuery: string;
  selectedCategory: string;

  // Cart
  cart: TerminalCartLine[];
  customer: unknown | null;
  currentOrderId: string | null;
  totals: { subtotal: number; tax: number; total: number };

  // Connectivity
  online: boolean;
  syncing: boolean;
  syncQueue: OfflineQueueItem[];

  // Hardware
  printerReady: boolean;
  printerLabel: string | null;
}

export interface TerminalActions {
  setSearchQuery: (q: string) => void;
  setSelectedCategory: (c: string) => void;
  setCustomer: (c: unknown | null) => void;
  addItem: (item: TerminalProduct) => void;
  updateLine: (itemId: string, updates: Partial<TerminalCartLine>) => void;
  removeLine: (itemId: string) => void;
  clearCart: () => void;
  search: (q: string) => Promise<void>;
  saveDraft: () => Promise<void>;
  checkout: (payments: PosPaymentPayload[]) => Promise<{ ok: boolean; offline: boolean; error?: string }>;
  syncOfflineQueue: () => Promise<void>;
  scanText: (code: string) => Promise<void>;
  print: (bytes: Uint8Array) => Promise<void>;
  reload: () => Promise<void>;
}

export interface UsePOSTerminalOptions {
  sessionId: string | undefined;
  /** Optional barcode lookup override — useful for tests. */
  lookupByBarcode?: (code: string) => Promise<TerminalProduct | null>;
}

function emptyTotals(): { subtotal: number; tax: number; total: number } {
  return { subtotal: 0, tax: 0, total: 0 };
}

function recalcLine(line: TerminalCartLine): TerminalCartLine {
  const subtotal = line.qty * line.unit_price;
  const discount = subtotal * (line.discount_percent / 100);
  const afterDiscount = subtotal - discount;
  const tax = afterDiscount * (line.tax_rate / 100);
  return { ...line, total: afterDiscount + tax };
}

export function usePOSTerminal(opts: UsePOSTerminalOptions): TerminalState & TerminalActions {
  const { sessionId } = opts;

  // Top-level data
  const [loading, setLoading] = useState<boolean>(true);
  const [session, setSession] = useState<unknown | null>(null);
  const [config, setConfig] = useState<unknown | null>(null);

  // Products
  const [items, setItems] = useState<TerminalProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Cart
  const [cart, setCart] = useState<TerminalCartLine[]>([]);
  const [customer, setCustomer] = useState<unknown | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  // Sync state
  const [syncQueue, setSyncQueue] = useState<OfflineQueueItem[]>([]);

  // Sub-hooks
  const onlineState = useOnline();
  const printer = usePOSPrinter();
  const scanner = useBarcodeScanner();

  // Track the last sessionId for cleanup
  const sessionIdRef = useRef<string | undefined>(sessionId);
  sessionIdRef.current = sessionId;

  // ---- Loaders ----------------------------------------------------------
  const loadSession = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    try {
      const res = await api.get(`/api/pos/sessions/${sessionId}`);
      setSession(res.data);
      if (res.data?.config_id) {
        const cfg = await api.get(`/api/pos/configs/${res.data.config_id}`);
        setConfig(cfg.data);
      }
    } catch {
      /* keep prior state — caller decides how to show */
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const loadItems = useCallback(async (): Promise<void> => {
    try {
      const res = await api.get('/api/items', { params: { page_size: 1000 } });
      setItems(res.data.items || []);
    } catch {
      // Offline — caller can pull from cached IDB later.
    }
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    await Promise.all([loadSession(), loadItems()]);
  }, [loadSession, loadItems]);

  // Mount: load + register online sync
  useEffect(() => {
    if (!sessionId) return;
    void reload();
    void getQueue().then(setSyncQueue);
  }, [sessionId, reload]);

  // ---- Search -----------------------------------------------------------
  const search = useCallback(
    async (q: string): Promise<void> => {
      setSearchQuery(q);
      if (q && q.length > 2) {
        try {
          const res = await api.get('/api/pos/products/lookup', { params: { q } });
          const products: TerminalProduct[] = res.data.items || [];
          if (products.length > 0) {
            setItems((prev) => {
              const existing = new Set(prev.map((p) => p.id));
              const newOnes = products.filter((p) => !existing.has(p.id));
              return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
            });
          }
        } catch {
          /* local-only fallback below */
        }
      }
    },
    [],
  );

  // ---- Cart ops ---------------------------------------------------------
  const addItem = useCallback((item: TerminalProduct): void => {
    setCart((prev) => {
      const existing = prev.find((l) => l.item_id === item.id);
      if (existing) {
        return prev.map((l) =>
          l.item_id === item.id ? recalcLine({ ...l, qty: l.qty + 1 }) : l,
        );
      }
      const fresh: TerminalCartLine = recalcLine({
        item_id: item.id,
        item_name: item.name,
        sku: item.sku ?? '',
        qty: 1,
        unit_price: item.selling_price ?? 0,
        discount_percent: 0,
        tax_rate: 0,
        total: 0,
      });
      return [...prev, fresh];
    });
  }, []);

  const updateLine = useCallback(
    (itemId: string, updates: Partial<TerminalCartLine>): void => {
      setCart((prev) =>
        prev.map((line) => (line.item_id === itemId ? recalcLine({ ...line, ...updates }) : line)),
      );
    },
    [],
  );

  const removeLine = useCallback((itemId: string): void => {
    setCart((prev) => prev.filter((l) => l.item_id !== itemId));
  }, []);

  const clearCart = useCallback((): void => {
    setCart([]);
    setCustomer(null);
    setCurrentOrderId(null);
  }, []);

  // ---- Totals -----------------------------------------------------------
  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const line of cart) {
      const lineSubtotal = line.qty * line.unit_price;
      const discount = lineSubtotal * (line.discount_percent / 100);
      const afterDiscount = lineSubtotal - discount;
      subtotal += afterDiscount;
      tax += afterDiscount * (line.tax_rate / 100);
    }
    return { subtotal, tax, total: subtotal + tax };
  }, [cart]);

  // ---- Filter -----------------------------------------------------------
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (q) {
        const name = (item.name ?? '').toLowerCase();
        const sku = (item.sku ?? '').toLowerCase();
        if (!name.includes(q) && !sku.includes(q)) return false;
      }
      if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false;
      return true;
    });
  }, [items, searchQuery, selectedCategory]);

  // ---- Save / Checkout --------------------------------------------------
  const buildOrderLines = useCallback(
    (): PosOrderLine[] =>
      cart.map((l) => ({
        item_id: l.item_id,
        qty: l.qty,
        unit_price: l.unit_price,
        discount_percent: l.discount_percent,
        tax_rate: l.tax_rate,
      })),
    [cart],
  );

  const saveDraft = useCallback(async (): Promise<void> => {
    if (!sessionId || cart.length === 0) return;
    const lines = buildOrderLines();
    if (currentOrderId) {
      await api.put(`/api/pos/orders/${currentOrderId}`, {
        partner_id: (customer as { id?: string } | null)?.id,
        lines,
      });
    } else {
      const res = await api.post('/api/pos/orders', {
        session_id: sessionId,
        partner_id: (customer as { id?: string } | null)?.id,
        lines,
      });
      setCurrentOrderId(res.data.id);
    }
  }, [sessionId, cart, currentOrderId, customer, buildOrderLines]);

  const checkout = useCallback(
    async (payments: PosPaymentPayload[]): Promise<{ ok: boolean; offline: boolean; error?: string }> => {
      if (!sessionId || cart.length === 0) return { ok: false, offline: false };

      const queue = async () => {
        await enqueuePayment({
          sessionId,
          orderPayload: {
            session_id: sessionId,
            partner_id: (customer as { id?: string } | null)?.id,
            lines: buildOrderLines(),
            orderId: currentOrderId,
          },
          payments,
        });
        setSyncQueue(await getQueue());
        clearCart();
      };

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await queue();
        return { ok: true, offline: true };
      }

      try {
        let orderId = currentOrderId;
        if (!orderId) {
          const orderRes = await api.post('/api/pos/orders', {
            session_id: sessionId,
            partner_id: (customer as { id?: string } | null)?.id,
            lines: buildOrderLines(),
          });
          orderId = orderRes.data.id;
        }
        await api.post(`/api/pos/orders/${orderId}/pay`, { payments });
        clearCart();
        return { ok: true, offline: false };
      } catch (err) {
        // 4xx ≠ "we're offline". For a 4xx (validation, closed session, bad
        // input) we surface the error so the cashier sees what happened
        // instead of silently dropping the sale into the offline queue.
        const status = (err as { response?: { status?: number } })?.response?.status;
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '';
        if (status && status >= 400 && status < 500) {
          return {
            ok: false,
            offline: false,
            error:
              detail || `POS order rejected (HTTP ${status}). Open a session and try again.`,
          };
        }
        // 5xx or network failure — queue for sync.
        await queue();
        return { ok: true, offline: true };
      }
    },
    [sessionId, cart, customer, currentOrderId, buildOrderLines, clearCart],
  );

  const syncOfflineQueue = useCallback(async (): Promise<void> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const result = await flushQueue(api);
    setSyncQueue(result.remaining);
  }, []);

  // Auto-sync when we come back online (via the heartbeat hook).
  useEffect(() => {
    if (onlineState.online && syncQueue.length > 0) {
      void syncOfflineQueue();
    }
    // Intentionally only react to the online flag flipping true with a non-empty queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineState.online]);

  // ---- Barcode scan -----------------------------------------------------
  const scanText = useCallback(
    async (code: string): Promise<void> => {
      const trimmed = code.trim();
      if (!trimmed) return;

      // Try the decoder worker first — passing through the text path. Even
      // for a plain wedge string, this normalises the format detection.
      try {
        await scanner.scan({ kind: 'text', code: trimmed });
      } catch {
        /* fall through */
      }

      // Look up the product.
      try {
        const lookup =
          opts.lookupByBarcode ??
          (async (c: string) => {
            const res = await api.get('/api/pos/products/lookup', { params: { barcode: c } });
            const products = (res.data?.items ?? []) as TerminalProduct[];
            return products[0] ?? null;
          });
        const product = await lookup(trimmed);
        if (product) {
          addItem(product);
        }
      } catch {
        /* silent */
      }
    },
    [scanner, addItem, opts.lookupByBarcode],
  );

  // ---- Print ------------------------------------------------------------
  const print = useCallback(
    async (bytes: Uint8Array): Promise<void> => {
      await printer.print(bytes);
    },
    [printer],
  );

  return {
    // state
    loading,
    session,
    config,
    items,
    filteredItems,
    searchQuery,
    selectedCategory,
    cart,
    customer,
    currentOrderId,
    totals: cart.length === 0 ? emptyTotals() : totals,
    online: onlineState.online,
    syncing: onlineState.syncing,
    syncQueue,
    printerReady: printer.isReady,
    printerLabel: printer.deviceLabel,

    // actions
    setSearchQuery,
    setSelectedCategory,
    setCustomer,
    addItem,
    updateLine,
    removeLine,
    clearCart,
    search,
    saveDraft,
    checkout,
    syncOfflineQueue,
    scanText,
    print,
    reload,
  };
}

export default usePOSTerminal;
