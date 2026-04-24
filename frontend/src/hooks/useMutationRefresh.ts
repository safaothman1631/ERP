/**
 * useMutationRefresh — listens to api:mutation events and instantly updates
 * the data state for the given URL pattern.
 *
 * Usage (in any list page):
 *   useMutationRefresh('/api/contacts', { setData, setTotal });
 *
 * This gives real-time display: when any POST/PUT/DELETE fires for this
 * endpoint, state is updated INSTANTLY without waiting for a re-fetch.
 */
import { useEffect, useRef } from 'react';

type SetList = React.Dispatch<React.SetStateAction<any[]>>;
type SetCount = React.Dispatch<React.SetStateAction<number>>;

interface MutationHandlers {
  setData: SetList;
  setTotal?: SetCount;
}

export function useMutationRefresh(urlPattern: string, { setData, setTotal }: MutationHandlers) {
  // Use ref so the event handler always has fresh setData/setTotal
  const setDataRef = useRef(setData);
  const setTotalRef = useRef(setTotal);
  setDataRef.current = setData;
  setTotalRef.current = setTotal;

  useEffect(() => {
    const handle = (e: Event) => {
      const { method, url, data } = (e as CustomEvent).detail ?? {};
      if (!url || !url.includes(urlPattern)) return;

      const sd = setDataRef.current;
      const st = setTotalRef.current;

      if (method === 'post') {
        if (data && typeof data === 'object' && data.id) {
          sd((prev) => {
            // avoid duplicates if fetchData also ran
            if (prev.some((x) => x.id === data.id)) return prev;
            return [data, ...prev];
          });
          st?.((prev) => prev + 1);
        }
      } else if (method === 'put' || method === 'patch') {
        if (data && typeof data === 'object' && data.id) {
          sd((prev) => prev.map((x) => (x.id === data.id ? data : x)));
        }
      } else if (method === 'delete') {
        // Extract ID from end of URL like /api/contacts/abc-123
        const segments = url.split('/');
        const id = segments[segments.length - 1];
        if (id) {
          sd((prev) => {
            const filtered = prev.filter((x) => x.id !== id);
            if (filtered.length < prev.length) {
              st?.((c) => Math.max(0, c - 1));
            }
            return filtered;
          });
        }
      }
    };

    window.addEventListener('api:mutation', handle);
    return () => window.removeEventListener('api:mutation', handle);
  }, [urlPattern]); // stable — only re-subscribe if urlPattern changes
}
