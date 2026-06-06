/**
 * FormDialog — convenience wrapper around ResponsiveDialog for the common
 * "form modal with OK/Cancel buttons" pattern used across the ERP.
 *
 * Migrates the AntD `<Modal onOk={...} onCancel={...}>` pattern to
 * ResponsiveDialog while preserving the same developer ergonomics.
 *
 * Wraps children with `ResponsiveForm` to enforce ≥ 44 px touch targets,
 * ≥ 8 px spacing, and single-column layout on Mobile_Viewport (R4.4, R4.5,
 * R5.1, R5.2).
 *
 * Validates: Requirements 1.5, 1.6, 1.7, 1.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 4.4, 4.5, 5.1, 5.2
 */
import React from 'react';

import { ResponsiveDialog } from './ResponsiveDialog';
import { ResponsiveForm } from './ResponsiveForm';
import type { TranslationKey } from '../../i18n/types';

export interface FormDialogProps {
  /** Whether the dialog is currently visible. */
  open: boolean;
  /** Invoked when the dialog requests dismissal (close button, Escape, backdrop). */
  onClose?: () => void;
  /**
   * Alias for `onClose` (AntD `<Modal onCancel>` ergonomics). Several call sites
   * pass `onCancel` out of habit — accept it so the ✕, Escape, backdrop, and the
   * Cancel button all dismiss the dialog instead of silently no-op'ing when only
   * `onCancel` was provided (the "Cancel/✕ don't close" bug).
   */
  onCancel?: () => void;
  /** Header title — can be a translation key or pre-translated string. */
  title: string;
  /** Primary action handler (e.g., form submit). */
  onOk?: () => void;
  /** Label for the primary action button. Defaults to 'save'. */
  okText?: string;
  /** Label for the secondary action button. Defaults to 'cancel'. */
  cancelText?: string;
  /** Whether the primary action is destructive (renders with danger color). */
  danger?: boolean;
  /** When true, suppresses swipe-to-dismiss for unsaved-changes protection. */
  suppressSwipeDismiss?: boolean;
  /** Whether to hide the footer entirely (e.g., for read-only dialogs). */
  hideFooter?: boolean;
  /** Max width for the dialog (ignored on mobile). */
  width?: number;
  /** Body content. */
  children: React.ReactNode;
}

/**
 * Drop-in replacement for AntD Modal in form contexts. Maps the common
 * `<Modal open onCancel onOk title>` pattern to ResponsiveDialog.
 * Wraps children with ResponsiveForm for mobile-first touch targets and spacing.
 */
export const FormDialog: React.FC<FormDialogProps> = ({
  open,
  onClose,
  onCancel,
  title,
  onOk,
  okText,
  cancelText,
  danger,
  suppressSwipeDismiss = false,
  hideFooter = false,
  children,
}) => {
  // Accept either `onClose` (canonical) or `onCancel` (AntD-style alias). Without
  // this, a call site that passes only `onCancel` left the dismiss handler
  // undefined → the ✕ and Cancel button did nothing.
  const dismiss = onClose ?? onCancel ?? (() => {});
  return (
    <ResponsiveDialog
      open={open}
      onClose={dismiss}
      title={title as TranslationKey}
      suppressSwipeDismiss={suppressSwipeDismiss}
      primaryAction={
        !hideFooter && onOk
          ? {
              labelKey: (okText || 'save') as TranslationKey,
              onClick: onOk,
              danger,
            }
          : undefined
      }
      secondaryAction={
        !hideFooter
          ? {
              labelKey: (cancelText || 'cancel') as TranslationKey,
              onClick: dismiss,
            }
          : undefined
      }
    >
      <ResponsiveForm layout="single">
        {children}
      </ResponsiveForm>
    </ResponsiveDialog>
  );
};

export default FormDialog;
