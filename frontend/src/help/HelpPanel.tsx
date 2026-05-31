/**
 * HelpPanel — universal Help_Panel for the system-wide UX overhaul (task 2.6).
 *
 * Renders the Help_Content for a `sectionId` in the **fixed order**:
 *   1. `what`
 *   2. `why`
 *   3. `relatesTo`  — list of `<Link>` items that navigate via React Router
 *      and scroll the target Section into view.
 *   4. `howSteps`   — numbered, ordered list (length ∈ [2, 7] per registry).
 *
 * Surface adaptation
 * ------------------
 * - Mobile_Viewport (`useViewport().isMobile === true`) — renders inside
 *   {@link ResponsiveDialog}, which already provides the bottom-sheet drawer,
 *   focus trap, scroll lock, Escape dismissal, outside-click dismissal,
 *   close button, and focus-return-to-trigger contract (R3.1–R3.7, R6.6,
 *   R6.7, R14.4).
 * - Tablet_Viewport / Desktop_Viewport — renders as a popover anchored to
 *   the supplied `anchorEl`, portaled to `document.body`, with our own
 *   focus trap / Escape / outside-click / close-button stack so the panel
 *   stays in the correct stacking context regardless of where the
 *   triggering Help_Icon lives in the React tree (R6.6, R6.7, R14.4).
 *
 * `relatesTo` navigation (R6.8)
 * -----------------------------
 * Each `relatesTo` item is a React Router `<Link>` whose `onClick` handler
 * 1. dismisses the panel,
 * 2. delegates routing to React Router via `navigate(route)` (no
 *    `window.location` assignment, so SPA routing is preserved per R1.9),
 * 3. on the next animation frame, locates the target Section's element and
 *    invokes `scrollIntoView({ block: 'start', behavior: prefersReducedMotion
 *    ? 'auto' : 'smooth' })`.
 *
 * Target lookup priority:
 *   (a) URL hash    — `getElementById(hash.slice(1))`
 *   (b) `?s=` query — `[data-section-id="<value>"]`
 *   (c) fallback    — `document.scrollingElement` scrolled to top
 *
 * The `behavior` argument is decided by {@link prefersReducedMotion}, which
 * reads `window.matchMedia('(prefers-reduced-motion: reduce)')` at click
 * time. Browsers that do not implement smooth scrolling fall back to
 * instant scroll, which is the documented native behavior.
 *
 * Lint scope
 * ----------
 * This file lives under `frontend/src/help/**` which is scoped to
 * `zoho-i18n/no-hardcoded-literal` at error severity (see
 * `frontend/eslint.config.js`). Every user-facing literal flows through
 * `t()` against a key in the i18n_Registry. The user-facing keys consumed
 * here (`help`, `close`, `help.panel.related_sections`,
 * `help.panel.how_steps`) are humanized by `parseMissingKeyHandler` until
 * the i18n-coverage CI job (task 7.4) confirms the values are present in
 * both locales (R12.5).
 *
 * _Validates: Requirements 6.3, 6.6, 6.7, 6.8, 14.4_
 */
import React, {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CloseOutlined } from '@ant-design/icons';
import { Button } from 'antd';

import {
  asTranslationKey,
  type TranslationKey,
} from '../i18n/types';
import { useViewport } from '../hooks/useViewport';
import { useHelp, type ResolvedHelp } from './useHelp';
import { ResponsiveDialog } from '../components/responsive/ResponsiveDialog';
import type { SectionId } from './sectionIds';
import {
  a11y,
  palette,
  radius,
  shadow,
  space,
  zIndex,
} from '../theme/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Public props of {@link HelpPanel} — mirrors the design document for the
 * system-wide-ux-overhaul spec verbatim.
 */
export interface HelpPanelProps {
  /** Identifier of the Section whose Help_Content this panel renders. */
  sectionId: SectionId;
  /**
   * The Help_Icon `<button>` that triggered this panel. Used to anchor the
   * desktop popover (`anchorEl.getBoundingClientRect()`) and to receive
   * focus when the panel closes (R6.7, R14.4). Required, as per the design.
   */
  anchorEl: HTMLElement;
  /** Whether the panel is currently visible. */
  open: boolean;
  /**
   * Invoked when the panel requests dismissal. Triggered by the close
   * button, Escape key, outside click, or a `relatesTo` link click.
   */
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal layout constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum inline-size of the desktop popover (px). */
const POPOVER_MAX_INLINE_SIZE = 360;

/** Minimum gap (px) the popover keeps away from the viewport edge. */
const POPOVER_VIEWPORT_GUTTER = 8;

/** Vertical offset (px) between anchor and popover. */
const POPOVER_ANCHOR_OFFSET = 8;

/** Translation key for the panel chrome title. */
const PANEL_TITLE_KEY: TranslationKey = asTranslationKey('help');
/** Translation key for the close button aria-label. */
const CLOSE_LABEL_KEY = 'close';
/** Translation key for the Related Sections subheading. */
const RELATES_TO_HEADING_KEY = 'help.panel.related_sections';
/** Translation key for the How Steps subheading. */
const HOW_STEPS_HEADING_KEY = 'help.panel.how_steps';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Read the OS-level reduced-motion preference at the moment of the call. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Locate the scroll target for a `relatesTo` route, preferring (in order):
 *   (a) URL hash         — `#section` → `getElementById('section')`
 *   (b) `?s=` query      — `?s=taxes` → `[data-section-id="taxes"]`
 *   (c) `null`           — caller scrolls the document to the top instead.
 */
function findScrollTarget(route: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  // Parse the route as a URL relative to the current origin so we can read
  // both `hash` and `searchParams` consistently regardless of leading slash.
  let url: URL;
  try {
    url = new URL(route, window.location.origin);
  } catch {
    return null;
  }
  const hash = url.hash.slice(1);
  if (hash) {
    const byHash = document.getElementById(hash);
    if (byHash) return byHash;
  }
  const sectionParam = url.searchParams.get('s');
  if (sectionParam) {
    const bySection = document.querySelector<HTMLElement>(
      `[data-section-id="${CSS.escape(sectionParam)}"]`,
    );
    if (bySection) return bySection;
  }
  return null;
}

/** Scroll either the located target or the document into view (R6.8). */
function scrollRouteTargetIntoView(route: string): void {
  const target = findScrollTarget(route);
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  if (target) {
    try {
      target.scrollIntoView({ block: 'start', behavior });
    } catch {
      // Older Safari rejects the options object — fall back to the no-arg form.
      target.scrollIntoView();
    }
    return;
  }
  // Fallback: scroll the page to the top so the destination route is at least
  // anchored at its block-start, matching `scrollIntoView({block:'start'})`
  // semantics for a page-level Section.
  if (typeof window !== 'undefined') {
    try {
      window.scrollTo({ top: 0, left: 0, behavior }); /* rtl-ignore */
    } catch {
      window.scrollTo(0, 0);
    }
  }
}

/** Return all tabbable descendants of `container` in document order. */
function getTabbableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  const nodes = container.querySelectorAll<HTMLElement>(selector);
  return Array.from(nodes).filter((el) => {
    // Skip elements that are visually hidden — they cannot receive focus.
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Body content — render order: what → why → relatesTo → howSteps (R6.3)
// ─────────────────────────────────────────────────────────────────────────────

interface HelpPanelBodyProps {
  resolved: ResolvedHelp;
  onRelatesToClick: (route: string) => void;
  /** id used by the surrounding container as `aria-labelledby` target. */
  titleId: string;
  /** Resolved label for the Related-Sections subheading. */
  relatesToHeading: string;
  /** Resolved label for the How-Steps subheading. */
  howStepsHeading: string;
}

/**
 * Renders the four parts of Help_Content in the fixed order required by R6.3.
 * Pure presentation — wrapping it in a sub-component keeps the mobile and
 * desktop surfaces structurally identical so the order invariant holds in
 * both code paths.
 */
const HelpPanelBody: React.FC<HelpPanelBodyProps> = ({
  resolved,
  onRelatesToClick,
  titleId,
  relatesToHeading,
  howStepsHeading,
}) => {
  const sectionStyle: CSSProperties = {
    marginBlockEnd: space.lg,
  };
  const headingStyle: CSSProperties = {
    margin: 0,
    marginBlockEnd: space.xs,
    fontSize: 13,
    fontWeight: 600,
    color: palette.ink700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  };
  const paragraphStyle: CSSProperties = {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.55,
    color: palette.ink900,
  };
  const linkListStyle: CSSProperties = {
    margin: 0,
    paddingInlineStart: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: space.xs,
  };
  const linkStyle: CSSProperties = {
    color: palette.primary500,
    textDecoration: 'none',
    fontSize: 14,
    lineHeight: 1.4,
    display: 'inline-block',
    paddingBlock: 4,
  };
  const stepsListStyle: CSSProperties = {
    margin: 0,
    paddingInlineStart: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: space.xs,
  };
  const stepItemStyle: CSSProperties = {
    fontSize: 14,
    lineHeight: 1.5,
    color: palette.ink900,
  };

  return (
    <div>
      {/* (1) what — visually identified as the panel's primary statement. */}
      <p id={titleId} style={{ ...paragraphStyle, ...sectionStyle, fontWeight: 500 }}>
        {resolved.what}
      </p>

      {/* (2) why — secondary statement, only rendered when present. */}
      {resolved.why ? (
        <p style={{ ...paragraphStyle, ...sectionStyle, color: palette.ink700 }}>
          {resolved.why}
        </p>
      ) : null}

      {/* (3) relatesTo — labelled list of <Link> elements. */}
      {resolved.relatesTo.length > 0 ? (
        <section style={sectionStyle}>
          <h3 style={headingStyle}>{relatesToHeading}</h3>
          <ul style={linkListStyle}>
            {resolved.relatesTo.map((item, index) => (
              <li key={`${item.route}-${index}`}>
                <Link
                  to={item.route}
                  style={linkStyle}
                  onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => {
                    // Honour modifier-clicks (Ctrl/Cmd/Shift/middle) so the
                    // user can open the related Section in a new tab without
                    // dismissing the panel.
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey ||
                      event.button !== 0
                    ) {
                      return;
                    }
                    onRelatesToClick(item.route);
                  }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* (4) howSteps — numbered ordered list. */}
      {resolved.howSteps.length > 0 ? (
        <section style={sectionStyle}>
          <h3 style={headingStyle}>{howStepsHeading}</h3>
          <ol style={stepsListStyle}>
            {resolved.howSteps.map((step, index) => (
              <li key={index} style={stepItemStyle}>
                {step}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Desktop popover — anchored to `anchorEl`, portaled to <body>
// ─────────────────────────────────────────────────────────────────────────────

interface DesktopPopoverProps {
  open: boolean;
  anchorEl: HTMLElement;
  onClose: () => void;
  closeAriaLabel: string;
  titleId: string;
  children: React.ReactNode;
}

/** Computed top-left coordinates for the desktop popover. */
interface PopoverPosition {
  top: number;
  left: number; /* rtl-ignore */
  /** True when the popover is positioned **above** the anchor (flipped). */
  flipped: boolean;
}

/**
 * Compute the popover's `top` / `left` so it sits below the anchor by
 * default, flipping above when there is not enough block-space below, and
 * always staying within the viewport gutters.
 */
function computePopoverPosition(
  anchor: DOMRect,
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
): PopoverPosition {
  const gutter = POPOVER_VIEWPORT_GUTTER;
  // Horizontal: align the popover's inline-start with the anchor, then clamp
  // to the viewport so the panel never overflows either edge. Logical
  // start/end is handled by the outer `dir` on <html>; physical clamping is
  // sufficient because the popover position is computed from physical
  // coordinates regardless of writing direction.
  let left = anchor.left;
  if (left + panel.width + gutter > viewport.width) {
    left = viewport.width - panel.width - gutter;
  }
  if (left < gutter) left = gutter;

  // Vertical: prefer below the anchor; flip above when the popover would
  // overflow the viewport bottom AND there is more space above than below.
  const spaceBelow = viewport.height - anchor.bottom;
  const spaceAbove = anchor.top;
  const wantsBelow = anchor.bottom + POPOVER_ANCHOR_OFFSET + panel.height + gutter <= viewport.height;
  let top: number;
  let flipped = false;
  if (wantsBelow || spaceBelow >= spaceAbove) {
    top = anchor.bottom + POPOVER_ANCHOR_OFFSET;
  } else {
    top = anchor.top - POPOVER_ANCHOR_OFFSET - panel.height;
    flipped = true;
  }
  // Final clamp so the panel never overflows the viewport block edges.
  if (top + panel.height + gutter > viewport.height) {
    top = viewport.height - panel.height - gutter;
  }
  if (top < gutter) top = gutter;
  return { top, left, flipped };
}

/**
 * Self-contained anchored popover for the Tablet_Viewport / Desktop_Viewport
 * surface (R6.6). Owns its own focus trap, Escape handler, outside-click
 * handler, focus-return-to-trigger, and viewport repositioning so the panel
 * stays consistent regardless of which Help_Icon mounted it.
 */
const DesktopPopover: React.FC<DesktopPopoverProps> = ({
  open,
  anchorEl,
  onClose,
  closeAriaLabel,
  titleId,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<PopoverPosition>({
    top: 0,
    left: 0, /* rtl-ignore */
    flipped: false,
  });

  // ── Focus management ───────────────────────────────────────────────────
  // Capture the focus owner at open-time so we can restore focus to the
  // exact element that triggered the panel — even if `anchorEl` itself is
  // a wrapper around the actual <button>. Falls back to `anchorEl` when no
  // active element is recorded.
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current =
      (document.activeElement as HTMLElement | null) ?? anchorEl;

    // Move focus into the panel (focus the panel root so screen-readers
    // announce the dialog title via aria-labelledby). The first tabbable
    // descendant — typically the Close button — receives focus on the next
    // tick so users can dismiss with Enter/Space immediately.
    const panel = panelRef.current;
    if (panel) {
      panel.focus({ preventScroll: true });
      const focusables = getTabbableElements(panel);
      if (focusables.length > 0) {
        focusables[0].focus({ preventScroll: true });
      }
    }
    return () => {
      // Restore focus on close (R6.7, R14.4). If the previous owner has
      // since been unmounted, fall back to `anchorEl`.
      const previous = previousFocusRef.current;
      const restoreTo = previous && document.contains(previous) ? previous : anchorEl;
      if (restoreTo && typeof restoreTo.focus === 'function') {
        restoreTo.focus({ preventScroll: true });
      }
    };
  }, [open, anchorEl]);

  // ── Outside-click and Escape handling ──────────────────────────────────
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (target === null) return;
      if (panelRef.current?.contains(target)) return;
      if (anchorEl.contains(target)) return;
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handlePointerDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handlePointerDown, true);
    };
  }, [open, onClose, anchorEl]);

  // ── Position computation ───────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!open) return undefined;

    const reposition = (): void => {
      const panel = panelRef.current;
      if (!panel) return;
      const anchorRect = anchorEl.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const next = computePopoverPosition(
        anchorRect,
        { width: panelRect.width, height: panelRect.height },
        { width: window.innerWidth, height: window.innerHeight },
      );
      setPosition(next);
    };

    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, anchorEl]);

  // ── Tab-key focus trap ─────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getTabbableElements(panel);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [],
  );

  if (!open || typeof document === 'undefined') return null;

  const panelStyle: CSSProperties = {
    position: 'fixed',
    insetBlockStart: position.top,
    insetInlineStart: position.left,
    inlineSize: POPOVER_MAX_INLINE_SIZE,
    maxInlineSize: `calc(100vw - ${POPOVER_VIEWPORT_GUTTER * 2}px)`,
    maxBlockSize: `calc(100vh - ${POPOVER_VIEWPORT_GUTTER * 2}px)`,
    background: palette.surface,
    border: `1px solid ${palette.border}`,
    borderRadius: radius.lg,
    boxShadow: shadow.lg,
    zIndex: zIndex.popover,
    display: 'flex',
    flexDirection: 'column',
    minBlockSize: 0,
    outline: 'none',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBlock: space.xs,
    paddingInline: space.sm,
    borderBlockEnd: `1px solid ${palette.border}`,
  };

  const bodyStyle: CSSProperties = {
    flex: '1 1 auto',
    minBlockSize: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingBlock: space.md,
    paddingInline: space.lg,
    overscrollBehavior: 'contain',
  };

  const closeButtonStyle: CSSProperties = {
    minBlockSize: a11y.minTouchTarget,
    minInlineSize: a11y.minTouchTarget,
  };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      style={panelStyle}
      onKeyDown={handleKeyDown}
      data-help-panel="desktop"
      data-flipped={position.flipped ? 'true' : 'false'}
    >
      <header style={headerStyle}>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          aria-label={closeAriaLabel}
          style={closeButtonStyle}
          onClick={onClose}
        />
      </header>
      <div style={bodyStyle}>{children}</div>
    </div>,
    document.body,
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Universal Help_Panel. Picks between a mobile bottom-sheet
 * ({@link ResponsiveDialog}) and a desktop anchored popover at runtime via
 * {@link useViewport}. Both surfaces render the body in the fixed order
 * `what → why → relatesTo → howSteps` (R6.3) and consume their text from
 * {@link useHelp}, so the language and content contracts are identical
 * regardless of viewport (R6.4, R6.6).
 */
export const HelpPanel: React.FC<HelpPanelProps> = ({
  sectionId,
  anchorEl,
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const { isMobile } = useViewport();
  const navigate = useNavigate();
  const resolved = useHelp(sectionId);
  const titleId = useId();

  // Resolve chrome strings — body strings come from `useHelp` already-localized.
  const closeAriaLabel = t(CLOSE_LABEL_KEY);
  const relatesToHeading = t(RELATES_TO_HEADING_KEY);
  const howStepsHeading = t(HOW_STEPS_HEADING_KEY);

  /**
   * `relatesTo` click handler:
   *   1. dismiss the panel (focus returns to anchor in the desktop case via
   *      the popover's effect cleanup; the mobile case is handled by
   *      ResponsiveDialog's AntD Drawer focus contract),
   *   2. navigate via React Router (`navigate()` — no `window.location`),
   *   3. on the next animation frame, scroll the target Section into view
   *      with reduced-motion-aware behavior (R6.8).
   */
  const handleRelatesToClick = useCallback(
    (route: string) => {
      onClose();
      navigate(route);
      // Defer the scroll until after the route renders so the destination
      // DOM nodes exist when we look them up. Two RAFs is the well-known
      // pattern that survives both the route-change render and the
      // immediate post-render layout pass.
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            scrollRouteTargetIntoView(route);
          });
        });
      } else {
        scrollRouteTargetIntoView(route);
      }
    },
    [navigate, onClose],
  );

  const body = (
    <HelpPanelBody
      resolved={resolved}
      onRelatesToClick={handleRelatesToClick}
      titleId={titleId}
      relatesToHeading={relatesToHeading}
      howStepsHeading={howStepsHeading}
    />
  );

  // ── Mobile_Viewport — bottom-sheet via ResponsiveDialog ────────────────
  // ResponsiveDialog already provides: drag handle, swipe-to-dismiss, focus
  // trap, scroll lock, Escape, outside-click, close button, and focus-
  // return-to-trigger (its own AntD Drawer contract).
  if (isMobile) {
    return (
      <ResponsiveDialog open={open} onClose={onClose} title={PANEL_TITLE_KEY}>
        {body}
      </ResponsiveDialog>
    );
  }

  // ── Tablet/Desktop — anchored popover (own focus + dismissal stack) ─────
  return (
    <DesktopPopover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      closeAriaLabel={closeAriaLabel}
      titleId={titleId}
    >
      {body}
    </DesktopPopover>
  );
};

export default HelpPanel;
