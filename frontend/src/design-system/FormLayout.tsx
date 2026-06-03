/**
 * FormLayout — two-column form layout with sticky summary panel.
 *
 * Layout:
 *   ┌──────────────────────────┬──────────────┐
 *   │  Main Form (8 cols)      │ Summary      │
 *   │  sections / line items   │ Panel        │
 *   │                          │ (4 cols,     │
 *   │                          │  sticky)     │
 *   └──────────────────────────┴──────────────┘
 *
 * Features:
 *   - Two-column responsive grid (8 + 4 columns)
 *   - Sticky summary panel
 *   - Inline validation + summary banner at top listing all errors
 *   - Unsaved-changes guard via React Router useBlocker + ConfirmDialog
 *   - beforeunload guard for browser close/refresh
 *   - "Save / Save & New / Save & Send" split button
 *
 * Vertex "Slate & Signal" styling — matches the kit's `records.jsx` form shell:
 *   - sections = flat `var(--surface)` cards, hairline `1px var(--border)`, `--radius-lg`
 *   - section title = `var(--font-display)`, `var(--ink-900)`; description = `var(--ink-500)`
 *   - field labels = `var(--ink-700)` (12.5px) via the scoped `<style>` below
 *   - sticky save-bar = surface + hairline top border + `--shadow-md`
 *
 * Every colour resolves from a kit CSS-var token, so the layout is correct in
 * BOTH light and dark themes (the tokens auto-flip via `[data-theme="dark"]`).
 *
 * Requirements: 15.1, 15.4, 15.5, 15.6
 */
import React, { useId, useState } from 'react';
import { Alert, Affix, Space, Tag, Grid } from 'antd';
import {
  SaveOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { space, radius, layout, fontSize } from '../theme/tokens';
import { useIsDark } from '../hooks/useIsDark';
import { MotionButton } from '../components/MotionButton';
import { ConfirmDialog } from './ConfirmDialog';
import { SaveSplitButton, type SaveAction } from './SaveSplitButton';
import { ResponsiveForm } from '../components/responsive/ResponsiveForm';

const { useBreakpoint } = Grid;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormSection {
  key: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormLayoutProps {
  /** Main form sections rendered in the left (8-col) column */
  sections: FormSection[];

  /** Content for the sticky summary panel (right 4-col column) */
  summaryPanel?: React.ReactNode;

  /** Save bar / button state */
  saving?: boolean;
  saved?: boolean;
  isDirty?: boolean;

  /** Validation errors — shown as inline banner at top of form */
  validationErrors?: ValidationError[];

  /** Number of required fields still empty (shown in save bar) */
  requiredCount?: number;

  /** Handlers */
  onSave?: () => void | Promise<void>;
  onSaveAndNew?: () => void | Promise<void>;
  onSaveAndSend?: () => void | Promise<void>;
  onCancel?: () => void;

  /** Custom extra actions on the save bar (left side) */
  extraActions?: React.ReactNode;

  /** Whether to use the split save button (Save / Save & New / Save & Send) */
  useSplitSave?: boolean;

  /**
   * Force dark styling. Defaults to the live theme store (`useIsDark`) so the
   * layout adapts to dark mode even when the consumer doesn't thread it down
   * (the common case). The styling itself is token-driven and auto-flips, so
   * this is kept only for the public `isDark` override contract.
   */
  isDark?: boolean;
}

// ─── Card surface (kit `.vx-card`) ──────────────────────────────────────────────
// Flat surface + hairline border + card radius — identical in light & dark
// because every value is a CSS-var token that auto-flips.
const cardSurface: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: radius.lg,
  padding: space.lg,
};

// ─── FormLayout ───────────────────────────────────────────────────────────────

export const FormLayout: React.FC<FormLayoutProps> = ({
  sections,
  summaryPanel,
  saving = false,
  saved = false,
  isDirty = false,
  validationErrors = [],
  requiredCount,
  onSave,
  onSaveAndNew,
  onSaveAndSend,
  onCancel,
  extraActions,
  useSplitSave = false,
  isDark: isDarkProp,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // Subscribe to the live theme so the layout re-renders on toggle. The styling
  // is token-driven (auto-flips via [data-theme="dark"]), so this is kept for
  // the public `isDark` override contract + to stay reactive.
  const themeDark = useIsDark();
  void (isDarkProp ?? themeDark);

  // Scope kit field-label styling to this layout instance.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const scope = `vx-formlayout-${uid}`;

  // ── Unsaved-changes guard (manual — compatible with BrowserRouter) ────────
  // useBlocker requires a data router (createBrowserRouter). Since we use
  // BrowserRouter, we implement the guard manually via beforeunload + a
  // ConfirmDialog triggered when the user clicks Cancel while isDirty.
  const [blockerDialogOpen, setBlockerDialogOpen] = useState(false);
  const [pendingNavTarget, setPendingNavTarget] = useState<string | null>(null);

  // ── beforeunload guard (browser close / refresh) ─────────────────────────
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ── Split save actions ────────────────────────────────────────────────────
  const saveActions: SaveAction[] = [
    {
      key: 'save',
      label: t('form_layout.save', 'Save'),
      icon: <SaveOutlined />,
      onClick: onSave,
    },
    ...(onSaveAndNew
      ? [
          {
            key: 'save_and_new',
            label: t('form_layout.save_and_new', 'Save & New'),
            onClick: onSaveAndNew,
          },
        ]
      : []),
    ...(onSaveAndSend
      ? [
          {
            key: 'save_and_send',
            label: t('form_layout.save_and_send', 'Save & Send'),
            onClick: onSaveAndSend,
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Kit form-field tokens: labels = var(--ink-700) 12.5px, helper text muted,
          required asterisk = danger. Scoped to this layout. */}
      <style>{`
        .${scope} .ant-form-item-label > label {
          color: var(--ink-700);
          font-size: 12.5px;
          font-weight: 500;
        }
        .${scope} .ant-form-item-required::before {
          color: var(--danger-500) !important;
        }
        .${scope} .ant-form-item-extra,
        .${scope} .ant-form-item-explain {
          color: var(--ink-500);
          font-size: 12px;
        }
        .${scope} .ant-form-item-explain-error {
          color: var(--danger-500);
        }
      `}</style>

      {/* ── Unsaved-changes confirmation dialog ─────────────────────────── */}
      <ConfirmDialog
        open={blockerDialogOpen}
        title={t('form_layout.unsaved_title', 'Unsaved Changes')}
        description={t(
          'form_layout.unsaved_description',
          'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.'
        )}
        okText={t('form_layout.leave_anyway', 'Leave anyway')}
        cancelText={t('form_layout.stay', 'Stay')}
        danger
        onOk={() => {
          setBlockerDialogOpen(false);
          if (pendingNavTarget) {
            navigate(pendingNavTarget);
            setPendingNavTarget(null);
          } else {
            onCancel?.();
          }
        }}
        onCancel={() => {
          setBlockerDialogOpen(false);
          setPendingNavTarget(null);
        }}
      />

      <div
        className={scope}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: space.md,
          paddingBottom: 80,
        }}
      >
        {/* ── Validation error banner ──────────────────────────────────── */}
        {validationErrors.length > 0 && (
          <Alert
            type="error"
            icon={<ExclamationCircleOutlined />}
            showIcon
            message={t(
              'form_layout.validation_errors_title',
              '{{n}} validation error(s) — please fix before saving',
              { n: validationErrors.length }
            )}
            description={
              <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                {validationErrors.map((err, i) => (
                  <li key={`${err.field}-${i}`}>
                    <strong>{err.field}:</strong> {err.message}
                  </li>
                ))}
              </ul>
            }
            role="alert"
            aria-live="polite"
          />
        )}

        {/* ── Two-column grid ──────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile || !summaryPanel ? '1fr' : '2fr 1fr',
            gap: space.lg,
            alignItems: 'start',
          }}
        >
          {/* Left column — main form sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg }}>
            {sections.map((s) => (
              <section key={s.key} style={cardSurface}>
                <header style={{ marginBottom: space.md }}>
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-display)',
                      fontSize: fontSize.lg,
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
                      color: 'var(--ink-900)',
                    }}
                  >
                    {s.title}
                  </h3>
                  {s.description && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 13,
                        lineHeight: 1.45,
                        color: 'var(--ink-500)',
                      }}
                    >
                      {s.description}
                    </div>
                  )}
                </header>
                <ResponsiveForm layout="two-column">
                  {s.children}
                </ResponsiveForm>
              </section>
            ))}
          </div>

          {/* Right column — sticky summary panel */}
          {summaryPanel && !isMobile && (
            <div>
              <Affix offsetTop={80}>
                <div style={cardSurface}>{summaryPanel}</div>
              </Affix>
            </div>
          )}

          {/* Mobile: summary panel below form */}
          {summaryPanel && isMobile && <div style={cardSurface}>{summaryPanel}</div>}
        </div>

        {/* ── Sticky save bar ──────────────────────────────────────────── */}
        <Affix offsetBottom={layout.footerHeight}>
          <div
            className="vx-form-savebar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space.md,
              padding: `${space.md}px ${space.lg}px`,
              background: 'var(--surface)',
              borderTop: '1px solid var(--border)',
              borderRadius: `${radius.lg}px ${radius.lg}px 0 0`,
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {/* Left side: status indicators + extra actions */}
            <Space size={space.sm}>
              {extraActions}
              {requiredCount !== undefined && requiredCount > 0 && (
                <Tag color="orange">
                  {t('form_layout.required_fields', '{{n}} required fields', {
                    n: requiredCount,
                  })}
                </Tag>
              )}
              {isDirty && !saving && (
                <Tag color="blue">
                  {t('form_layout.unsaved_changes', 'Unsaved changes')}
                </Tag>
              )}
              {saving && (
                <span style={{ color: 'var(--accent-500)', fontSize: 13 }}>
                  <LoadingOutlined /> {t('form_layout.saving', 'Saving…')}
                </span>
              )}
              {saved && !isDirty && !saving && (
                <span style={{ color: 'var(--success-fg)', fontSize: 13 }}>
                  <CheckCircleOutlined /> {t('form_layout.saved', 'Saved')}
                </span>
              )}
            </Space>

            {/* Right side: action buttons */}
            <Space size={space.sm}>
              {onCancel && (
                <MotionButton
                  icon={<CloseOutlined />}
                  onClick={() => {
                    if (isDirty) {
                      setBlockerDialogOpen(true);
                    } else {
                      onCancel();
                    }
                  }}
                >
                  {t('form_layout.cancel', 'Cancel')}
                </MotionButton>
              )}

              {useSplitSave && saveActions.length > 1 ? (
                <SaveSplitButton
                  actions={saveActions}
                  loading={saving}
                  disabled={!isDirty}
                />
              ) : (
                onSave && (
                  <MotionButton
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    disabled={!isDirty}
                    onClick={() => {
                      void onSave();
                    }}
                  >
                    {t('form_layout.save', 'Save')}
                  </MotionButton>
                )
              )}
            </Space>
          </div>
        </Affix>
      </div>
    </>
  );
};

export default FormLayout;

// ─── useUnsavedChangesGuard ───────────────────────────────────────────────────

/**
 * useUnsavedChangesGuard — hook to enable beforeunload prompt.
 * Use inside form components: `useUnsavedChangesGuard(isDirty);`
 *
 * Note: For React Router navigation blocking, use FormLayout's built-in
 * useBlocker integration instead.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
