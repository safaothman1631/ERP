/**
 * Firebase Analytics wrapper.
 *
 * Spec ref: design.md §5.8 (Crashlytics + Analytics). We use Analytics for
 * funnel telemetry (onboarding completion, POS conversion, etc.) — NOT for
 * advertising. Consent state is honored: if `consent.analytics` is false
 * in the user's profile, every event is dropped before reaching native.
 */
import { Capacitor } from '@capacitor/core';

let analytics: any = null;
let initialized = false;
let consentGranted = true;

async function load() {
  if (initialized) return;
  initialized = true;
  if (!Capacitor.isNativePlatform()) return;
  try {
    const mod = await import('@capacitor-firebase/analytics');
    analytics = (mod as any).FirebaseAnalytics;
    await analytics.setEnabled({ enabled: consentGranted });
  } catch (e) {
    console.warn('[analytics] plugin not installed', e);
    analytics = null;
  }
}

export async function setConsent(granted: boolean): Promise<void> {
  consentGranted = granted;
  await load();
  if (!analytics) return;
  await analytics.setEnabled({ enabled: granted });
}

export async function logEvent(name: string, params?: Record<string, unknown>): Promise<void> {
  if (!consentGranted) return;
  await load();
  if (!analytics) {
    console.info('[analytics]', name, params);
    return;
  }
  await analytics.logEvent({ name, params: params || {} });
}

export async function setUserId(userId: string | null): Promise<void> {
  await load();
  if (!analytics) return;
  await analytics.setUserId({ userId });
}

export async function setUserProperty(key: string, value: string | null): Promise<void> {
  await load();
  if (!analytics) return;
  await analytics.setUserProperty({ key, value });
}

export async function setCurrentScreen(name: string): Promise<void> {
  await load();
  if (!analytics) return;
  await analytics.setCurrentScreen({ screenName: name });
}

export default { setConsent, logEvent, setUserId, setUserProperty, setCurrentScreen };
