import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enqueuePayment,
  flushQueue,
  getQueue,
  removeFromQueue,
} from '../posOfflineQueue';

const STORAGE_KEY = 'pos:offline-queue';

describe('posOfflineQueue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists enqueued payments to localStorage', async () => {
    const item = await enqueuePayment({
      sessionId: 'session-1',
      orderPayload: {
        session_id: 'session-1',
        partner_id: 'partner-1',
        lines: [
          {
            item_id: 'item-1',
            qty: 2,
            unit_price: 10,
            discount_percent: 0,
            tax_rate: 0,
          },
        ],
      },
      payments: [{ payment_method_id: 'cash', amount: 20, tendered: 20 }],
    });

    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBeTruthy();
    expect(await getQueue()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')).toHaveLength(1);
    await removeFromQueue(item.id);
    expect(await getQueue()).toHaveLength(0);
  });

  it('flushQueue uses bulk sync with temp_id idempotency keys', async () => {
    const item = await enqueuePayment({
      sessionId: 'session-1',
      orderPayload: {
        session_id: 'session-1',
        lines: [{ item_id: 'a', qty: 1, unit_price: 5, discount_percent: 0, tax_rate: 0 }],
      },
      payments: [{ payment_method_id: 'cash', amount: 5 }],
    });

    const post = vi.fn().mockResolvedValue({
      data: { mapping: { [item.id]: 'order-1' }, errors: [] },
    });

    const result = await flushQueue({ post });

    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.remaining).toHaveLength(0);
    expect(await getQueue()).toHaveLength(0);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/api/pos/orders/sync', {
      orders: [
        expect.objectContaining({
          temp_id: item.id,
          session_id: 'session-1',
          payments: [{ payment_method_id: 'cash', amount: 5 }],
        }),
      ],
    });
  });
});
