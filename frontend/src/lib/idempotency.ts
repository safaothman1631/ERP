/**
 * Idempotency-Key helper for critical mutations (Wave I4).
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function withIdempotency(headers: Record<string, string> = {}): Record<string, string> {
  return { ...headers, 'Idempotency-Key': newIdempotencyKey() };
}
