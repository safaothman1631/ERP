/**
 * Minimal A/B testing helper.
 *
 * Strategy:
 *  - Cookie `_abc` stores a stable 64-bit visitor ID (hex).
 *  - Variant assignment is a deterministic hash of (visitor_id, experiment_slug).
 *  - Persists 30 days; same visitor always sees the same variant.
 *  - Exposure tracked via Plausible Custom Event `experiment_exposure`.
 *
 * Usage on a page or component (client-side island):
 *
 *   <script>
 *     import { getVariant, trackExposure } from '/src/lib/ab.ts';
 *     const v = getVariant('landing-hero-cta', ['A', 'B']);
 *     trackExposure('landing-hero-cta', v);
 *     document.documentElement.dataset.exp = `landing-hero-cta:${v}`;
 *   </script>
 *
 * Server-side (Astro frontmatter): use `getServerVariant(Astro.cookies, slug, variants)`.
 */

export type Variant = string;

const COOKIE_NAME = '_abc';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Generate a 16-hex-char visitor ID. Browser-safe (crypto.getRandomValues).
 */
function generateVisitorId(): string {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (very rare): time-based
  return (Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0, 16);
}

/**
 * DJB2-style 32-bit hash of a string. Deterministic, fast, no crypto requirement.
 */
function hash32(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(
    new RegExp('(?:^|;\\s*)' + name + '=([^;]*)')
  );
  return match?.[1];
}

function writeCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === 'undefined') return;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie =
    `${name}=${value}; Max-Age=${maxAgeSec}; Path=/; SameSite=Lax${secure}`;
}

/**
 * Get or create the visitor ID cookie.
 */
export function getVisitorId(): string {
  let id = readCookie(COOKIE_NAME);
  if (!id) {
    id = generateVisitorId();
    writeCookie(COOKIE_NAME, id, COOKIE_MAX_AGE);
  }
  return id;
}

/**
 * Pick a variant for the given experiment slug.
 * Deterministic per visitor ID + slug pair.
 */
export function getVariant<V extends Variant = Variant>(
  slug: string,
  variants: readonly V[]
): V {
  if (variants.length === 0) throw new Error('ab: variants must be non-empty');
  const id = getVisitorId();
  const h = hash32(`${id}:${slug}`);
  return variants[h % variants.length] as V;
}

/**
 * Emit a Plausible Custom Event marking exposure.
 * Safe to call multiple times — Plausible dedups in its dashboard.
 */
export function trackExposure(slug: string, variant: Variant): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    plausible?: (event: string, opts?: { props: Record<string, string> }) => void;
    gtag?: (...args: unknown[]) => void;
  };
  try {
    w.plausible?.('experiment_exposure', {
      props: { experiment: slug, variant },
    });
    w.gtag?.('event', 'experiment_exposure', { experiment: slug, variant });
  } catch {
    /* no-op — analytics offline / blocked */
  }
}

/**
 * Emit a conversion event for the experiment. Call from the CTA's click handler.
 */
export function trackConversion(slug: string, variant: Variant): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    plausible?: (event: string, opts?: { props: Record<string, string> }) => void;
    gtag?: (...args: unknown[]) => void;
  };
  try {
    w.plausible?.('experiment_conversion', {
      props: { experiment: slug, variant },
    });
    w.gtag?.('event', 'experiment_conversion', { experiment: slug, variant });
  } catch {
    /* no-op */
  }
}

/**
 * Server-side variant assignment (Astro frontmatter).
 * Reads from Astro.cookies; falls back to a stable hash of the request.
 */
export function getServerVariant<V extends Variant = Variant>(
  cookies: { get: (k: string) => { value?: string } | undefined },
  slug: string,
  variants: readonly V[],
  fallbackSeed?: string
): V {
  if (variants.length === 0) throw new Error('ab: variants must be non-empty');
  let id = cookies.get(COOKIE_NAME)?.value;
  if (!id) {
    // Server can't write a cookie cheaply across all hosts; use a transient seed.
    // The client will mint a real cookie on first interaction.
    id = fallbackSeed ?? 'anon';
  }
  const h = hash32(`${id}:${slug}`);
  return variants[h % variants.length] as V;
}

/**
 * Defined experiments — central registry for type safety.
 */
export const EXPERIMENTS = {
  'landing-hero-cta': ['A', 'B'] as const,
  'pricing-headline': ['A', 'B'] as const,
  'signup-form-fields': ['short', 'long'] as const,
} as const;

export type ExperimentSlug = keyof typeof EXPERIMENTS;
