/**
 * useBarcodeScanner — main-thread proxy for the barcode decode worker.
 *
 * Loads `frontend/src/workers/barcode.worker.ts` via Vite's `?worker` import
 * (Vite emits the worker as a separate bundle). The hook exposes a `scan`
 * function returning a Promise. Multiple concurrent `scan` calls are matched
 * to their responses via an incrementing `requestId`.
 *
 * The worker is created lazily on the first `scan` call so we don't pay the
 * bundle cost on routes that don't need it. It is torn down on unmount.
 *
 * `scan` accepts either:
 *   - an `ImageData` from a `<video>` frame (camera mode), or
 *   - a string from an HID wedge scanner (keyboard mode).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// Vite-specific worker import. The `?worker` suffix tells Vite to emit the
// file as a separate chunk and return a `Worker` constructor. Wrapped in a
// dynamic import so that test environments without Vite's worker plugin
// (Vitest in jsdom) don't blow up at module-load time.
type WorkerCtor = new () => Worker;
let BarcodeWorker: WorkerCtor | null = null;
async function loadWorkerCtor(): Promise<WorkerCtor | null> {
  if (BarcodeWorker) return BarcodeWorker;
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — Vite-only import suffix; ignored in non-Vite tooling
    const mod = await import('../workers/barcode.worker.ts?worker');
    BarcodeWorker = (mod.default ?? mod) as WorkerCtor;
    return BarcodeWorker;
  } catch {
    return null;
  }
}

export interface BarcodeResult {
  format: string;
  value: string;
}

export interface BarcodeError {
  error: string;
}

type ScanInput = { kind: 'image'; imageData: ImageData } | { kind: 'text'; code: string };

interface PendingRequest {
  resolve: (r: BarcodeResult) => void;
  reject: (e: Error) => void;
}

export function useBarcodeScanner(): {
  scan: (input: ScanInput) => Promise<BarcodeResult>;
  isReady: boolean;
} {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<number, PendingRequest>>(new Map());
  const nextIdRef = useRef<number>(1);
  const [isReady, setReady] = useState<boolean>(false);

  // Lazy worker init (async — the worker module itself is also lazy-imported).
  const getWorker = useCallback(async (): Promise<Worker | null> => {
    if (workerRef.current) return workerRef.current;
    const Ctor = await loadWorkerCtor();
    if (!Ctor) return null;
    try {
      const w: Worker = new Ctor();
      w.onmessage = (ev: MessageEvent<{ requestId: number; ok: boolean; format?: string; value?: string; error?: string }>) => {
        const data = ev.data;
        if (!data || typeof data.requestId !== 'number') return;
        const pending = pendingRef.current.get(data.requestId);
        if (!pending) return;
        pendingRef.current.delete(data.requestId);
        if (data.ok && data.value != null && data.format != null) {
          pending.resolve({ format: data.format, value: data.value });
        } else {
          pending.reject(new Error(data.error ?? 'unknown decode error'));
        }
      };
      w.onerror = (ev: ErrorEvent) => {
        // Reject all pending — the worker itself crashed.
        for (const p of pendingRef.current.values()) {
          p.reject(new Error(ev.message || 'worker error'));
        }
        pendingRef.current.clear();
      };
      workerRef.current = w;
      setReady(true);
      return w;
    } catch (err) {
       
      console.warn('[useBarcodeScanner] worker creation failed', err);
      return null;
    }
  }, []);

  const scan = useCallback(
    async (input: ScanInput): Promise<BarcodeResult> => {
      const w = await getWorker();
      if (!w) {
        // Fallback: handle text mode without the worker. This keeps wedge
        // scanners working even when worker bundling fails (e.g. in tests).
        if (input.kind === 'text') {
          const value = (input.code ?? '').trim();
          if (!value) throw new Error('empty');
          return { format: 'UNKNOWN', value };
        }
        throw new Error('worker unavailable');
      }
      return new Promise<BarcodeResult>((resolve, reject) => {
        const requestId = nextIdRef.current++;
        pendingRef.current.set(requestId, { resolve, reject });
        // Transferable: ImageData isn't transferable but its underlying
        // ArrayBuffer can be; pass through normally — workers will structured-clone.
        try {
          w.postMessage({ ...input, requestId });
        } catch (err) {
          pendingRef.current.delete(requestId);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    },
    [getWorker],
  );

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        try {
          workerRef.current.terminate();
        } catch {
          /* noop */
        }
        workerRef.current = null;
      }
      for (const p of pendingRef.current.values()) {
        p.reject(new Error('component unmounted'));
      }
      pendingRef.current.clear();
    };
  }, []);

  return { scan, isReady };
}

export default useBarcodeScanner;
