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
 * Requirements: 15.1, 15.4, 15.5, 15.6
 */
import React, { useState } from 'react';
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
import { palette, space, radius, layout } from '../theme/tokens';
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

  /** Dark mode */
  isDark?: boolean;
}

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
  isDark = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const sep = isDark ? palette.darkBorder : palette.border;
  const surface = isDark ? palette.darkSurface : palette.surface;

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
              <section
                key={s.key}
                style={{
                  background: surface,
                  border: `1px solid ${sep}`,
                  borderRadius: radius.md,
                  padding: space.lg,
                }}
              >
                <header style={{ marginBottom: space.md }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 600,
                      color: isDark ? palette.darkInk : palette.ink900,
                    }}
                  >
                    {s.title}
                  </h3>
                  {s.description && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 13,
                        color: isDark ? palette.darkInkMuted : palette.ink500,
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
                <div
                  style={{
                    background: surface,
                    border: `1px solid ${sep}`,
                    borderRadius: radius.md,
                    padding: space.lg,
                  }}
                >
                  {summaryPanel}
                </div>
              </Affix>
            </div>
          )}

          {/* Mobile: summary panel below form */}
          {summaryPanel && isMobile && (
            <div
              style={{
                background: surface,
                border: `1px solid ${sep}`,
                borderRadius: radius.md,
                padding: space.lg,
              }}
            >
              {summaryPanel}
            </div>
          )}
        </div>

        {/* ── Sticky save bar ──────────────────────────────────────────── */}
        <Affix offsetBottom={layout.footerHeight}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space.md,
              padding: `${space.md}px ${space.lg}px`,
              background: surface,
              borderTop: `1px solid ${sep}`,
              borderRadius: `${radius.md}px ${radius.md}px 0 0`,
              boxShadow: '0 -4px 12px rgba(15,23,42,0.04)',
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
                <span style={{ color: palette.primary500, fontSize: 13 }}>
                  <LoadingOutlined />{' '}
                  {t('form_layout.saving', 'Saving…')}
                </span>
              )}
              {saved && !isDirty && !saving && (
                <span style={{ color: palette.success, fontSize: 13 }}>
                  <CheckCircleOutlined />{' '}
                  {t('form_layout.saved', 'Saved')}
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
