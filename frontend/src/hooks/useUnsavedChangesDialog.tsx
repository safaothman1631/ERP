/**
 * useUnsavedChangesDialog — unsaved-changes guard using ResponsiveDialog.
 *
 * Since the project uses BrowserRouter (not createBrowserRouter), React
 * Router's `useBlocker` is not available. This hook provides:
 *   1. A `beforeunload` handler for browser close/refresh.
 *   2. A `confirmNavigation(target?)` function that opens a confirmation
 *      ResponsiveDialog when `isDirty` is true.
 *   3. A `<UnsavedChangesDialog />` component to render in the tree.
 *
 * The confirmation dialog uses `suppressSwipeDismiss` so the user cannot
 * accidentally dismiss it with a swipe gesture on mobile (R1.8).
 *
 * Validates: Requirements 1.7, 1.8
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { ResponsiveDialog } from '../components/responsive/ResponsiveDialog';
import type { TranslationKey } from '../i18n/types';

export interface UseUnsavedChangesDialogOptions {
  /** Whether the form currently has unsaved changes. */
  isDirty: boolean;
  /** Optional callback invoked when the user confirms discarding changes. */
  onDiscard?: () => void;
}

export interface UseUnsavedChangesDialogReturn {
  /**
   * Call this before navigating away or closing a dialog with unsaved
   * changes. If `isDirty` is true, opens the confirmation dialog and
   * stores the optional navigation target. If `isDirty` is false,
   * navigates immediately (or calls `onDiscard`).
   */
  confirmNavigation: (target?: string) => boolean;
  /** The dialog element to render in the component tree. */
  UnsavedChangesDialog: React.FC;
}

export function useUnsavedChangesDialog({
  isDirty,
  onDiscard,
}: UseUnsavedChangesDialogOptions): UseUnsavedChangesDialogReturn {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  // beforeunload guard for browser close/refresh
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const confirmNavigation = useCallback(
    (target?: string): boolean => {
      if (!isDirty) {
        if (target) navigate(target);
        onDiscard?.();
        return true;
      }
      setPendingTarget(target ?? null);
      setDialogOpen(true);
      return false;
    },
    [isDirty, navigate, onDiscard],
  );

  const handleDiscard = useCallback(() => {
    setDialogOpen(false);
    if (pendingTarget) {
      navigate(pendingTarget);
      setPendingTarget(null);
    }
    onDiscard?.();
  }, [navigate, onDiscard, pendingTarget]);

  const handleStay = useCallback(() => {
    setDialogOpen(false);
    setPendingTarget(null);
  }, []);

  const UnsavedChangesDialog: React.FC = useCallback(
    () => (
      <ResponsiveDialog
        open={dialogOpen}
        onClose={handleStay}
        title={'form_layout.unsaved_title' as TranslationKey}
        suppressSwipeDismiss
        primaryAction={{
          labelKey: 'form_layout.leave_anyway' as TranslationKey,
          onClick: handleDiscard,
          danger: true,
        }}
        secondaryAction={{
          labelKey: 'form_layout.stay' as TranslationKey,
          onClick: handleStay,
        }}
      >
        <p>{t('form_layout.unsaved_description')}</p>
      </ResponsiveDialog>
    ),
    [dialogOpen, handleDiscard, handleStay, t],
  );

  return { confirmNavigation, UnsavedChangesDialog };
}

export default useUnsavedChangesDialog;
