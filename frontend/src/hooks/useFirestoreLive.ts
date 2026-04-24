import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as fsLimit,
  type Query,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../store';

export interface FilterClause {
  field: string;
  op: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';
  value: unknown;
}

export interface UseFirestoreLiveOptions {
  /** Firestore collection name. */
  collectionName: string;
  /**
   * Whether the collection is org-scoped. When true (default) we add an
   * `org_id == currentUser.org_id` filter automatically.
   */
  orgScoped?: boolean;
  filters?: FilterClause[];
  orderField?: string;
  orderDir?: 'asc' | 'desc';
  limit?: number;
  /** When false the subscription is not opened. */
  enabled?: boolean;
}

/**
 * Subscribe to a Firestore collection and re-render on any document change.
 * Mirrors the BaseRepository convention: rows soft-deleted via `deleted_at`
 * are filtered out client-side so realtime pages match REST behaviour.
 */
export function useFirestoreLive<T = Record<string, unknown>>(
  opts: UseFirestoreLiveOptions,
): { items: T[]; loading: boolean; error: Error | null } {
  const { collectionName, orgScoped = true, filters = [], orderField, orderDir = 'desc', limit, enabled = true } = opts;
  const orgId = useAuthStore(s => s.orgId);

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    if (orgScoped && !orgId) { setLoading(false); return; }

    const constraints: QueryConstraint[] = [];
    if (orgScoped && orgId) constraints.push(where('org_id', '==', orgId));
    for (const f of filters) constraints.push(where(f.field, f.op, f.value));
    if (orderField) constraints.push(orderBy(orderField, orderDir));
    if (limit) constraints.push(fsLimit(limit));

    let q: Query;
    try {
      q = query(collection(db, collectionName), ...constraints);
    } catch (e) {
      setError(e as Error);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      q,
      snap => {
        const rows: T[] = [];
        snap.forEach(doc => {
          const data = doc.data() as Record<string, unknown>;
          // honour BaseRepository soft-delete convention
          if (data.deleted_at) return;
          rows.push({ id: doc.id, ...data } as T);
        });
        setItems(rows);
        setLoading(false);
      },
      err => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [collectionName, orgScoped, orgId, filterKey, orderField, orderDir, limit, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { items, loading, error };
}
