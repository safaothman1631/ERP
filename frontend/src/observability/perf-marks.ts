/**
 * perf-marks
 * ----------
 * Thin wrappers around the User Timing API (`performance.mark` and
 * `performance.measure`) with a no-op fallback for environments where
 * `performance` or its methods are unavailable (older test environments,
 * SSR, restrictive embedded WebViews).
 *
 * Use these to instrument hot paths and feed the RUM ingest (R6.1, R4.7).
 *
 * @example
 *   import { mark, measure } from '@/observability/perf-marks';
 *
 *   mark('pos:print:start');
 *   await printer.print(commands);
 *   mark('pos:print:end');
 *   const ms = measure('pos:print', 'pos:print:start', 'pos:print:end');
 *   if (ms != null && ms > 200) {
 *     // warn — R4.7 budget exceeded
 *   }
 *
 * Spec: world-class-performance — R4.7, R6.1, design §2.5.
 */

/** True if the runtime exposes a usable `performance.mark` implementation. */
const HAS_PERFORMANCE: boolean =
  typeof performance !== 'undefined' &&
  typeof performance.mark === 'function' &&
  typeof performance.measure === 'function';

/**
 * Record a named timestamp. Silently no-ops on environments without User
 * Timing (so it is safe to sprinkle through library code).
 *
 * @param name - A stable identifier, conventionally `domain:event[:phase]`,
 *               e.g. `'pos:print:start'`, `'app:boot:hydrated'`.
 */
export function mark(name: string): void {
  if (!HAS_PERFORMANCE) return;
  try {
    performance.mark(name);
  } catch {
    // Some browsers throw on duplicate mark names in detached contexts —
    // never let instrumentation crash the caller.
  }
}

/**
 * Measure the elapsed milliseconds between two previously-recorded marks.
 *
 * @param name      - Identifier for the resulting `PerformanceMeasure` entry.
 * @param startMark - Name of the start mark created via `mark(...)`.
 * @param endMark   - Name of the end mark created via `mark(...)`.
 * @returns The measured duration in milliseconds, or `null` if either mark
 *          was missing or the runtime does not support User Timing.
 */
export function measure(
  name: string,
  startMark: string,
  endMark: string,
): number | null {
  if (!HAS_PERFORMANCE) return null;
  try {
    const entry = performance.measure(name, startMark, endMark);
    // Some polyfills return `undefined` for `performance.measure`'s return
    // value; in that case, look the entry up by name.
    if (entry && typeof entry.duration === 'number') {
      return entry.duration;
    }
    const found = performance.getEntriesByName(name).pop();
    return found && typeof found.duration === 'number' ? found.duration : null;
  } catch {
    return null;
  }
}

/**
 * Clear marks and measures for a given prefix. Useful inside long-lived
 * components that record per-interaction timings — left unbounded, the entry
 * buffer would slowly grow.
 *
 * @param prefix - When provided, only entries whose name starts with this
 *                 string are removed. When omitted, all marks/measures
 *                 created via this module are removed.
 */
export function clear(prefix?: string): void {
  if (!HAS_PERFORMANCE) return;
  try {
    if (prefix) {
      for (const entry of performance.getEntriesByType('mark')) {
        if (entry.name.startsWith(prefix)) performance.clearMarks(entry.name);
      }
      for (const entry of performance.getEntriesByType('measure')) {
        if (entry.name.startsWith(prefix)) performance.clearMeasures(entry.name);
      }
    } else {
      performance.clearMarks();
      performance.clearMeasures();
    }
  } catch {
    // noop
  }
}
