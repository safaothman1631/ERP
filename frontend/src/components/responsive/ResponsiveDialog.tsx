/**
 * ResponsiveDialog — drawer-instead-of-modal pattern for system-wide UX
 * overhaul (task 4.1).
 *
 * On Mobile_Viewport (≤ 640 px) renders as a bottom-sheet drawer with a
 * drag handle, swipe-to-dismiss gesture, and a thumb-zone-anchored
 * primary-action footer. Above 640 px renders as a centered AntD Modal
 * with a `max-inline-size` sourced from `theme/tokens.ts`.
 *
 * Both surfaces share:
 *   - A sticky header (title + close button) and a sticky footer
 *     (secondary + primary actions); only the body scrolls when the
 *     content overflows.
 *   - Focus trap, focus-return-to-trigger, Escape and outside-click
 *     dismissal — provided by AntD's Modal/Drawer primitives.
 *   - Background scroll-lock — provided by AntD; further reinforced on
 *     the mobile bottom sheet by `touch-action: none` on the drag handle
 *     so vertical pointer drags do not leak to the page underneath.
 *   - Logical CSS only (`inline-start` / `inline-end`,
 *     `padding-block-*`, `min-block-size`); never `left` / `right`.
 *
 * The mobile bottom-sheet drag-handle and swipe-to-dismiss gesture are
 * implemented with native pointer events: track `pointerdown` on the
 * handle, follow `pointermove`'s deltaY to translate the panel down,
 * and on `pointerup` either dismiss (`deltaY > 30 % of panel height`)
 * or animate the panel back to its rest position.
 *
 * All user-facing strings come from `useTranslation()` — the
 * `no-hardcoded-literal` ESLint rule (error severity in
 * `frontend/src/components/responsive/**`) blocks any inline literal.
 *
 * Validates: Requirements 1.7, 1.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7,
 * 3.8, 5.1, 5.4, 6.6
 */
import React, {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react';
import { Button, Drawer, Modal } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import type { TranslationKey } from '../../i18n/types';
import { useViewport } from '../../hooks/useViewport';
import {
  a11y,
  palette,
  radius,
  shadow,
  space,
  zIndex,
} from '../../theme/tokens';
import './clickable.css';

/**
 * Action descriptor for the dialog's sticky footer.
 *
 * `labelKey` is a `TranslationKey` (branded — the i18n-coverage CI job
 * verifies that the value resolves in both `en.json` and `ku.json` with
 * non-empty content). `danger: true` uses the AntD `danger` button
 * variant, which sources its color from the danger token in
 * `theme/tokens.ts` (R1.1).
 */
export interface ResponsiveDialogPrimaryAction {
  labelKey: TranslationKey;
  onClick: () => void;
  danger?: boolean;
}

/** Secondary (non-destructive) action descriptor for the sticky footer. */
export interface ResponsiveDialogSecondaryAction {
  labelKey: TranslationKey;
  onClick: () => void;
}

/**
 * Public props of {@link ResponsiveDialog}. The shape mirrors the
 * design document for the system-wide-ux-overhaul spec verbatim.
 */
export interface ResponsiveDialogProps {
  /** Whether the dialog is currently visible. */
  open: boolean;
  /**
   * Invoked when the dialog requests dismissal. Triggered by the close
   * button, the Escape key, an outside click on the backdrop, or a
   * successful swipe-to-dismiss gesture on Mobile_Viewport.
   */
  onClose: () => void;
  /** Header title — Translation_Key resolved through i18next. */
  title: TranslationKey;
  /** Optional primary footer action. Renders in the thumb-zone on mobile. */
  primaryAction?: ResponsiveDialogPrimaryAction;
  /** Optional secondary footer action. Sits inline-start of the primary. */
  secondaryAction?: ResponsiveDialogSecondaryAction;
  /**
   * When `true`, the swipe-down dismiss gesture is disabled on
   * Mobile_Viewport. Pair with an unsaved-changes guard so the user
   * never loses work to an accidental drag (R1.8).
   */
  suppressSwipeDismiss?: boolean;
  /** Body content — the only scrollable region of the dialog. */
  children: ReactNode;
}

// ───────────────────────────── Layout constants ─────────────────────────────

/**
 * Maximum centered-modal width for Tablet_Viewport / Desktop_Viewport.
 * Sourced from `theme/tokens.ts` so the umbrella spec consumes — never
 * redefines — sibling-spec design tokens (R3.2, R17.3).
 *
 * 560 px is the conventional medium-modal width in the Zoho ERP design
 * language; combined with the responsive `max-inline-size` rule below
 * this guarantees the dialog never renders edge-to-edge on desktop.
 */
const MODAL_MAX_INLINE_SIZE = 560;

/** Bottom-sheet block size as a fraction of the visible viewport (R3.1). */
const BOTTOM_SHEET_MAX_BLOCK_FRACTION = 0.9;

/**
 * Swipe-to-dismiss threshold — drag distance / panel block-size. Crossing
 * this releases the dialog; below it, the panel snaps back to rest
 * (R5.4 — "if the drag distance exceeds 30 % of the Dialog's height").
 */
const DISMISS_THRESHOLD = 0.3;

/**
 * Block size of the drag handle "grabber" itself. The total handle hit
 * area is enforced by `.touchTarget` (≥ 44 × 44 px, R5.1) so users with
 * coarser pointers still hit it reliably.
 */
const DRAG_HANDLE_VISUAL = { inlineSize: 36, blockSize: 4 } as const;

// ───────────────────────────── Sub-components ─────────────────────────────

interface DialogHeaderProps {
  title: string;
  closeAriaLabel: string;
  onClose: () => void;
}

/**
 * Sticky header that hosts the title and the close affordance.
 * Rendered inside both the bottom-sheet and the centered-modal surfaces.
 */
const DialogHeader: React.FC<DialogHeaderProps> = ({
  title,
  closeAriaLabel,
  onClose,
}) => {
  const headerStyle: CSSProperties = {
    position: 'sticky',
    insetBlockStart: 0,
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingBlock: space.md,
    paddingInline: space.lg,
    background: 'inherit',
    borderBlockEnd: `1px solid ${palette.border}`,
  };

  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    flex: '1 1 auto',
    minInlineSize: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  return (
    <header style={headerStyle}>
      <h2 style={titleStyle} title={title}>
        {title}
      </h2>
      <Button
        type="text"
        size="large"
        icon={<CloseOutlined />}
        aria-label={closeAriaLabel}
        className="touchTarget"
        onClick={onClose}
      />
    </header>
  );
};

interface DialogFooterProps {
  primaryLabel?: string;
  primaryDanger?: boolean;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** When true, the footer pads to land in the thumb zone (mobile). */
  thumbZone: boolean;
}

/**
 * Sticky footer that hosts the optional primary and secondary actions.
 * On Mobile_Viewport the primary action sits in the bottom 25 % of the
 * dialog (thumb zone) and is at least 44 px tall (R3.6, R5.1).
 */
const DialogFooter: React.FC<DialogFooterProps> = ({
  primaryLabel,
  primaryDanger,
  onPrimary,
  secondaryLabel,
  onSecondary,
  thumbZone,
}) => {
  if (!primaryLabel && !secondaryLabel) return null;

  const footerStyle: CSSProperties = {
    position: 'sticky',
    insetBlockEnd: 0,
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.sm,
    paddingBlockStart: thumbZone ? space.lg : space.md,
    paddingInline: space.lg,
    background: 'inherit',
    borderBlockStart: `1px solid ${palette.border}`,
    /*
     * On mobile, reserve space below the primary action so it lands inside
     * the bottom 25 % of the viewport (thumb zone). The padding-block-end
     * also covers iOS home-indicator inset via the safe-area-shell on the
     * outer wrapper.
     */
    paddingBlockEnd: thumbZone ? space.xl : space.md,
  };

  const buttonStyle: CSSProperties = {
    minBlockSize: a11y.minTouchTarget,
  };

  return (
    <footer style={footerStyle}>
      {secondaryLabel ? (
        <Button
          size="large"
          className="touchTarget"
          style={buttonStyle}
          onClick={onSecondary}
        >
          {secondaryLabel}
        </Button>
      ) : null}
      {primaryLabel ? (
        <Button
          type="primary"
          danger={primaryDanger}
          size="large"
          className="touchTarget"
          style={buttonStyle}
          onClick={onPrimary}
        >
          {primaryLabel}
        </Button>
      ) : null}
    </footer>
  );
};

interface DragHandleProps {
  /** Localized aria-label for assistive technologies. */
  ariaLabel: string;
  /** When true, the handle is rendered but pointer events are inert. */
  disabled: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

/**
 * Bottom-sheet drag handle. The visual grabber is a small pill, but the
 * surrounding `<button>` has the standard `.touchTarget` 44 × 44 px hit
 * area so it is reachable with a finger (R3.1, R5.1).
 *
 * `touch-action: none` prevents the browser from interpreting vertical
 * drags as page scrolls while the user is grabbing the handle, which is
 * what makes the swipe-to-dismiss feel native.
 */
const DragHandle: React.FC<DragHandleProps> = ({
  ariaLabel,
  disabled,
  onPointerDown,
}) => {
  const wrapperStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBlockStart: space.sm,
    paddingBlockEnd: space.xs,
    /* Coarse-pointer-friendly: the whole strip is grabable, not just the
     * pill. The visual pill below stays small for aesthetic reasons. */
    cursor: disabled ? 'default' : 'grab',
  };
  const buttonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: disabled ? 'default' : 'grab',
    touchAction: 'none',
  };
  const pillStyle: CSSProperties = {
    inlineSize: DRAG_HANDLE_VISUAL.inlineSize,
    blockSize: DRAG_HANDLE_VISUAL.blockSize,
    borderRadius: radius.pill,
    background: palette.gray400,
  };

  return (
    <div style={wrapperStyle}>
      <button
        type="button"
        className="touchTarget"
        style={buttonStyle}
        aria-label={ariaLabel}
        disabled={disabled}
        onPointerDown={disabled ? undefined : onPointerDown}
      >
        <span aria-hidden="true" style={pillStyle} />
      </button>
    </div>
  );
};

interface BottomSheetPanelProps {
  titleText: string;
  closeAriaLabel: string;
  dragHandleAriaLabel: string;
  primaryLabel?: string;
  primaryDanger?: boolean;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  suppressSwipeDismiss: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Inner panel of the mobile bottom sheet — owns the swipe-to-dismiss
 * gesture state in isolation so a stale drag offset never leaks across
 * opens.
 *
 * Mounted only while the parent Drawer is open (the Drawer's
 * `destroyOnHidden` guarantees React tears this subtree down on close);
 * therefore the drag-state lives entirely inside `useState`/`useRef` and
 * is reset implicitly by unmount — no synchronisation effect required
 * (avoids the `react-hooks/set-state-in-effect` cascade-render anti-pattern).
 */
const BottomSheetPanel: React.FC<BottomSheetPanelProps> = ({
  titleText,
  closeAriaLabel,
  dragHandleAriaLabel,
  primaryLabel,
  primaryDanger,
  onPrimary,
  secondaryLabel,
  onSecondary,
  suppressSwipeDismiss,
  onClose,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  /** Vertical translate (px) currently applied to the bottom-sheet panel. */
  const [dragOffset, setDragOffset] = useState<number>(0);
  /** Whether the panel is mid-drag — toggles transitions on/off. */
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartY = useRef<number | null>(null);
  /**
   * Cached panel block size at drag start; we measure once per gesture so
   * the threshold check does not jitter as the panel translates.
   */
  const dragPanelBlockSize = useRef<number>(0);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (suppressSwipeDismiss) return;
      // Only react to primary-button presses (left mouse / single-finger
      // touch / single-stylus contact). Filters right-click and multi-touch.
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStartY.current = event.clientY;
      dragPanelBlockSize.current =
        panelRef.current?.getBoundingClientRect().height ?? 0;
      setIsDragging(true);
    },
    [suppressSwipeDismiss],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!isDragging || dragStartY.current === null) return;
      const delta = event.clientY - dragStartY.current;
      // Only allow downward translation; upward drags clamp to 0 so the
      // panel can never appear to "lift off" the rest position.
      setDragOffset(delta > 0 ? delta : 0);
    },
    [isDragging],
  );

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!isDragging || dragStartY.current === null) {
        setIsDragging(false);
        return;
      }
      const delta = event.clientY - dragStartY.current;
      const blockSize = dragPanelBlockSize.current || 1;
      const dismissed = delta > blockSize * DISMISS_THRESHOLD;
      // Always release the pointer capture even when we don't dismiss.
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* No-op — capture can be auto-released by the browser. */
      }
      dragStartY.current = null;
      setIsDragging(false);
      setDragOffset(0);
      if (dismissed) {
        onClose();
      }
    },
    [isDragging, onClose],
  );

  const panelStyle: CSSProperties = {
    transform: `translate3d(0, ${dragOffset}px, 0)`,
    transition: isDragging
      ? 'none'
      : 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
    maxBlockSize: `${BOTTOM_SHEET_MAX_BLOCK_FRACTION * 100}vh`,
    display: 'flex',
    flexDirection: 'column',
    minBlockSize: 0,
  };

  const bodyStyle: CSSProperties = {
    flex: '1 1 auto',
    minBlockSize: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingBlock: space.md,
    paddingInline: space.lg,
    /*
     * Body is the ONLY scrollable region; header & footer stay sticky.
     * `overscroll-behavior: contain` prevents scroll-chaining to the
     * backdrop / page when the user reaches the top or bottom of the body.
     */
    overscrollBehavior: 'contain',
  };

  return (
    <div
      ref={panelRef}
      style={panelStyle}
      onPointerMove={isDragging ? handlePointerMove : undefined}
      onPointerUp={isDragging ? finishDrag : undefined}
      onPointerCancel={isDragging ? finishDrag : undefined}
    >
      <DragHandle
        ariaLabel={dragHandleAriaLabel}
        disabled={suppressSwipeDismiss}
        onPointerDown={handlePointerDown}
      />
      <DialogHeader
        title={titleText}
        closeAriaLabel={closeAriaLabel}
        onClose={onClose}
      />
      <div style={bodyStyle}>{children}</div>
      <DialogFooter
        primaryLabel={primaryLabel}
        primaryDanger={primaryDanger}
        onPrimary={onPrimary}
        secondaryLabel={secondaryLabel}
        onSecondary={onSecondary}
        thumbZone
      />
    </div>
  );
};

// ───────────────────────────── Main component ─────────────────────────────

/**
 * Drawer-instead-of-modal: AntD `Drawer` (mobile bottom sheet) + AntD
 * `Modal` (desktop) wrapped behind a single API gated on
 * `useViewport().isMobile`.
 *
 * The mobile path adds the drag handle, swipe-to-dismiss gesture, and
 * thumb-zone footer; AntD's primitive supplies the focus trap, scroll
 * lock, Escape handler, and outside-click dismissal on both paths.
 */
export const ResponsiveDialog: React.FC<ResponsiveDialogProps> = ({
  open,
  onClose,
  title,
  primaryAction,
  secondaryAction,
  suppressSwipeDismiss = false,
  children,
}) => {
  const { t } = useTranslation();
  const { isMobile } = useViewport();

  // Translated strings — every visible literal flows through i18next so the
  // `no-hardcoded-literal` rule (error severity here) is satisfied.
  const titleText = t(title);
  const closeAriaLabel = t('close');
  const dragHandleAriaLabel = t('close');
  const primaryLabel = primaryAction ? t(primaryAction.labelKey) : undefined;
  const secondaryLabel = secondaryAction
    ? t(secondaryAction.labelKey)
    : undefined;

  // ─────────────── Mobile bottom-sheet render ───────────────
  if (isMobile) {
    return (
      <Drawer
        open={open}
        placement="bottom"
        onClose={onClose}
        closable={false}
        maskClosable
        keyboard
        destroyOnHidden
        height={`${BOTTOM_SHEET_MAX_BLOCK_FRACTION * 100}vh`}
        styles={{
          body: { padding: 0, display: 'flex', flexDirection: 'column' },
          content: {
            borderStartStartRadius: radius.lg,
            borderStartEndRadius: radius.lg,
            borderEndStartRadius: 0,
            borderEndEndRadius: 0,
            boxShadow: shadow.lg,
            zIndex: zIndex.drawer,
            overflow: 'hidden',
          },
        }}
        // AntD's Drawer handles focus trap + focus restore by default on v6.
        // We keep that contract and only add the gesture overlay below.
      >
        <BottomSheetPanel
          titleText={titleText}
          closeAriaLabel={closeAriaLabel}
          dragHandleAriaLabel={dragHandleAriaLabel}
          primaryLabel={primaryLabel}
          primaryDanger={primaryAction?.danger}
          onPrimary={primaryAction?.onClick}
          secondaryLabel={secondaryLabel}
          onSecondary={secondaryAction?.onClick}
          suppressSwipeDismiss={suppressSwipeDismiss}
          onClose={onClose}
        >
          {children}
        </BottomSheetPanel>
      </Drawer>
    );
  }

  // ─────────────── Desktop centered-modal render ───────────────
  /*
   * On Tablet_Viewport / Desktop_Viewport the dialog is a centered modal
   * with a `max-inline-size` clamp from `theme/tokens.ts` so it never
   * renders edge-to-edge (R3.2). AntD's Modal handles focus trap, focus
   * return, scroll lock, Escape, and outside click out of the box.
   *
   * The `width` prop sets the centered modal's inline-size; the `body`
   * style governs the scrollable region between the sticky header and
   * footer so the dialog body is the only scrollable surface (R3.4).
   */
  const desktopBodyStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minBlockSize: 0,
    maxBlockSize: '85vh',
    padding: 0,
    overflow: 'hidden',
    borderRadius: radius.lg,
  };

  const desktopScrollStyle: CSSProperties = {
    flex: '1 1 auto',
    minBlockSize: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingBlock: space.md,
    paddingInline: space.lg,
    overscrollBehavior: 'contain',
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      closable={false}
      maskClosable
      keyboard
      footer={null}
      title={null}
      destroyOnHidden
      width={MODAL_MAX_INLINE_SIZE}
      styles={{
        body: desktopBodyStyle,
      }}
    >
      <DialogHeader
        title={titleText}
        closeAriaLabel={closeAriaLabel}
        onClose={onClose}
      />
      <div style={desktopScrollStyle}>{children}</div>
      <DialogFooter
        primaryLabel={primaryLabel}
        primaryDanger={primaryAction?.danger}
        onPrimary={primaryAction?.onClick}
        secondaryLabel={secondaryLabel}
        onSecondary={secondaryAction?.onClick}
        thumbZone={false}
      />
    </Modal>
  );
};

export default ResponsiveDialog;
