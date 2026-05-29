/**
 * Crashlytics wrapper — surfaces a stable API regardless of plugin
 * availability so callers can sprinkle `recordError()` everywhere without
 * dealing with `Capacitor.isNativePlatform()` checks.
 *
 * Spec ref: requirements.md §R5.13, design.md §5.8, tasks.md T-G.5.15.
 *
 * Auto-init on first call (lazy) so dev-time hot reloads don't have to
 * round-trip native init for every page navigation.
 */
import { Capacitor } from '@capacitor/core';

let crashlytics: any = null;
let initialized = false;

async function load() {
  if (initialized) return;
  initialized = true;
  if (!Capacitor.isNativePlatform()) return;
  try {
    const mod = await import('@capacitor-firebase/crashlytics');
    crashlytics = (mod as any).FirebaseCrashlytics;
    // Always-on collection (we set this at build time via Firebase config,
    // but explicit is safer for QA builds).
    await crashlytics.setCrashlyticsCollectionEnabled({ enabled: true });
  } catch (e) {
    console.warn('[crashlytics] plugin not installed', e);
    crashlytics = null;
  }
}

export async function setUserId(userId: string): Promise<void> {
  await load();
  if (!crashlytics) return;
  await crashlytics.setUserId({ userId });
}

export async function setCustomKey(key: string, value: string | number | boolean): Promise<void> {
  await load();
  if (!crashlytics) return;
  await crashlytics.setCustomKey({ key, value: String(value), type: typeof value === 'number' ? 'double' : typeof value === 'boolean' ? 'boolean' : 'string' });
}

export async function log(message: string): Promise<void> {
  await load();
  if (!crashlytics) {
    console.info('[crashlytics:log]', message);
    return;
  }
  await crashlytics.log({ message });
}

/**
 * Record a non-fatal error. Stack traces are captured at the JS layer and
 * forwarded to Crashlytics where they appear as the native equivalent of
 * a non-fatal crash.
 */
export async function recordError(error: unknown, context?: Record<string, unknown>): Promise<void> {
  await load();
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  if (context) {
    for (const [k, v] of Object.entries(context)) {
      await setCustomKey(`ctx.${k}`, typeof v === 'object' ? JSON.stringify(v) : (v as any));
    }
  }
  if (!crashlytics) {
    console.error('[crashlytics:error]', msg, stack);
    return;
  }
  await crashlytics.recordException({
    message: msg,
    stacktrace: stack ? stack.split('\n').map((line) => ({ fileName: 'web', lineNumber: 0, methodName: line.trim() })) : undefined,
  });
}

/** Trigger a synthetic native crash. Use only in dev. */
export async function crashNow(): Promise<void> {
  await load();
  if (!crashlytics) return;
  await crashlytics.crash();
}

export default { setUserId, setCustomKey, log, recordError, crashNow };
