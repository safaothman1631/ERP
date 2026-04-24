/**
 * Lightweight in-memory error tracker.
 * Other code calls `errorTracker.report()` on every caught error.
 * The `SupportWidget` polls `recent()` and surfaces a help nudge when
 * the user hits the threshold (default: 3 errors in 60s).
 */

export interface TrackedError {
  ts: number;
  message: string;
  source?: string;
}

class ErrorTracker {
  private events: TrackedError[] = [];
  private listeners = new Set<() => void>();

  report(message: string, source?: string): void {
    this.events.push({ ts: Date.now(), message, source });
    // keep last 50 only
    if (this.events.length > 50) this.events.splice(0, this.events.length - 50);
    this.listeners.forEach(l => { try { l(); } catch { /* swallow */ } });
  }

  recent(windowMs = 60_000): TrackedError[] {
    const cutoff = Date.now() - windowMs;
    return this.events.filter(e => e.ts >= cutoff);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    this.events = [];
    this.listeners.forEach(l => { try { l(); } catch { /* swallow */ } });
  }
}

export const errorTracker = new ErrorTracker();
