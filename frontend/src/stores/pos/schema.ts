/**
 * IndexedDB schema for POS (v4)
 * ----------------------------------
 * Single shared schema used by `pos/db.ts`. All POS stores
 * (cart, sessions, floors, offline-queue) live in this DB.
 *
 * See `.kiro/specs/world-class-performance/design.md` §2.2.
 */
import type { DBSchema } from 'idb';

/** Single cart line, tombstonable for CRDT merge */
export interface CartLineRow {
  /** ULID-style id, client-generated, deterministic between devices */
  lineId: string;
  itemId: string;
  itemName: string;
  sku?: string;
  qty: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  note?: string;
  course?: string;
  /** ms epoch — last time quantity / unit price changed on any device */
  qtyUpdatedAt: number;
  /** device that authored the latest qty edit (used as LWW tiebreak) */
  qtyUpdatedBy: string;
  /** ms epoch when this line was tombstoned; absent if alive */
  deletedAt?: number;
  /** device that tombstoned it (LWW tiebreak with qtyUpdatedAt) */
  deletedBy?: string;
}

/** A POS cart (one open order on a terminal) */
export interface CartRow {
  /** Stable cart id — created on first line add */
  cartId: string;
  sessionId: string | null;
  /** Map of lineId -> line (object form so merge is per-key) */
  lines: Record<string, CartLineRow>;
  customer?: unknown | null;
  table?: unknown | null;
  pricelistId?: string | null;
  presetId?: string | null;
  discountTotal: number;
  notes: string;
  /** ms epoch — when this cart record was last touched on this device */
  updatedAt: number;
  /** device that last touched the top-level cart fields */
  updatedBy: string;
}

/** Open cashier session for a POS terminal */
export interface SessionRow {
  sessionId: string;
  employeeToken: string | null;
  employee: unknown | null;
  tokenExpiry: string | null;
  updatedAt: number;
}

/** Floor + tables snapshot cached per floor */
export interface FloorRow {
  floorId: string;
  configId: string;
  name: string;
  nameKu?: string;
  sequence: number;
  backgroundImageUrl?: string;
  isActive: boolean;
  /** Cached tables for this floor, full json blob */
  tables: unknown[];
  updatedAt: number;
}

/** Background-sync queue item */
export interface OfflineQueueRow {
  /** autoIncrement primary key */
  id?: number;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body: unknown;
  headers: Record<string, string>;
  attempts: number;
  status: 'pending' | 'syncing' | 'failed';
  createdAt: number;
  lastTriedAt?: number;
  lastError?: string;
}

/** The full IDB schema (idb-typed) */
export interface ZohoPOSSchema extends DBSchema {
  carts: {
    key: string;
    value: CartRow;
  };
  sessions: {
    key: string;
    value: SessionRow;
  };
  floors: {
    key: string;
    value: FloorRow;
  };
  'offline-queue': {
    key: number;
    value: OfflineQueueRow;
    indexes: { 'by-status': OfflineQueueRow['status'] };
  };
}

export const POS_DB_NAME = 'zoho-pos';
export const POS_DB_VERSION = 4;
