/**
 * Native push-notification bridge — FCM (Android) + APNs (iOS).
 *
 * Spec ref: requirements.md §R5.9–§R5.10, design.md §5.4, tasks.md
 * T-G.5.10–T-G.5.12. Mirrors the public surface that frontend hooks
 * expect (`registerPush()`, `subscribeTopic()`, etc.) so callers never
 * branch on platform.
 *
 * Topic strategy (design.md §5.4):
 *   tenant_{tenant_id}                — tenant-wide alerts
 *   user_{user_id}                    — personal alerts
 *   tenant_{tenant_id}_{feature}      — feature-specific (pos, invoices, ...)
 *
 * Token lifecycle:
 *   1. App start → request permission (localized rationale).
 *   2. On grant → fetch token (FCM via `@capacitor-firebase/messaging`,
 *      APNs token relayed via FCM on iOS as well — single token surface).
 *   3. POST to `/api/devices/register` with metadata.
 *   4. On FCM token refresh callback → re-register.
 *   5. On logout → DELETE /api/devices/{id}.
 *
 * Foreground delivery: design.md §5.4 says notifications are NEVER
 * silently dropped while the app is open — they always render an in-app
 * toast so the user sees them even if the OS suppresses the banner.
 */
import { Capacitor } from '@capacitor/core';

// ── Public types ──────────────────────────────────────────────────────────

export type Platform = 'ios' | 'android' | 'web';

export interface DeviceRegistration {
  fcm_token: string;
  platform: Platform;
  app_version: string;
  device_model: string;
  /** Device id assigned by backend; cached locally so we can DELETE on logout. */
  device_id?: string;
}

export interface PushPayload {
  title?: string;
  body?: string;
  data?: Record<string, string>;
}

export interface PushBridge {
  isSupported(): boolean;
  requestPermission(): Promise<'granted' | 'denied' | 'prompt'>;
  register(opts: { apiBaseUrl: string; authToken: string; appVersion: string }): Promise<DeviceRegistration | null>;
  unregister(opts: { apiBaseUrl: string; authToken: string }): Promise<void>;
  subscribeTopic(topic: string): Promise<void>;
  unsubscribeTopic(topic: string): Promise<void>;
  onNotification(cb: (payload: PushPayload, opened: boolean) => void): () => void;
}

// ── Implementation ────────────────────────────────────────────────────────

const PREF_DEVICE_ID = 'push.deviceId';
const PREF_FCM_TOKEN = 'push.fcmToken';

let messaging: any = null;
let pushNotifications: any = null;
let preferences: any = null;
let device: any = null;

async function loadDeps() {
  if (!Capacitor.isNativePlatform()) return;
  if (!messaging) {
    try {
      const m = await import('@capacitor-firebase/messaging');
      messaging = (m as any).FirebaseMessaging;
    } catch {
      messaging = null;
    }
  }
  if (!pushNotifications) {
    try {
      const p = await import('@capacitor/push-notifications');
      pushNotifications = (p as any).PushNotifications;
    } catch {
      pushNotifications = null;
    }
  }
  if (!preferences) {
    try {
      const p = await import('@capacitor/preferences');
      preferences = (p as any).Preferences;
    } catch {
      preferences = null;
    }
  }
  if (!device) {
    try {
      const d = await import('@capacitor/device');
      device = (d as any).Device;
    } catch {
      device = null;
    }
  }
}

async function prefGet(key: string): Promise<string | null> {
  if (!preferences) return null;
  const { value } = await preferences.get({ key });
  return value || null;
}

async function prefSet(key: string, value: string): Promise<void> {
  if (!preferences) return;
  await preferences.set({ key, value });
}

async function prefRemove(key: string): Promise<void> {
  if (!preferences) return;
  await preferences.remove({ key });
}

async function platformName(): Promise<Platform> {
  const p = Capacitor.getPlatform();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}

async function deviceModel(): Promise<string> {
  try {
    if (device) {
      const info = await device.getInfo();
      return `${info.manufacturer || ''} ${info.model || ''}`.trim() || 'unknown';
    }
  } catch {
    // fall through
  }
  return navigator.userAgent.slice(0, 80);
}

const listeners = new Set<(p: PushPayload, opened: boolean) => void>();
let listenersWired = false;

async function wireListenersOnce() {
  if (listenersWired) return;
  listenersWired = true;
  if (messaging) {
    messaging.addListener('notificationReceived', (event: any) => {
      const payload: PushPayload = {
        title: event.notification?.title,
        body: event.notification?.body,
        data: event.notification?.data || {},
      };
      listeners.forEach((cb) => cb(payload, false));
    });
    messaging.addListener('notificationActionPerformed', (event: any) => {
      const payload: PushPayload = {
        title: event.notification?.title,
        body: event.notification?.body,
        data: event.notification?.data || {},
      };
      listeners.forEach((cb) => cb(payload, true));
    });
    messaging.addListener('tokenReceived', async (event: any) => {
      // Token refresh → re-register if we have an auth context.
      if (event?.token) {
        await prefSet(PREF_FCM_TOKEN, event.token);
        // Re-registration is the caller's responsibility (they hold the
        // axios instance + auth token). Fire a custom event so app code
        // can react.
        try {
          window.dispatchEvent(
            new CustomEvent('zoho:push:token-refresh', { detail: { token: event.token } }),
          );
        } catch {
          /* SSR safety */
        }
      }
    });
  }
}

export const nativePush: PushBridge = {
  isSupported() {
    return Capacitor.isNativePlatform();
  },

  async requestPermission() {
    await loadDeps();
    if (!messaging) return 'denied';
    const result = await messaging.requestPermissions();
    return result.receive === 'granted' ? 'granted' : 'denied';
  },

  async register({ apiBaseUrl, authToken, appVersion }) {
    await loadDeps();
    if (!messaging) return null;
    const perm = await this.requestPermission();
    if (perm !== 'granted') return null;

    await wireListenersOnce();

    const { token } = await messaging.getToken();
    await prefSet(PREF_FCM_TOKEN, token);

    const payload = {
      fcm_token: token,
      platform: await platformName(),
      app_version: appVersion,
      device_model: await deviceModel(),
    };

    const res = await fetch(`${apiBaseUrl}/api/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // Don't throw — push registration is non-critical. Log via Crashlytics.
      console.warn('[push] registration failed', res.status);
      return null;
    }
    const body = await res.json();
    if (body?.id) {
      await prefSet(PREF_DEVICE_ID, body.id);
    }
    return { ...payload, device_id: body?.id };
  },

  async unregister({ apiBaseUrl, authToken }) {
    await loadDeps();
    const deviceId = await prefGet(PREF_DEVICE_ID);
    if (!deviceId) return;
    try {
      await fetch(`${apiBaseUrl}/api/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
    } catch (e) {
      console.warn('[push] unregister failed', e);
    }
    await prefRemove(PREF_DEVICE_ID);
    await prefRemove(PREF_FCM_TOKEN);
    if (messaging) {
      try {
        await messaging.deleteToken();
      } catch {
        /* ignore */
      }
    }
  },

  async subscribeTopic(topic: string) {
    await loadDeps();
    if (!messaging) return;
    await messaging.subscribeToTopic({ topic });
  },

  async unsubscribeTopic(topic: string) {
    await loadDeps();
    if (!messaging) return;
    await messaging.unsubscribeFromTopic({ topic });
  },

  onNotification(cb) {
    listeners.add(cb);
    // Ensure listeners are wired even if the caller subscribes before
    // calling register() (e.g. global app shell mount order).
    void loadDeps().then(wireListenersOnce);
    return () => listeners.delete(cb);
  },
};

// ── Convenience helpers ───────────────────────────────────────────────────

/**
 * Subscribe to the standard topic set for a freshly-logged-in user. Idempotent.
 *
 * design.md §5.4: tenant_<id>, user_<id>, tenant_<id>_<feature>.
 */
export async function subscribeStandardTopics(opts: {
  tenantId: string;
  userId: string;
  features?: string[];
}): Promise<void> {
  const features = opts.features ?? ['pos', 'invoices', 'inventory'];
  await nativePush.subscribeTopic(`tenant_${opts.tenantId}`);
  await nativePush.subscribeTopic(`user_${opts.userId}`);
  for (const f of features) {
    await nativePush.subscribeTopic(`tenant_${opts.tenantId}_${f}`);
  }
}

export async function unsubscribeStandardTopics(opts: {
  tenantId: string;
  userId: string;
  features?: string[];
}): Promise<void> {
  const features = opts.features ?? ['pos', 'invoices', 'inventory'];
  await nativePush.unsubscribeTopic(`tenant_${opts.tenantId}`);
  await nativePush.unsubscribeTopic(`user_${opts.userId}`);
  for (const f of features) {
    await nativePush.unsubscribeTopic(`tenant_${opts.tenantId}_${f}`);
  }
}

export default nativePush;
