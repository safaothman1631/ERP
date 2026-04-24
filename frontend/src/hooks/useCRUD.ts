/**
 * useCRUD — optimistic state update hook for list pages.
 *
 * Usage:
 *   const rt = useCRUD(setData, setTotal, fetchData);
 *   // after create:  rt.sync(null,       res.data);
 *   // after update:  rt.sync(editing.id, res.data);
 *   // after delete:  rt.remove(id);
 */
import { useCallback, useRef } from 'react';

type SetList = React.Dispatch<React.SetStateAction<any[]>>;
type SetCount = React.Dispatch<React.SetStateAction<number>>;
type FetchFn = (silent?: boolean) => Promise<void>;

export function useCRUD(setData: SetList, setTotal: SetCount, fetchData: FetchFn) {
  // Keep stable ref so callbacks don't go stale
  const fetchRef = useRef(fetchData);
  fetchRef.current = fetchData;

  const sync = useCallback(
    (editingId: string | null | undefined, item: any) => {
      if (editingId) {
        // update existing row instantly
        setData((prev) => prev.map((x) => (x.id === editingId ? item : x)));
      } else {
        // prepend new row instantly
        setData((prev) => [item, ...prev]);
        setTotal((prev) => prev + 1);
      }
      // silent background sync (no loading spinner)
      fetchRef.current(true).catch(() => {});
    },
    [setData, setTotal]
  );

  const remove = useCallback(
    (id: string) => {
      setData((prev) => prev.filter((x) => x.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      fetchRef.current(true).catch(() => {});
    },
    [setData, setTotal]
  );

  return { sync, remove };
}
