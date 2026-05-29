/**
 * @file QuickCreateDrawer.tsx
 * @description Class B quick-create drawer — used for entities with 5–15 fields,
 * file upload support, and a "Save & Add another" workflow.
 *
 * Behavior (Requirement 3):
 *   - 480px width on desktop, full-width on mobile (Antd Drawer handles this).
 *   - Vertical Steps indicator placeholder on the left edge for long forms (TODO).
 *   - File upload supported via the DynamicForm's `file` field type.
 *   - "Save & Add another" creates the record, fires `onSuccess`, then resets
 *     the form WITHOUT closing the drawer.
 *
 * @see design.md §3.2
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer, Steps } from 'antd';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { QUICK_CREATE_REGISTRY } from '../../data/quickCreateRegistry';
import { DynamicForm, buildInitialValues, validate, type FieldErrors } from './DynamicForm';
import { ModalActions } from './ModalActions';
import { useEmptyStateTelemetry } from './useEmptyStateTelemetry';
import { drawerEnter, DURATION_NORMAL } from './motion';
import { message } from '../../utils/message';
import type { QuickCreateUIProps, QuickCreateValues, QuickCreateResult } from './types';

/* ---------------------------------------------------------------------------
 * Server error helpers (same as QuickCreateModal — duplicated to keep the
 * chunks independently lazy-loadable).
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
 * Component
 * ---------------------------------------------------------------------------
 */

export function QuickCreateDrawer({
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
  const telemetry = useEmptyStateTelemetry({ variant: 'drawer', entity, context });

  const openedAtRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);

  const initial = useMemo(
    () => buildInitialValues(config.fields, prefill?.fields ?? {}),
    [config.fields, prefill?.fields],
  );

  const [values, setValues] = useState<QuickCreateValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
      setValues(initial);
      setErrors({});
      telemetry.fireOpened({});
    } else {
      abortRef.current?.abort();
      abortRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  );

  const handleCancel = useCallback(() => {
    if (submitting) return;
    if (isDirty) {
      const confirmed = window.confirm(t('qc.confirm_discard', 'Discard your changes?'));
      if (!confirmed) return;
    }
    telemetry.fireCancelled(Date.now() - openedAtRef.current, isDirty);
    onClose();
  }, [submitting, isDirty, onClose, telemetry, t]);

  const performSubmit = useCallback(
    async (resetAfter: boolean): Promise<QuickCreateResult | null> => {
      const localErrors = validate(config.fields, values);
      if (Object.keys(localErrors).length > 0) {
        setErrors(localErrors);
        telemetry.fireFailed('validation');
        return null;
      }
      setErrors({});
      setSubmitting(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = Date.now();
      try {
        const result = await config.apiCreate(values, { signal: controller.signal });
        telemetry.fireSucceeded(Date.now() - startedAt);
        message.success(t('qc.success.created', 'Created successfully'));
        onSuccess(result);
        if (resetAfter) {
          setValues(buildInitialValues(config.fields, {}));
        }
        return result;
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
        return null;
      } finally {
        setSubmitting(false);
        abortRef.current = null;
      }
    },
    [config, values, onSuccess, telemetry, t],
  );

  const handleSubmit = useCallback(async () => {
    const result = await performSubmit(false);
    if (result) onClose();
  }, [performSubmit, onClose]);

  const handleSaveAndAdd = useCallback(async () => {
    await performSubmit(true);
  }, [performSubmit]);

  const handleFullForm = useCallback(() => {
    telemetry.fireFullFormLink(Date.now() - openedAtRef.current);
    if (typeof window !== 'undefined') {
      window.location.href = config.fullFormHref;
    }
  }, [config.fullFormHref, telemetry]);

  // ── Optional Steps indicator placeholder (single-step default) ────────
  // For now we render a single step; multi-step support is OQ-4 in design.md.
  const showSteps = config.fields.length > 8;

  if (!open) return null;

  return (
    <Drawer
      open={open}
      onClose={handleCancel}
      title={<span id={`qc-drawer-title-${entity}`}>{t(config.titleKey)}</span>}
      placement="right"
      width={480}
      destroyOnClose
      aria-labelledby={`qc-drawer-title-${entity}`}
      data-testid={`quick-create-drawer-${entity}`}
      footer={
        <ModalActions
          primary={{
            labelKey: 'qc.action.create_and_select',
            onClick: handleSubmit,
            loading: submitting,
          }}
          saveAndAddAnother={{
            labelKey: 'qc.action.save_and_add_another',
            onClick: handleSaveAndAdd,
            disabled: submitting,
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
      }
    >
      <motion.div
        variants={drawerEnter}
        initial={reduce ? false : 'hidden'}
        animate="visible"
        transition={reduce ? { duration: 0.12 } : { duration: DURATION_NORMAL }}
        style={{ display: 'flex', gap: 16 }}
      >
        {showSteps ? (
          <Steps
            direction="vertical"
            size="small"
            current={0}
            items={[{ title: t('qc.steps.basic_info', 'Basic info') }]}
            style={{ width: 120, flexShrink: 0 }}
          />
        ) : null}
        <div style={{ flex: 1 }}>
          <DynamicForm
            fields={config.fields}
            values={values}
            errors={errors}
            onChange={setValues}
            onSubmit={handleSubmit}
            disabled={submitting}
            ariaLabelledBy={`qc-drawer-title-${entity}`}
          />
        </div>
      </motion.div>
    </Drawer>
  );
}

QuickCreateDrawer.displayName = 'QuickCreateDrawer';

export default QuickCreateDrawer;
