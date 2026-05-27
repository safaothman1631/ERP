/**
 * Offline queue — promise wrapper around the `offline-queue` object store.
 *
 * Used by the Service Worker (via Workbox Background Sync) AND by the main
 * thread when SW is not available (older browsers, dev mode). All operations
 * go through `getPOSDB()` so we share the single connection.
 */
import { getPOSDB } from './db';
import type { OfflineQueueRow } from './schema';

export interface EnqueueRequest {
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body: unknown;
  headers?: Record<string, string>;
}

/** Adds a request to the queue. Returns the auto-incremented id. */
export async function enqueue(req: EnqueueRequest): Promise<number> {
  const db = await getPOSDB();
  const row: OfflineQueueRow = {
    url: req.url,
    method: req.method,
    body: req.body,
    headers: req.headers ?? {},
    attempts: 0,
    status: 'pending',
    createdAt: Date.now(),
  };
  return (await db.add('offline-queue', row)) as number;
}

/** Returns the oldest pending queue item, or `null` if the queue is empty. */
export async function peek(): Promise<OfflineQueueRow | null> {
  const db = await getPOSDB();
  const tx = db.transaction('offline-queue', 'readonly');
  const idx = tx.store.index('by-status');
  const cursor = await idx.openCursor('pending');
  return cursor?.value ?? null;
}

/** Returns all pending items in insertion order. */
export async function listPending(): Promise<OfflineQueueRow[]> {
  const db = await getPOSDB();
  return await db.getAllFromIndex('offline-queue', 'by-status', 'pending');
}

/** Returns all queue items regardless of status (debug / UI inspector). */
export async function listAll(): Promise<OfflineQueueRow[]> {
  const db = await getPOSDB();
  return await db.getAll('offline-queue');
}

/** Marks an item as currently syncing. */
export async function markSyncing(id: number): Promise<void> {
  const db = await getPOSDB();
  const row = await db.get('offline-queue', id);
  if (!row) return;
  row.status = 'syncing';
  row.attempts = (row.attempts ?? 0) + 1;
  row.lastTriedAt = Date.now();
  await db.put('offline-queue', row);
}

/** Marks an item as failed, recording the error message. */
export async function markFailed(id: number, err: unknown): Promise<void> {
  const db = await getPOSDB();
  const row = await db.get('offline-queue', id);
  if (!row) return;
  row.status = 'failed';
  row.lastTriedAt = Date.now();
  row.lastError = err instanceof Error ? err.message : String(err);
  await db.put('offline-queue', row);
}

/** Resets a previously-failed item back to pending (for retry). */
export async function markPending(id: number): Promise<void> {
  const db = await getPOSDB();
  const row = await db.get('offline-queue', id);
  if (!row) return;
  row.status = 'pending';
  await db.put('offline-queue', row);
}

/** Hard delete a successfully-synced item. */
export async function remove(id: number): Promise<void> {
  const db = await getPOSDB();
  await db.delete('offline-queue', id);
}

/** Alias for `remove` — matches the name spec'd in the brief. */
export { remove as delete_ };

/** Removes every item (debug / sign-out flow). */
export async function clear(): Promise<void> {
  const db = await getPOSDB();
  await db.clear('offline-queue');
}

/** Convenience — count of pending items. Cheap, used by the offline pill. */
export async function pendingCount(): Promise<number> {
  const db = await getPOSDB();
  return await db.countFromIndex('offline-queue', 'by-status', 'pending');
}
