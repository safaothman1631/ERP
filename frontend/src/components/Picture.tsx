/**
 * Picture
 * -------
 * Modern responsive image wrapper for R11.2. Emits a `<picture>` element with
 * `<source>` entries for AVIF and WebP (with a fallback `<img>` in the
 * original format) and a `srcSet` for high-DPI displays.
 *
 * **Convention:** images are placed at `/public/images/<name>.{avif,webp,jpg}`
 * (or `.png`). Build-time conversion is **not** yet wired — the future step
 * is to integrate `vite-imagetools`, which will emit the AVIF and WebP
 * derivatives automatically from a single source asset. Until then, source
 * artists or a build script must produce the three formats by hand.
 *
 * @example
 *   <Picture
 *     src="/images/dashboard-hero.jpg"
 *     alt="پەنل کۆگای داشبۆرد"
 *     widths={[1, 2]}
 *     sizes="(max-width: 768px) 100vw, 50vw"
 *     loading="eager"
 *   />
 *
 * Spec: world-class-performance — R11.2.
 */
import React from 'react';

/** Default density variants — 1x and 2x. Override for 3x hero images. */
const DEFAULT_WIDTHS: ReadonlyArray<1 | 2 | 3> = [1, 2];

export interface PictureProps {
  /** Source path to the FALLBACK image (e.g. `/images/foo.jpg`). */
  src: string;
  /** Required alt text — accessibility. */
  alt: string;
  /**
   * Density variants to emit in the srcSet. Each value `N` becomes a
   * `<file>@Nx.<ext>` entry. Default: `[1, 2]`.
   */
  widths?: ReadonlyArray<1 | 2 | 3>;
  /** Standard `sizes` attribute, passed straight through to `<img>`. */
  sizes?: string;
  /** `loading="lazy"` by default; pass `'eager'` for above-the-fold hero. */
  loading?: 'lazy' | 'eager';
  /** Optional `fetchpriority` hint for the LCP image. */
  fetchPriority?: 'high' | 'low' | 'auto';
  /** Pass-through `width` / `height` for explicit aspect ratio (CLS guard). */
  width?: number;
  height?: number;
  /** Extra className on the `<img>`. */
  className?: string;
  /** Inline style on the `<img>`. */
  style?: React.CSSProperties;
}

/** Split `/path/foo.jpg` into `{ base: '/path/foo', ext: 'jpg' }`. */
function splitPath(src: string): { base: string; ext: string } {
  const lastDot = src.lastIndexOf('.');
  if (lastDot < 0) return { base: src, ext: '' };
  return { base: src.slice(0, lastDot), ext: src.slice(lastDot + 1) };
}

/** Build a comma-separated srcSet across the density variants. */
function buildSrcSet(base: string, ext: string, widths: ReadonlyArray<number>): string {
  return widths
    .map((w) => (w === 1 ? `${base}.${ext} 1x` : `${base}@${w}x.${ext} ${w}x`))
    .join(', ');
}

const Picture: React.FC<PictureProps> = ({
  src,
  alt,
  widths = DEFAULT_WIDTHS,
  sizes,
  loading = 'lazy',
  fetchPriority,
  width,
  height,
  className,
  style,
}) => {
  const { base, ext } = splitPath(src);

  const avifSrcSet = buildSrcSet(base, 'avif', widths);
  const webpSrcSet = buildSrcSet(base, 'webp', widths);
  const fallbackSrcSet = buildSrcSet(base, ext || 'jpg', widths);

  return (
    <picture>
      <source srcSet={avifSrcSet} sizes={sizes} type="image/avif" />
      <source srcSet={webpSrcSet} sizes={sizes} type="image/webp" />
      <img
        src={src}
        srcSet={fallbackSrcSet}
        sizes={sizes}
        alt={alt}
        loading={loading}
        decoding="async"
        // `fetchpriority` is the spec-cased attribute; React 19 accepts the camelCase form.
        fetchPriority={fetchPriority}
        width={width}
        height={height}
        className={className}
        style={style}
      />
    </picture>
  );
};

export default Picture;
