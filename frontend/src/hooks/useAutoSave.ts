/**
 * useAutoSave — auto-saves form drafts every 30 seconds via draftsStore.
 *
 * - Calls `draftsStore.saveDraft(entity, id, formValues)` on a 30-second interval.
 * - Shows an error toast within 3 seconds if auto-save fails.
 * - Cleans up the interval on unmount or when dependencies change.
 *
 * Requirements: 15.3, 15.7
 *
 * @param entity     - Entity type key, e.g. 'invoice', 'bill', 'purchaseOrder'
 * @param id         - Document ID or 'new' for unsaved documents
 * @param formValues - Current form values to persist (should be stable reference or memoized)
 *
 * @example
 *   useAutoSave('invoice', invoiceId ?? 'new', formValues);
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDraftsStore } from '../stores/draftsStore';
import toast from '../design-system/Toast';

/** Auto-save interval in milliseconds (30 seconds per spec requirement 15.3) */
const AUTO_SAVE_INTERVAL_MS = 30_000;

/** Maximum delay before showing the error toast (3 seconds per spec requirement 15.7) */
const ERROR_TOAST_DELAY_MS = 3_000;

export function useAutoSave(
  entity: string,
  id: string,
  formValues: unknown,
): void {
  const saveDraft = useDraftsStore((s) => s.saveDraft);
  const { t } = useTranslation();

  // Keep a ref to the latest formValues so the interval always uses the current value
  // without needing to be recreated on every render.
  const formValuesRef = useRef(formValues);
  useEffect(() => {
    formValuesRef.current = formValues;
  }, [formValues]);

  // Keep refs to entity/id as well to avoid stale closures
  const entityRef = useRef(entity);
  const idRef = useRef(id);
  useEffect(() => { entityRef.current = entity; }, [entity]);
  useEffect(() => { idRef.current = id; }, [id]);

  useEffect(() => {
    const timer = setInterval(() => {
      // Use a timeout to ensure the error toast appears within 3 seconds of failure
      const toastTimer = setTimeout(() => {
        toast.error(t('errors.autoSaveFailed', 'Auto-save failed. Please save manually.'));
      }, ERROR_TOAST_DELAY_MS);

      try {
        saveDraft(entityRef.current, idRef.current, formValuesRef.current);
        // Save succeeded — cancel the error toast
        clearTimeout(toastTimer);
      } catch {
        // saveDraft threw synchronously — the toast will fire after ERROR_TOAST_DELAY_MS
        // (already scheduled above). Nothing more to do here.
      }
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
    // saveDraft and t are stable references from Zustand/i18next — safe to include
  }, [saveDraft, t]);
}

export default useAutoSave;
