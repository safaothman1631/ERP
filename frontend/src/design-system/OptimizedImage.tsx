import React, { useState } from 'react';

export interface OptimizedImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'loading'> {
  /** Primary image source (can be WebP or any format) */
  src: string;
  /** Fallback src if the primary fails (e.g. JPEG/PNG when WebP is unsupported) */
  fallbackSrc?: string;
  /** Alt text — required for accessibility */
  alt: string;
  /**
   * Responsive sizes attribute for the browser's resource selection algorithm.
   * Example: "(max-width: 768px) 100vw, 50vw"
   */
  sizes?: string;
  /**
   * srcSet for responsive images.
   * Example: "/img/photo-400.webp 400w, /img/photo-800.webp 800w"
   */
  srcSet?: string;
  /** Width in pixels — helps browser reserve layout space (reduces CLS) */
  width?: number | string;
  /** Height in pixels — helps browser reserve layout space (reduces CLS) */
  height?: number | string;
  /**
   * Loading strategy.
   * - "lazy" (default): deferred loading via native browser lazy loading
   * - "eager": load immediately (use for above-the-fold images)
   */
  loading?: 'lazy' | 'eager';
  /** Optional CSS class for the wrapper div */
  wrapperClassName?: string;
  /** Optional inline style for the wrapper div */
  wrapperStyle?: React.CSSProperties;
  /** Called when the image finishes loading */
  onLoad?: () => void;
  /** Called when the image fails to load */
  onError?: () => void;
}

/**
 * OptimizedImage — image optimization component (داواکاری ٥.٧)
 *
 * تایبەتمەندییەکان:
 *  - native lazy loading (`loading="lazy"` by default)
 *  - WebP support with automatic fallback
 *  - responsive sizes via `srcSet` + `sizes`
 *  - explicit width/height to prevent CLS (Cumulative Layout Shift)
 *  - graceful error handling with fallback src
 *  - `decoding="async"` for non-blocking image decode
 *  - `fetchpriority="low"` for lazy images (browser hint)
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  fallbackSrc,
  alt,
  sizes,
  srcSet,
  width,
  height,
  loading = 'lazy',
  wrapperClassName,
  wrapperStyle,
  onLoad,
  onError,
  style,
  className,
  ...rest
}) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError && fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setHasError(true);
    }
    onError?.();
  };

  const handleLoad = () => {
    onLoad?.();
  };

  return (
    <div
      className={wrapperClassName}
      style={{
        display: 'inline-block',
        overflow: 'hidden',
        ...wrapperStyle,
      }}
    >
      <img
        {...rest}
        src={currentSrc}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        // fetchpriority is a valid HTML attribute but not yet in React's types
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        fetchpriority={loading === 'lazy' ? 'low' : 'high'}
        onError={handleError}
        onLoad={handleLoad}
        style={{
          maxWidth: '100%',
          height: 'auto',
          display: 'block',
          ...style,
        }}
        className={className}
      />
    </div>
  );
};

export default OptimizedImage;
