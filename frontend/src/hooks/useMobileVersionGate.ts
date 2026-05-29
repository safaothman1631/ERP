/**
 * useMobileVersionGate — listens for 426 Upgrade Required responses from
 * the API and surfaces a force-update modal.
 *
 * Spec refs: growth-to-100 requirements.md §R5.8, design.md §5.5.
 *
 * Wiring (in `main.tsx` or App root):
 *   const gate = useMobileVersionGate();
 *   return <>
 *     <Routes>…</Routes>
 *     {gate.modal}
 *   </>;
 *
 * The hook returns `modal` (a JSX node — null when no update is required)
 * and `status` ('idle' | 'optional' | 'forced'). When `status === 'forced'`
 * the rest of the app is rendered behind a non-dismissible overlay.
 *
 * Detection sources:
 *   1. Cold-start: calls `/api/mobile/version-check` once on mount.
 *   2. Runtime: subscribes to a global `zoho:api:upgrade-required` event
 *      that the axios interceptor (see `frontend/src/api/client.ts`)
 *      dispatches when it sees an HTTP 426.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

interface UpgradeRequiredPayload {
  min_version: string;
  current_version?: string;
  update_url?: string;
  update_message?: { ku?: string; ar?: string; en?: string };
}

type Status = 'idle' | 'optional' | 'forced';

interface GateState {
  status: Status;
  url: string;
  message: string;
}

const APP_VERSION =
  (typeof window !== 'undefined' && (window as any).__APP_VERSION__) ||
  '0.0.0';

function getPlatform(): 'ios' | 'android' | 'web' {
  const Cap = (window as any).Capacitor;
  if (!Cap || !Cap.isNativePlatform?.()) return 'web';
  return Cap.getPlatform() === 'ios' ? 'ios' : 'android';
}

function getLang(): string {
  const l = (typeof document !== 'undefined' && document.documentElement.lang) || 'ku';
  return l.split('-')[0];
}

async function fetchVersionCheck(apiBase: string): Promise<GateState> {
  const platform = getPlatform();
  if (platform === 'web') return { status: 'idle', url: '', message: '' };
  try {
    const res = await fetch(`${apiBase}/api/mobile/version-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, current_version: APP_VERSION }),
    });
    if (!res.ok) return { status: 'idle', url: '', message: '' };
    const data = await res.json();
    const lang = getLang();
    const message =
      data?.update_message?.[lang] ||
      data?.update_message?.ku ||
      data?.update_message?.en ||
      '';
    const url =
      typeof data?.update_url === 'string'
        ? data.update_url
        : data?.update_url?.[platform] || '';
    if (data?.force_update) return { status: 'forced', url, message };
    const cmp = compare(APP_VERSION, data?.latest_version || APP_VERSION);
    if (cmp < 0) return { status: 'optional', url, message };
    return { status: 'idle', url: '', message: '' };
  } catch {
    return { status: 'idle', url: '', message: '' };
  }
}

function compare(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export interface UseMobileVersionGateOptions {
  apiBaseUrl?: string;
}

export function useMobileVersionGate(opts: UseMobileVersionGateOptions = {}) {
  const apiBase = opts.apiBaseUrl || (import.meta as any).env?.VITE_API_BASE_URL || '';
  const [state, setState] = useState<GateState>({ status: 'idle', url: '', message: '' });

  // Cold-start check.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchVersionCheck(apiBase);
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  // Runtime listener for HTTP 426 responses.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<UpgradeRequiredPayload>).detail;
      const lang = getLang();
      setState({
        status: 'forced',
        url: detail?.update_url || '',
        message:
          detail?.update_message?.[lang as 'ku' | 'ar' | 'en'] ||
          detail?.update_message?.ku ||
          '',
      });
    };
    window.addEventListener('zoho:api:upgrade-required', handler as EventListener);
    return () => window.removeEventListener('zoho:api:upgrade-required', handler as EventListener);
  }, []);

  const dismiss = useCallback(() => {
    if (state.status === 'optional') setState({ status: 'idle', url: '', message: '' });
  }, [state.status]);

  const goToStore = useCallback(() => {
    if (state.url) window.location.href = state.url;
  }, [state.url]);

  const modal = useMemo(() => {
    if (state.status === 'idle') return null;
    const forced = state.status === 'forced';
    return {
      forced,
      message: state.message,
      onUpdate: goToStore,
      onDismiss: forced ? undefined : dismiss,
    };
  }, [state, goToStore, dismiss]);

  return { status: state.status, modal };
}

export default useMobileVersionGate;
