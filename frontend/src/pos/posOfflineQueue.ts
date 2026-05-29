import {
  idbReadAll,
  idbRemove,
  idbWriteAll,
} from './posOfflineDb';

const STORAGE_KEY = 'pos:offline-queue';

export interface PosOrderLine {
  item_id: string;
  qty: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
}

export interface PosOrderPayload {
  session_id: string;
  partner_id?: string;
  lines: PosOrderLine[];
  orderId?: string | null;
}

export interface PosPaymentPayload {
  payment_method_id: string;
  amount: number;
  tendered?: number;
  reference?: string;
}

export interface OfflineQueueItem {
  id: string;
  createdAt: string;
  sessionId: string;
  orderPayload: PosOrderPayload;
  payments: PosPaymentPayload[];
}

export interface PosOfflineApi {
  post: (url: string, data?: unknown) => Promise<{ data: unknown }>;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function readQueue(): Promise<OfflineQueueItem[]> {
  const fromIdb = await idbReadAll<OfflineQueueItem>();
  if (fromIdb.length > 0) {
    return fromIdb;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: OfflineQueueItem[]): Promise<void> {
  try {
    await idbWriteAll(queue);
  } catch {
    /* IndexedDB optional in test env */
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export async function getQueue(): Promise<OfflineQueueItem[]> {
  return readQueue();
}

export async function enqueuePayment(
  payload: Pick<OfflineQueueItem, 'sessionId' | 'orderPayload' | 'payments'>,
): Promise<OfflineQueueItem> {
  const item: OfflineQueueItem = {
    id: newId(),
    createdAt: new Date().toISOString(),
    sessionId: payload.sessionId,
    orderPayload: payload.orderPayload,
    payments: payload.payments,
  };
  const queue = await readQueue();
  await writeQueue([...queue, item]);
  return item;
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = (await readQueue()).filter((item) => item.id !== id);
  await writeQueue(queue);
  try {
    await idbRemove(id);
  } catch {
    /* noop */
  }
}

export async function flushQueue(
  api: PosOfflineApi,
): Promise<{ synced: number; failed: number; remaining: OfflineQueueItem[] }> {
  const queue = await readQueue();
  if (queue.length === 0) {
    return { synced: 0, failed: 0, remaining: [] };
  }

  try {
    const res = await api.post('/api/pos/orders/sync', {
      orders: queue.map((item) => ({
        temp_id: item.id,
        session_id: item.orderPayload.session_id,
        partner_id: item.orderPayload.partner_id,
        lines: item.orderPayload.lines,
        payments: item.payments,
        notes: '',
      })),
    });

    const data = res.data as {
      mapping?: Record<string, string>;
      errors?: Array<{ temp_id?: string }>;
    };
    const mapping = data.mapping ?? {};
    const errorIds = new Set(
      (data.errors ?? [])
        .map((e) => e.temp_id)
        .filter((id): id is string => Boolean(id)),
    );

    const remaining = queue.filter((item) => !mapping[item.id] || errorIds.has(item.id));
    const synced = queue.length - remaining.length;
    await writeQueue(remaining);
    return { synced, failed: remaining.length, remaining };
  } catch {
    return { synced: 0, failed: queue.length, remaining: queue };
  }
}
