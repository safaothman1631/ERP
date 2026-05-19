/**
 * `ResponsiveChart` — legend-reflow wrapper around recharts'
 * `<ResponsiveContainer>` (system-wide-ux-overhaul, task 4.4).
 *
 * The umbrella spec mandates two things every chart in the product must
 * do, regardless of which recharts primitive it uses internally:
 *
 *   1. Render with 100 % inline width and a minimum visible block size
 *      of 240 px on Mobile_Viewport (default; configurable via
 *      `minMobileBlockSize`). _Requirement 4.6._
 *
 *   2. Reflow the legend below the chart and allow it to wrap onto
 *      multiple rows when its intrinsic single-row inline-size exceeds
 *      the chart container's inline-size. The "does not fit"
 *      determination is made by **measuring** the legend's intrinsic
 *      width with `ResizeObserver` — never by sniffing the user agent.
 *      _Requirement 4.7._
 *
 * How the measurement works
 * -------------------------
 * A hidden "ghost" copy of the legend is rendered with
 * `position: absolute; visibility: hidden; white-space: nowrap;
 * flex-wrap: nowrap;` so the browser lays it out on a single row at its
 * **intrinsic** inline-size — independent of the visible legend's
 * current wrap state. A `ResizeObserver` watches both:
 *
 *   - the chart container's `contentRect.width` — the inline-size we
 *     have to fit into; and
 *   - the ghost legend's `contentRect.width` — the inline-size the
 *     legend would take on a single row.
 *
 * When `intrinsicLegendInlineSize > containerInlineSize` the visible
 * legend switches to `flex-wrap: wrap` and the chips lay out across
 * multiple rows. When the relation flips back the legend returns to a
 * single nowrap row. The legend always renders **below** the chart so
 * the chart's plotting area is never compressed by a side legend
 * (design.md → "Responsive Patterns Catalog" → "ResponsiveChart").
 *
 * Lint contract
 * -------------
 * This file lives under `frontend/src/components/responsive/**` which is
 * scoped to the `zoho-i18n/no-hardcoded-literal` ESLint rule at error
 * severity. Every user-facing string flows through `t()` against an
 * i18n_Registry key (`labelKey` on each legend item). The component has
 * no copy of its own.
 *
 * Logical-CSS only — no `left` / `right` / `margin-left` /
 * `padding-right`. _Requirements 3.8, 14.7._
 *
 * No UA detection — the wrap decision is purely a measurement.
 * _Requirements 4.1, 4.5, 4.7._
 *
 * _Validates: Requirements 4.6, 4.7_
 */
import React, {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';

import type { TranslationKey } from '../../i18n/types';
import { useViewport } from '../../hooks/useViewport';

import './responsiveChart.css';

// ───────────────────────────── Public types ─────────────────────────────

/**
 * Single legend chip descriptor. The label is a `TranslationKey`
 * (branded — verified by the `i18n-coverage` CI job to resolve in both
 * `en.json` and `ku.json`); the color is a CSS color value typically
 * sourced from `theme/tokens.ts` so the legend stays in sync with the
 * chart's series colors (R17.3).
 */
export interface ResponsiveChartLegendItem {
  /** Stable id — used as the React key for the legend chip. */
  id: string;
  /** Translation_Key resolved through `t()` for the visible label. */
  labelKey: TranslationKey;
  /** Color of the swatch — typically the same color as the chart series. */
  color: string;
}

/**
 * Public props of {@link ResponsiveChart}. Mirrors the design document
 * verbatim with one simplification: the design lists a `data` prop that
 * is never consumed by the wrapper itself (the chart instance passed via
 * `children` already owns its own data), so it is omitted here. Consumers
 * that need a `data` prop should pass it directly to the chart child.
 */
export interface ResponsiveChartProps {
  /**
   * Legend items, in display order. Pass an empty array to render the
   * chart without a legend; the wrapper will skip the legend region and
   * its measurement work entirely.
   */
  legendItems: ResponsiveChartLegendItem[];

  /**
   * Minimum visible block size in CSS pixels on Mobile_Viewport. Defaults
   * to 240 px per R4.6. The wrapper enforces this as a `min-block-size`
   * on its surface; recharts' `<ResponsiveContainer>` then fills the
   * surface, so the chart has at least this much vertical room to draw.
   */
  minMobileBlockSize?: number;

  /**
   * The chart instance. Wrapped in `<ResponsiveContainer width="100%"
   * height="100%">` automatically, so consumers should pass a recharts
   * primitive (`<LineChart>`, `<BarChart>`, `<PieChart>`, etc.) directly
   * — without their own `<ResponsiveContainer>`.
   *
   * Important: the chart child should NOT include a `<Legend>` of its
   * own. The wrapper renders the legend itself so it can measure intrinsic
   * width and reflow per R4.7.
   */
  children: ReactNode;

  /** Optional className composed onto the wrapper. */
  className?: string;

  /** Optional inline style merged onto the wrapper. */
  style?: CSSProperties;

  /**
   * Optional `data-testid` attribute. Forwarded as-is to the wrapper.
   * Allowed by the `no-hardcoded-literal` rule (test scaffolding).
   */
  testId?: string;

  /**
   * Optional aspect ratio (`inline-size / block-size`) used on viewports
   * above Mobile_Viewport. Defaults to `16 / 9` so the chart's plotting
   * area scales gracefully with the container's inline-size.
   *
   * On Mobile_Viewport the wrapper ignores this and pins the chart's
   * block-size to `minMobileBlockSize` so the chart never collapses below
   * R4.6's 240 px floor.
   */
  aspect?: number;
}

// ───────────────────────────── Constants ─────────────────────────────

/**
 * Default minimum visible block size on Mobile_Viewport (R4.6).
 * Configurable per call site via the `minMobileBlockSize` prop.
 */
const DEFAULT_MIN_MOBILE_BLOCK_SIZE = 240;

/**
 * Default aspect ratio above Mobile_Viewport. 16 / 9 reads as a typical
 * landscape chart and matches the recharts examples in the existing
 * dashboards (e.g., DashboardView, MarketingDashboard).
 */
const DEFAULT_ASPECT_RATIO = 16 / 9;

// ───────────────────────────── Sub-components ─────────────────────────────

interface LegendChipProps {
  /** Already-resolved label string (consumer translates via `t()`). */
  label: string;
  /** Series color for the swatch. */
  color: string;
}

/**
 * One legend chip — a colored swatch followed by the translated label.
 * Pure presentational; both the visible legend and the ghost-measurement
 * legend reuse this same component so the intrinsic measurement matches
 * the visible layout exactly.
 */
const LegendChip: React.FC<LegendChipProps> = ({ label, color }) => {
  const swatchStyle: CSSProperties = { background: color };
  return (
    <span className="responsive-chart__legend-item">
      <span
        aria-hidden="true"
        className="responsive-chart__legend-swatch"
        style={swatchStyle}
      />
      <span>{label}</span>
    </span>
  );
};

// ───────────────────────────── Main component ─────────────────────────────

/**
 * Resize-driven legend-reflow wrapper around recharts'
 * `<ResponsiveContainer>`. See module-level JSDoc for the full contract.
 */
export const ResponsiveChart: React.FC<ResponsiveChartProps> = ({
  legendItems,
  minMobileBlockSize = DEFAULT_MIN_MOBILE_BLOCK_SIZE,
  children,
  className,
  style,
  testId,
  aspect = DEFAULT_ASPECT_RATIO,
}) => {
  const { t } = useTranslation();
  const { isMobile } = useViewport();

  // Resolve every legend item's label once per render — the resolved
  // strings drive both the visible legend and the ghost legend used for
  // intrinsic-width measurement.
  const resolvedLegend = useMemo(
    () =>
      legendItems.map((item) => ({
        id: item.id,
        label: t(item.labelKey),
        color: item.color,
      })),
    [legendItems, t],
  );

  // ─────────────── Intrinsic-vs-container measurement ───────────────

  /**
   * `wrapLegend === true` → visible legend uses `flex-wrap: wrap`.
   * `wrapLegend === false` → visible legend stays on a single row.
   *
   * Default to `false` so the SSR / first-paint output never leaks an
   * unnecessary multi-row legend. The first measurement after mount
   * corrects the value if the legend does not actually fit.
   */
  const [wrapLegend, setWrapLegend] = useState<boolean>(false);

  /** Container surface — used to read the chart's inline-size. */
  const containerRef = useRef<HTMLDivElement | null>(null);
  /** Hidden ghost legend — used to read the legend's intrinsic inline-size. */
  const ghostRef = useRef<HTMLDivElement | null>(null);

  /**
   * Single ResizeObserver watching both the container and the ghost.
   * Every `entries` callback recomputes `intrinsicLegendInlineSize >
   * containerInlineSize` from the live measurements; React state only
   * updates when the boolean actually flips, so re-renders stay minimal.
   *
   * `useLayoutEffect` fires synchronously after DOM mutations so the
   * very first measurement happens before the browser paints — preventing
   * a one-frame flash where the legend is on a single row even though it
   * does not fit.
   */
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.ResizeObserver !== 'function') return;

    const containerEl = containerRef.current;
    const ghostEl = ghostRef.current;
    if (!containerEl || !ghostEl) return;

    // No legend → no measurement work needed.
    if (resolvedLegend.length === 0) {
      if (wrapLegend) setWrapLegend(false);
      return;
    }

    const recompute = (): void => {
      const containerInlineSize = containerEl.getBoundingClientRect().width;
      const intrinsicLegendInlineSize = ghostEl.getBoundingClientRect().width;
      // Strict `>` per design.md: only wrap when the legend genuinely
      // overflows the container; equal sizes stay on a single row.
      const shouldWrap = intrinsicLegendInlineSize > containerInlineSize;
      setWrapLegend((prev) => (prev === shouldWrap ? prev : shouldWrap));
    };

    // Initial measurement — the first frame after layout.
    recompute();

    const observer = new ResizeObserver(recompute);
    observer.observe(containerEl);
    observer.observe(ghostEl);

    return () => observer.disconnect();
    // `wrapLegend` is intentionally omitted from the dep array — it is
    // updated inside the observer callback and re-running the effect
    // whenever it flips would tear the observer down and rebuild it on
    // every wrap transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedLegend]);

  /**
   * Fallback for environments without ResizeObserver (older test
   * harnesses, server-side rendering). We attach a `window.resize`
   * listener as a coarse approximation; the measurement still uses
   * the live DOM widths so a viewport resize recomputes correctly.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.ResizeObserver === 'function') return;
    if (resolvedLegend.length === 0) return;

    const recompute = (): void => {
      const containerEl = containerRef.current;
      const ghostEl = ghostRef.current;
      if (!containerEl || !ghostEl) return;
      const containerInlineSize = containerEl.getBoundingClientRect().width;
      const intrinsicLegendInlineSize = ghostEl.getBoundingClientRect().width;
      const shouldWrap = intrinsicLegendInlineSize > containerInlineSize;
      setWrapLegend((prev) => (prev === shouldWrap ? prev : shouldWrap));
    };

    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [resolvedLegend]);

  // ─────────────── Composed styles ───────────────

  const wrapperClass = className
    ? `responsive-chart ${className}`
    : 'responsive-chart';

  /*
   * Block-size strategy:
   *   - Mobile_Viewport: pin to `minMobileBlockSize` (R4.6) so the chart
   *     stays visible regardless of the parent grid's row sizing.
   *   - Above Mobile_Viewport: use `aspect-ratio` so the chart scales with
   *     the container's inline-size while keeping a stable shape.
   */
  const surfaceStyle: CSSProperties = isMobile
    ? {
        blockSize: minMobileBlockSize,
        minBlockSize: minMobileBlockSize,
      }
    : {
        aspectRatio: `${aspect}`,
        minBlockSize: minMobileBlockSize,
      };

  const legendClass = wrapLegend
    ? 'responsive-chart__legend responsive-chart__legend--wrap'
    : 'responsive-chart__legend responsive-chart__legend--nowrap';

  // ─────────────── Render ───────────────

  return (
    <div
      ref={containerRef}
      className={wrapperClass}
      style={style}
      data-testid={testId}
    >
      <div className="responsive-chart__surface" style={surfaceStyle}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>

      {resolvedLegend.length > 0 ? (
        <>
          {/*
           * Visible legend — rendered below the chart per design.md so
           * the plotting area is never compressed by a side legend. The
           * `flex-wrap` value is driven by `wrapLegend`, which itself is
           * driven by the ResizeObserver-based measurement above.
           */}
          <ul className={legendClass} role="list">
            {resolvedLegend.map((item) => (
              <li
                key={item.id}
                className="responsive-chart__legend-item-wrapper"
              >
                <LegendChip label={item.label} color={item.color} />
              </li>
            ))}
          </ul>

          {/*
           * Ghost legend — laid out on a single nowrap row so its
           * `getBoundingClientRect().width` is the legend's intrinsic
           * inline-size. `aria-hidden` and `visibility: hidden` keep it
           * out of the accessibility tree and out of paint; it exists
           * solely so the ResizeObserver has a stable measurement target.
           */}
          <div
            ref={ghostRef}
            aria-hidden="true"
            className="responsive-chart__legend-ghost"
          >
            {resolvedLegend.map((item) => (
              <LegendChip
                key={item.id}
                label={item.label}
                color={item.color}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default ResponsiveChart;
