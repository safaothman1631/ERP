/**
 * QuickCreateDrawerWithSteps — EP-3 (Phase: Class B drawer entities)
 *
 * Spec: .kiro/specs/empty-state-quick-create/design.md §3.2
 *
 * A polished wrapper over EP-0's basic `<QuickCreateDrawer>` that adds a
 * vertical Antd `Steps` indicator on the left edge for Class B entities
 * whose registry config defines `sections` and whose `fields` count is > 8.
 *
 * Behavior:
 *  - Reads `config.sections: { key, titleKey, fields[] }[]` from the registry.
 *  - Renders Antd `<Steps direction="vertical" />` on the left.
 *  - Right panel renders only the active section's fields.
 *  - Next / Previous buttons inside the form area.
 *  - Final section shows "Create" or "Save & Add another".
 *  - Per-section validation: advancing is blocked when the active section
 *    has errors.
 *  - On "Save & Add another": fires `quick_create.save_and_add_another`,
 *    resets form state, keeps drawer open, focuses first input of section 0.
 *
 * Falls back to EP-0's basic drawer when:
 *  - the entity is Class A,
 *  - the registry entry has no `sections`, or
 *  - the total field count is <= 8.
 *
 * This component does NOT modify the EP-0 `QuickCreateDrawer.tsx` —
 * coordination with EP-0 is documented in `_deltas/EP-3-summary.md`.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer, Form, Button, Space, Steps, message } from 'antd';
import { useTranslation } from 'react-i18next';
// EP-0 provides these. We import as if they exist; if EP-0 lands later,
// these paths are the contract.
import { QuickCreateDrawer } from './QuickCreateDrawer';
import { useEmptyStateTelemetry } from './useEmptyStateTelemetry';
import { QUICK_CREATE_REGISTRY } from '../../data/quickCreateRegistry';
import type { EntitySlug, QuickCreateConfig, FieldDef } from '../../data/quickCreateRegistry';
import { DynamicForm } from './DynamicForm';

export interface QuickCreateDrawerWithStepsProps {
  entity: EntitySlug;
  open: boolean;
  onClose: () => void;
  onSuccess?: (record: { id: string; label: string; raw?: unknown }) => void;
  prefill?: Record<string, unknown> & { search?: string };
}

interface SectionDef {
  key: string;
  titleKey: string;
  fields: FieldDef[];
}

/**
 * Extracts the section definitions from a registry config.
 * If `config.sections` is not defined we synthesize a single "Basic" section
 * out of all fields, but in that case we defer to the basic drawer.
 */
function getSections(config: QuickCreateConfig): SectionDef[] | null {
  // Optional shape — registry entries that don't set sections fall back to basic drawer.
  const sections = (config as unknown as { sections?: SectionDef[] }).sections;
  if (!sections || sections.length === 0) return null;
  // Hydrate each section's `fields[]` if it stores only field names.
  return sections.map((s) => {
    const fields = (s.fields as Array<FieldDef | string>).map((f) =>
      typeof f === 'string'
        ? config.fields.find((cf) => cf.name === f)
        : (f as FieldDef),
    ).filter(Boolean) as FieldDef[];
    return { key: s.key, titleKey: s.titleKey, fields };
  });
}

export function QuickCreateDrawerWithSteps({
  entity,
  open,
  onClose,
  onSuccess,
  prefill,
}: QuickCreateDrawerWithStepsProps) {
  const { t } = useTranslation('common');
  const config = QUICK_CREATE_REGISTRY[entity];
  const sections = useMemo(() => (config ? getSections(config) : null), [config]);

  // If no sections OR field count <= 8 OR Class != 'B', defer to basic drawer.
  if (!config || !sections || config.fields.length <= 8 || config.class !== 'B') {
    return (
      <QuickCreateDrawer
        entity={entity}
        open={open}
        onClose={onClose}
        onSuccess={onSuccess}
        prefill={prefill}
      />
    );
  }

  return (
    <StepsDrawerInner
      entity={entity}
      config={config}
      sections={sections}
      open={open}
      onClose={onClose}
      onSuccess={onSuccess}
      prefill={prefill}
      t={t}
    />
  );
}

interface InnerProps {
  entity: EntitySlug;
  config: QuickCreateConfig;
  sections: SectionDef[];
  open: boolean;
  onClose: () => void;
  onSuccess?: (record: { id: string; label: string; raw?: unknown }) => void;
  prefill?: Record<string, unknown> & { search?: string };
  t: (k: string, fb?: string) => string;
}

function StepsDrawerInner({
  entity,
  config,
  sections,
  open,
  onClose,
  onSuccess,
  prefill,
  t,
}: InnerProps) {
  const [form] = Form.useForm();
  const [activeStep, setActiveStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<number, boolean>>({});
  const openedAt = useRef<number>(Date.now());
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const telemetry = useEmptyStateTelemetry({
    variant: 'selector',
    context: { entity, surface: `qc-drawer-steps/${entity}` },
  });

  // Reset state whenever the drawer is opened.
  useEffect(() => {
    if (open) {
      openedAt.current = Date.now();
      setActiveStep(0);
      setStepErrors({});
      form.resetFields();
      if (prefill) {
        // pre-fill first text field from search query, plus any explicit prefill values.
        const primaryField = config.fields.find((f) => f.autoFocus) ?? config.fields[0];
        if (primaryField && prefill.search && !prefill[primaryField.name]) {
          form.setFieldValue(primaryField.name, prefill.search);
        }
        Object.entries(prefill).forEach(([k, v]) => {
          if (k !== 'search') form.setFieldValue(k, v);
        });
      }
      telemetry.fireOpened?.(entity);
      // Focus the first input shortly after the drawer animates in.
      setTimeout(() => firstInputRef.current?.focus(), 220);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFinalStep = activeStep === sections.length - 1;
  const activeSection = sections[activeStep];

  // Validate ONLY the fields in the current section.
  const validateActiveSection = useCallback(async (): Promise<boolean> => {
    const names = activeSection.fields.map((f) => f.name);
    try {
      await form.validateFields(names);
      setStepErrors((s) => ({ ...s, [activeStep]: false }));
      return true;
    } catch {
      setStepErrors((s) => ({ ...s, [activeStep]: true }));
      return false;
    }
  }, [activeSection, activeStep, form]);

  const onNext = useCallback(async () => {
    if (await validateActiveSection()) {
      setActiveStep((s) => Math.min(s + 1, sections.length - 1));
    }
  }, [validateActiveSection, sections.length]);

  const onPrev = useCallback(() => {
    setActiveStep((s) => Math.max(0, s - 1));
  }, []);

  const handleClose = useCallback(() => {
    const dirty = form.isFieldsTouched();
    const elapsed = Date.now() - openedAt.current;
    telemetry.fireCancelled?.(entity, elapsed, dirty);
    onClose();
  }, [form, entity, onClose, telemetry]);

  const performSave = useCallback(
    async (mode: 'create' | 'save_and_add_another'): Promise<boolean> => {
      // Validate every section in order; on first failure jump there.
      for (let i = 0; i < sections.length; i++) {
        const names = sections[i].fields.map((f) => f.name);
        try {
          await form.validateFields(names);
          setStepErrors((s) => ({ ...s, [i]: false }));
        } catch {
          setStepErrors((s) => ({ ...s, [i]: true }));
          setActiveStep(i);
          return false;
        }
      }
      const values = form.getFieldsValue();
      setSubmitting(true);
      try {
        const ctx = { signal: new AbortController().signal };
        const result = await config.apiCreate(values, ctx as { signal: AbortSignal });
        const elapsed = Date.now() - openedAt.current;
        telemetry.fireSucceeded?.(entity, elapsed);
        if (mode === 'save_and_add_another') {
          // Telemetry event for this dedicated path (Task T-E.3.5).
          telemetry.fire?.('quick_create.save_and_add_another', { entity });
          // Reset and keep drawer open, focus first input again.
          form.resetFields();
          setActiveStep(0);
          setStepErrors({});
          openedAt.current = Date.now();
          message.success(t('saved', 'Saved'));
          setTimeout(() => firstInputRef.current?.focus(), 50);
        } else {
          onSuccess?.(result);
          onClose();
        }
        return true;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code ?? 'unknown';
        telemetry.fireFailed?.(entity, code);
        message.error(t('error', 'Something went wrong'));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [sections, form, config, entity, telemetry, onSuccess, onClose, t],
  );

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      placement="end"
      width={680}
      title={t(config.titleKey ?? `qc.${entity}.title`, entity)}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={handleClose}>{t('common.cancel', 'Cancel')}</Button>
          <Space>
            <Button onClick={onPrev} disabled={activeStep === 0 || submitting}>
              {t('common.previous', 'Previous')}
            </Button>
            {!isFinalStep && (
              <Button type="primary" onClick={onNext} disabled={submitting}>
                {t('common.next', 'Next')}
              </Button>
            )}
            {isFinalStep && (
              <>
                <Button
                  onClick={() => performSave('save_and_add_another')}
                  loading={submitting}
                  data-testid="qc-drawer-save-and-add-another"
                >
                  {t('qc.action.save_and_add_another', 'Save & Add another')}
                </Button>
                <Button
                  type="primary"
                  onClick={() => performSave('create')}
                  loading={submitting}
                  data-testid="qc-drawer-create"
                >
                  {t('qc.action.create_and_select', 'Create')}
                </Button>
              </>
            )}
          </Space>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: 24, height: '100%' }}>
        <div style={{ flex: '0 0 200px', borderInlineEnd: '1px solid var(--border-color, #f0f0f0)', paddingInlineEnd: 16 }}>
          <Steps
            direction="vertical"
            current={activeStep}
            onChange={async (i) => {
              // Allow free navigation to any step; validate current first if moving forward.
              if (i > activeStep) {
                if (!(await validateActiveSection())) return;
              }
              setActiveStep(i);
            }}
            items={sections.map((s, i) => ({
              key: s.key,
              title: t(s.titleKey, s.key),
              status: stepErrors[i] ? 'error' : i === activeStep ? 'process' : i < activeStep ? 'finish' : 'wait',
            }))}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Form form={form} layout="vertical" initialValues={prefill}>
            <DynamicForm
              fields={activeSection.fields}
              form={form}
              entity={entity}
              firstInputRef={firstInputRef}
            />
          </Form>
        </div>
      </div>
    </Drawer>
  );
}

export default QuickCreateDrawerWithSteps;
