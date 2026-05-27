import { useEffect, useRef } from 'react';
import api from '../../api';
import type { SectionKey } from '../registry/types';

interface ServerSection {
  key: string;
  can_view?: boolean;
  can_edit?: boolean;
}

/** Optional tamper-resistance: warn when client nav shows sections server denies. */
export function useSettingsSectionsSync(visibleKeys: SectionKey[]): void {
  const warned = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ sections: ServerSection[] }>('/onboarding/settings-sections');
        if (cancelled || !data?.sections) return;
        const denied = new Set(
          data.sections.filter((s) => s.can_view === false).map((s) => s.key),
        );
        for (const key of visibleKeys) {
          const bagKey = key;
          if (denied.has(bagKey) && !warned.current.has(bagKey)) {
            warned.current.add(bagKey);
            if (import.meta.env.DEV) {
              console.warn(`[settings] server denied view for section "${bagKey}" but client shows it`);
            }
          }
        }
      } catch {
        // Endpoint optional — ignore network errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visibleKeys]);
}
