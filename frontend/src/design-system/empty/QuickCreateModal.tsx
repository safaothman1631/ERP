/**
 * @file QuickCreateModal.tsx
 * @description Class A quick-create modal — used for entities with ≤ 5 required
 * fields. Lazy-loaded by `<SelectWithQuickCreate>` only on first CTA click,
 * per Requirement 13.2.
 *
 * Behavior (Requirement 2):
 *   - Title comes from the registry's `titleKey`.
 *   - First input auto-focuses; focus is trapped (Antd `Modal` does this).
 *   - Submitting POSTs via `config.apiCreate`. Inline errors pin to fields.
 *   - On success: fires telemetry, calls `onSuccess(result)`, closes.
 *   - On dirty cancel: confirmation via `window.confirm`.
 *
 * @see design.md §3.1
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { QUICK_CREATE_REGISTRY } from '../../data/quickCreateRegistry';
import { DynamicForm, buildInitialValues, validate, type FieldErrors } from './DynamicForm';
import { ModalActions } from './ModalActions';
import { useEmptyStateTelemetry } from './useEmptyStateTelemetry';
import { modalEnter, DURATION_NORMAL } from './motion';
import { message } from '../../utils/message';
import type { QuickCreateUIProps, QuickCreateValues, QuickCreateResult } from './types';

/* ---------------------------------------------------------------------------
 * Server error shape (design.md §9.2)
 * ---------------------------------------------------------------------------
 */

interface ServerErrorPayload {
  code?: string;
  status?: number;
  errors?: Array<{ field: string; code?: string; messageKey?: string; message?: string }>;
}

function deriveFieldErrors(err: unknown): FieldErrors {
  const out: FieldErrors = {};
  const payload = (err as { response?: { data?: ServerErrorPayload }; data?: ServerErrorPayload }) ?? {};
  const data = payload.response?.data ?? payload.data;
  if (data?.errors && Array.isArray(data.errors)) {
    for (const e of data.errors) {
      out[e.field] = e.messageKey ?? e.message ?? 'qc.errors.validation';
    }
  }
  return out;
}

function deriveErrorCode(err: unknown): string {
  const payload = (err as { response?: { status?: number; data?: ServerErrorPayload }; code?: string }) ?? {};
  if (payload.response?.data?.code) return payload.response.data.code;
  if (payload.response?.status) return String(payload.response.status);
  if (payload.code) return payload.code;
  return 'unknown';
}

/* ---------------------------------------------------------------------------
 * Hook: query-inheritance prefill
 * ---------------------------------------------------------------------------
 */

function applyQueryInheritance(
  fields: ReadonlyArray<{ name: string }>,
  prefill: { search?: string; fields?: Partial<QuickCreateValues> } | undefined,
  inheritance: { field: string; detectors?: Array<{ field: string; pattern: RegExp }> } | undefined,
): Partial<QuickCreateValues> {
  const explicit = prefill?.fields ?? {};
  if (!prefill?.search) return explicit;

  // Detect a phone/email pattern via registry detectors.
  if (inheritance?.detectors) {
    for (const det of inheritance.detectors) {
      if (det.pattern.test(prefill.search)) {
        return { [det.field]: prefill.search, ...explicit };
      }
    }
  }

  // Fall back to the default field.
  const defaultField = inheritance?.field ?? fields[0]?.name;
  if (defaultField) {
    return { [defaultField]: prefill.search, ...explicit };
  }
  return explicit;
}

/* ---------------------------------------------------------------------------
 * Component
 * ---------------------------------------------------------------------------
 */

export function QuickCreateModal({
  entity,
  open,
  onClose,
  onSuccess,
  prefill,
  context,
}: QuickCreateUIProps): JSX.Element | null {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const config = QUICK_CREATE_REGISTRY[entity];
  const telemetry = useEmptyStateTelemetry({ variant: 'selector', entity, context });

  const openedAtRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);

  const initial = useMemo(
    () => buildInitialValues(config.fields, applyQueryInheritance(config.fields, prefill, config.queryInheritance)),
    [config.fields, prefill, config.queryInheritance],
  );

  const [values, setValues] = useState<QuickCreateValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Reset state when the modal re-opens.
  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
      setValues(initial);
      setErrors({});
      telemetry.fireOpened({ prefilled_field: prefill?.search ? (config.queryInheritance?.field ?? config.fields[0]?.name) : undefined });
    } else {
      // On close, abort any in-flight create.
      abortRef.current?.abort();
      abortRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initial);
  }, [values, initial]);

  const handleCancel = useCallback(() => {
    if (submitting) return;
    if (isDirty) {
      const confirmed = window.confirm(t('qc.confirm_discard', 'Discard your changes?'));
      if (!confirmed) return;
    }
    telemetry.fireCancelled(Date.now() - openedAtRef.current, isDirty);
    onClose();
  }, [submitting, isDirty, onClose, telemetry, t]);

  const handleSubmit = useCallback(async () => {
    const localErrors = validate(config.fields, values);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      telemetry.fireFailed('validation');
      return;
    }
    setErrors({});
    setSubmitting(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = Date.now();
    try {
      const result: QuickCreateResult = await config.apiCreate(values, { signal: controller.signal });
      telemetry.fireSucceeded(Date.now() - startedAt);
      message.success(t('qc.success.created', 'Created successfully'));
      onSuccess(result);
      onClose();
    } catch (err) {
      const code = deriveErrorCode(err);
      if (code === '403') {
        message.error(t('qc.errors.permission', "You don't have permission to create this record"));
      } else {
        const fieldErrors = deriveFieldErrors(err);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
        } else {
          message.error(t('qc.errors.validation', 'Please review the highlighted fields'));
        }
      }
      telemetry.fireFailed(code);
    } finally {
      setSubmitting(false);
      abortRef.current = null;
    }
  }, [config, values, onSuccess, onClose, telemetry, t]);

  const handleFullForm = useCallback(() => {
    telemetry.fireFullFormLink(Date.now() - openedAtRef.current);
    const href = config.fullFormHref + (prefill?.search ? `?name=${encodeURIComponent(prefill.search)}` : '');
    if (typeof window !== 'undefined') {
      window.location.href = href;
    }
  }, [config.fullFormHref, prefill?.search, telemetry]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={<span id={`qc-modal-title-${entity}`}>{t(config.titleKey)}</span>}
      footer={null}
      width={420}
      destroyOnClose
      maskClosable={!isDirty}
      keyboard
      // Antd Modal already supplies role="dialog" + focus trap.
      aria-labelledby={`qc-modal-title-${entity}`}
      data-testid={`quick-create-modal-${entity}`}
    >
      <motion.div
        variants={modalEnter}
        initial={reduce ? false : 'hidden'}
        animate="visible"
        transition={reduce ? { duration: 0.12 } : { duration: DURATION_NORMAL }}
      >
        <DynamicForm
          fields={config.fields}
          values={values}
          errors={errors}
          onChange={setValues}
          onSubmit={handleSubmit}
          disabled={submitting}
          ariaLabelledBy={`qc-modal-title-${entity}`}
        />
        <ModalActions
          primary={{
            labelKey: 'qc.action.create_and_select',
            onClick: handleSubmit,
            loading: submitting,
          }}
          secondary={{
            labelKey: 'qc.action.cancel',
            onClick: handleCancel,
          }}
          link={{
            labelKey: 'qc.action.full_form',
            onClick: handleFullForm,
          }}
        />
      </motion.div>
    </Modal>
  );
}

QuickCreateModal.displayName = 'QuickCreateModal';

export default QuickCreateModal;
