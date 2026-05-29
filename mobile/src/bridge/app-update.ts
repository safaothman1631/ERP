/**
 * In-app update + force-upgrade gate.
 *
 * Spec ref: requirements.md §R5.8, design.md §5.5, tasks.md T-G.5.13.
 *
 * On cold start we POST `/api/mobile/version-check` with
 *   { platform, current_version }
 * and read back:
 *   { min_version, latest_version, force_update, update_url, update_message }
 *
 * Decision tree:
 *   current < min  OR  force_update=true   → hard gate (non-dismissible modal)
 *   current < latest                       → soft banner (dismissible)
 *   else                                   → no UI
 *
 * The hard gate also surfaces Android's in-app update flow via
 * `@capacitor/app-update` when available — Play Store can show an
 * immediate-update dialog rather than redirecting to the store listing.
 */
import { Capacitor } from '@capacitor/core';

// ── Types ─────────────────────────────────────────────────────────────────

export interface VersionCheckRequest {
  platform: 'ios' | 'android' | 'web';
  current_version: string;
}

export interface VersionCheckResponse {
  min_version: string;
  latest_version: string;
  force_update: boolean;
  update_url: { ios?: string; android?: string } | string;
  update_message?: Record<string, string>;
}

export type UpdateDecision =
  | { kind: 'none' }
  | { kind: 'optional'; latest: string; url: string; message?: string }
  | { kind: 'forced'; min: string; latest: string; url: string; message?: string };

// ── Version comparison (semver-like, no pre-release support) ──────────────

/** Compare two semver-ish version strings. Returns -1, 0, 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((s) => parseInt(s, 10) || 0);
  const pb = b.split('.').map((s) => parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

// ── Network ───────────────────────────────────────────────────────────────

async function postVersionCheck(
  apiBaseUrl: string,
  req: VersionCheckRequest,
): Promise<VersionCheckResponse> {
  const res = await fetch(`${apiBaseUrl}/api/mobile/version-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`version-check ${res.status}`);
  }
  return res.json();
}

function platformName(): 'ios' | 'android' | 'web' {
  const p = Capacitor.getPlatform();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}

function pickStoreUrl(
  payload: VersionCheckResponse,
  platform: 'ios' | 'android' | 'web',
): string {
  const u = payload.update_url;
  if (typeof u === 'string') return u;
  if (platform === 'ios') return u.ios || '';
  if (platform === 'android') return u.android || '';
  return '';
}

function pickMessage(
  payload: VersionCheckResponse,
  lang: string,
): string | undefined {
  if (!payload.update_message) return undefined;
  return (
    payload.update_message[lang] ||
    payload.update_message.ku ||
    payload.update_message.en
  );
}

// ── Public API ────────────────────────────────────────────────────────────

export async function evaluateVersion(opts: {
  apiBaseUrl: string;
  currentVersion: string;
  language?: string;
}): Promise<UpdateDecision> {
  const platform = platformName();
  if (platform === 'web') return { kind: 'none' };

  let payload: VersionCheckResponse;
  try {
    payload = await postVersionCheck(opts.apiBaseUrl, {
      platform,
      current_version: opts.currentVersion,
    });
  } catch (e) {
    // Fail open: if version-check is unreachable, never block the user.
    console.warn('[app-update] version-check failed; failing open', e);
    return { kind: 'none' };
  }

  const url = pickStoreUrl(payload, platform);
  const message = pickMessage(payload, opts.language ?? 'ku');

  if (
    payload.force_update ||
    compareVersions(opts.currentVersion, payload.min_version) < 0
  ) {
    return {
      kind: 'forced',
      min: payload.min_version,
      latest: payload.latest_version,
      url,
      message,
    };
  }
  if (compareVersions(opts.currentVersion, payload.latest_version) < 0) {
    return {
      kind: 'optional',
      latest: payload.latest_version,
      url,
      message,
    };
  }
  return { kind: 'none' };
}

/**
 * Try the Android Play Store in-app update flow (immediate=true for forced).
 * No-op on iOS — App Store does not expose an equivalent API.
 * Returns true if the in-app flow was triggered; false otherwise (caller
 * should fall back to a store-link button).
 */
export async function tryNativeInAppUpdate(forced: boolean): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return false;
  try {
    const mod = await import('@capacitor/app-update');
    const AppUpdate = (mod as any).AppUpdate;
    const info = await AppUpdate.getAppUpdateInfo();
    if (info.updateAvailability !== 2 /* AppUpdateAvailability.UPDATE_AVAILABLE */) {
      return false;
    }
    if (forced) {
      await AppUpdate.performImmediateUpdate();
    } else {
      await AppUpdate.startFlexibleUpdate();
    }
    return true;
  } catch (e) {
    console.warn('[app-update] native flow not available', e);
    return false;
  }
}

/**
 * Open the platform-appropriate store URL (used by the modal "Update" button
 * when the native in-app flow is not available).
 */
export async function openStore(url: string): Promise<void> {
  if (!url) return;
  if (Capacitor.isNativePlatform()) {
    try {
      const mod = await import('@capacitor/app');
      const App = (mod as any).App;
      // No native openUrl on @capacitor/app; use Browser plugin if available.
      // Fall back to window.location for simplicity.
      void App;
    } catch {
      /* ignore */
    }
  }
  window.location.href = url;
}

export default { evaluateVersion, tryNativeInAppUpdate, openStore, compareVersions };
