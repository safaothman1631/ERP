/// <reference lib="webworker" />
/**
 * Barcode decoder Web Worker.
 *
 * Two input modes:
 *   - `{ kind: 'image', imageData, requestId }` — decode a frame from the
 *     camera (`ImageData`).
 *   - `{ kind: 'text', code, requestId }` — pass-through for HID wedge
 *     scanners that just emit a string. Useful because keeping the parser
 *     in one place lets us add per-format validation later.
 *
 * Reply:
 *   - `{ requestId, ok: true, format, value }`
 *   - `{ requestId, ok: false, error }`
 *
 * We lazy-import `@zxing/library` so that, if the dep is missing or fails
 * to load in older browsers, text-mode still works.
 */

interface ImageRequest {
  kind: 'image';
  imageData: ImageData;
  requestId: number;
}

interface TextRequest {
  kind: 'text';
  code: string;
  requestId: number;
}

type BarcodeRequest = ImageRequest | TextRequest;

interface BarcodeOkResponse {
  requestId: number;
  ok: true;
  format: string;
  value: string;
}

interface BarcodeErrResponse {
  requestId: number;
  ok: false;
  error: string;
}

type BarcodeResponse = BarcodeOkResponse | BarcodeErrResponse;

declare const self: DedicatedWorkerGlobalScope;

// Lazy-loaded zxing handle. Cached after first successful import.
type ZxingModule = typeof import('@zxing/library');
let zxingPromise: Promise<ZxingModule | null> | null = null;
async function loadZxing(): Promise<ZxingModule | null> {
  if (!zxingPromise) {
    zxingPromise = (async () => {
      try {
        return await import('@zxing/library');
      } catch {
        return null;
      }
    })();
  }
  return zxingPromise;
}

self.onmessage = async (ev: MessageEvent<BarcodeRequest>) => {
  const req = ev.data;
  try {
    if (!req || typeof req.requestId !== 'number') return;
    const response = await handle(req);
    self.postMessage(response);
  } catch (err) {
    const response: BarcodeErrResponse = {
      requestId: req?.requestId ?? -1,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};

async function handle(req: BarcodeRequest): Promise<BarcodeResponse> {
  if (req.kind === 'text') {
    const value = (req.code ?? '').trim();
    if (!value) {
      return { requestId: req.requestId, ok: false, error: 'empty' };
    }
    return {
      requestId: req.requestId,
      ok: true,
      format: detectFormat(value),
      value,
    };
  }

  // Image mode — try zxing.
  const zxing = await loadZxing();
  if (!zxing) {
    return {
      requestId: req.requestId,
      ok: false,
      error: '@zxing/library unavailable in this environment',
    };
  }
  try {
    const { imageData } = req;
    const reader = new zxing.MultiFormatReader();
    const hints = new Map();
    hints.set(zxing.DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints);

    // Build a luminance source from the ImageData. zxing expects a
    // (Int32Array | number[]) of ARGB ints; we adapt from RGBA.
    const argb = rgbaToArgb(imageData);
    // @ts-expect-error — RGBLuminanceSource takes Int32Array or number[]
    const lum = new zxing.RGBLuminanceSource(argb, imageData.width, imageData.height);
    const binarizer = new zxing.HybridBinarizer(lum);
    const bitmap = new zxing.BinaryBitmap(binarizer);
    const result = reader.decode(bitmap);
    return {
      requestId: req.requestId,
      ok: true,
      format: String(result.getBarcodeFormat?.() ?? 'UNKNOWN'),
      value: result.getText(),
    };
  } catch (err) {
    return {
      requestId: req.requestId,
      ok: false,
      error: err instanceof Error ? err.message : 'decode-failed',
    };
  }
}

function rgbaToArgb(img: ImageData): Int32Array {
  const { data, width, height } = img;
  const out = new Int32Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    out[j] = ((a & 0xff) << 24) | ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
  }
  return out;
}

function detectFormat(value: string): string {
  // Heuristics for the common formats used in retail.
  if (/^\d{13}$/.test(value)) return 'EAN_13';
  if (/^\d{12}$/.test(value)) return 'UPC_A';
  if (/^\d{8}$/.test(value)) return 'EAN_8';
  if (/^[\dA-Z\-. $/+%]*$/.test(value)) return 'CODE_39';
  return 'UNKNOWN';
}

// Export nothing — workers are entry points, not modules consumed via
// `import`. The `export {}` keeps TypeScript happy in `isolatedModules`.
export {};
