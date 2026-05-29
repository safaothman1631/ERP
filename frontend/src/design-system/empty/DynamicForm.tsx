/**
 * @file DynamicForm.tsx
 * @description Renders a quick-create form from a `FieldDef[]` schema.
 *
 * Supported field types: text, tel, email, number, select, textarea, file.
 *
 * This is the SINGLE place where registry field schemas become actual inputs.
 * Higher-level concerns (validation, submission, error pinning, autofocus)
 * live in `<QuickCreateModal>` / `<QuickCreateDrawer>`.
 *
 * @see design.md §3
 */

import { memo, useCallback, useMemo, type ReactNode, type ChangeEvent } from 'react';
import { Form, Input, InputNumber, Select, Upload, Button } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { FieldDef, FieldOption, QuickCreateValues } from './types';

const { TextArea } = Input;

/* ---------------------------------------------------------------------------
 * Field-level error structure — matches the server contract from design.md §9.2.
 * ---------------------------------------------------------------------------
 */

export interface FieldErrors {
  [field: string]: string | undefined;
}

export interface DynamicFormProps {
  fields: ReadonlyArray<FieldDef>;
  values: QuickCreateValues;
  errors?: FieldErrors;
  /** Called with the next values map (NOT just the changed key). */
  onChange: (next: QuickCreateValues) => void;
  /** When provided, hitting Enter inside an input invokes onSubmit. */
  onSubmit?: () => void;
  /** Disable every input — for save-in-progress states. */
  disabled?: boolean;
  className?: string;
  /** Optional aria-labelledby pointing at the modal/drawer title. */
  ariaLabelledBy?: string;
}

/* ---------------------------------------------------------------------------
 * Field renderers
 * ---------------------------------------------------------------------------
 */

function renderOption(opt: FieldOption<string | number>, t: ReturnType<typeof useTranslation>['t']): ReactNode {
  return (
    <Select.Option key={String(opt.value)} value={opt.value}>
      {opt.labelKey ? t(opt.labelKey) : opt.label ?? String(opt.value)}
    </Select.Option>
  );
}

function DynamicFormBase({
  fields,
  values,
  errors,
  onChange,
  onSubmit,
  disabled,
  className,
  ariaLabelledBy,
}: DynamicFormProps): JSX.Element {
  const { t } = useTranslation();

  const handleChange = useCallback(
    (name: string, value: unknown) => {
      onChange({ ...values, [name]: value });
    },
    [values, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
        const target = e.target as HTMLElement;
        // Allow newlines in textareas.
        if (target.tagName.toLowerCase() === 'textarea') return;
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit],
  );

  const items = useMemo(() => fields, [fields]);

  return (
    <Form
      layout="vertical"
      className={['empty-state__dynamic-form', className].filter(Boolean).join(' ')}
      aria-labelledby={ariaLabelledBy}
      onKeyDown={handleKeyDown}
      data-testid="dynamic-form"
    >
      {items.map((field, index) => {
        const value = (values[field.name] ?? field.default) as
          | string
          | number
          | undefined;
        const fieldError = errors?.[field.name];
        const labelText = t(field.labelKey);
        const placeholder = field.placeholderKey ? t(field.placeholderKey) : undefined;
        const isAutoFocus = field.autoFocus ?? index === 0;

        const help = fieldError ?? (field.helpKey ? t(field.helpKey) : undefined);
        const validateStatus: 'error' | undefined = fieldError ? 'error' : undefined;

        return (
          <Form.Item
            key={field.name}
            label={
              <>
                {labelText}
                {field.required ? <span aria-hidden="true" style={{ color: 'var(--ant-color-error, #ff4d4f)', marginInlineStart: 4 }}>*</span> : null}
              </>
            }
            required={field.required}
            validateStatus={validateStatus}
            help={help}
            htmlFor={`qc-field-${field.name}`}
          >
            {field.type === 'select' ? (
              <Select
                id={`qc-field-${field.name}`}
                value={value as string | number | undefined}
                onChange={(v) => handleChange(field.name, v)}
                placeholder={placeholder}
                disabled={disabled || field.disabled}
                autoFocus={isAutoFocus}
                aria-required={field.required ?? false}
                aria-invalid={Boolean(fieldError)}
              >
                {(field.options ?? []).map((opt) => renderOption(opt, t))}
              </Select>
            ) : field.type === 'number' ? (
              <InputNumber
                id={`qc-field-${field.name}`}
                value={value as number | undefined}
                onChange={(v) => handleChange(field.name, v)}
                min={field.min}
                max={field.max}
                placeholder={placeholder}
                disabled={disabled || field.disabled}
                autoFocus={isAutoFocus}
                aria-required={field.required ?? false}
                aria-invalid={Boolean(fieldError)}
                addonAfter={field.suffix}
                style={{ width: '100%' }}
              />
            ) : field.type === 'textarea' ? (
              <TextArea
                id={`qc-field-${field.name}`}
                value={value as string | undefined}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  handleChange(field.name, e.target.value)
                }
                placeholder={placeholder}
                disabled={disabled || field.disabled}
                autoFocus={isAutoFocus}
                maxLength={field.maxLength}
                aria-required={field.required ?? false}
                aria-invalid={Boolean(fieldError)}
                rows={3}
              />
            ) : field.type === 'file' ? (
              <Upload.Dragger
                name={field.name}
                accept={field.accept}
                disabled={disabled || field.disabled}
                beforeUpload={(file) => {
                  handleChange(field.name, file);
                  return false; // prevent auto-upload — caller decides when to POST
                }}
                maxCount={1}
                aria-label={labelText}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">{placeholder ?? t('common.upload_hint', 'Click or drag a file here')}</p>
              </Upload.Dragger>
            ) : (
              <Input
                id={`qc-field-${field.name}`}
                type={field.type === 'tel' || field.type === 'email' ? field.type : 'text'}
                inputMode={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : undefined}
                value={(value as string | undefined) ?? ''}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleChange(field.name, e.target.value)
                }
                placeholder={placeholder}
                disabled={disabled || field.disabled}
                autoFocus={isAutoFocus}
                maxLength={field.maxLength}
                aria-required={field.required ?? false}
                aria-invalid={Boolean(fieldError)}
              />
            )}
          </Form.Item>
        );
      })}
    </Form>
  );
}

export const DynamicForm = memo(DynamicFormBase);
DynamicForm.displayName = 'DynamicForm';

export default DynamicForm;

/* ---------------------------------------------------------------------------
 * Pure helpers — exported for unit tests and modal/drawer consumption.
 * ---------------------------------------------------------------------------
 */

/**
 * Build initial form values from a field schema. The `prefill` map (typically
 * derived from the originating selector's search query and `queryInheritance`)
 * is applied on top.
 */
export function buildInitialValues(
  fields: ReadonlyArray<FieldDef>,
  prefill: Partial<QuickCreateValues> = {},
): QuickCreateValues {
  const out: QuickCreateValues = {};
  for (const f of fields) {
    if (prefill[f.name] !== undefined) {
      out[f.name] = prefill[f.name];
    } else if (f.default !== undefined) {
      out[f.name] = f.default;
    } else {
      out[f.name] = '';
    }
  }
  return out;
}

/**
 * Validate the form values against the schema. Returns a `FieldErrors` map
 * keyed by field name. Empty values for required fields receive the
 * `qc.errors.validation` translation key.
 */
export function validate(
  fields: ReadonlyArray<FieldDef>,
  values: QuickCreateValues,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const f of fields) {
    if (!f.required) continue;
    const v = values[f.name];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
      errors[f.name] = 'qc.errors.validation';
    }
  }
  return errors;
}
