import React from 'react';
import { Affix, Button, Space, Tag } from 'antd';
import { SaveOutlined, CloseOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { palette, space, radius, layout } from '../theme/tokens';

export interface FormSection {
  key: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}

export interface FormLayoutProps {
  sections: FormSection[];
  /** Save bar state. */
  saving?: boolean;
  saved?: boolean;
  isDirty?: boolean;
  requiredCount?: number;
  /** Handlers. */
  onSave?: () => void | Promise<void>;
  onCancel?: () => void;
  /** Custom extra actions on the save bar (left side). */
  extraActions?: React.ReactNode;
  isDark?: boolean;
}

/**
 * FormLayout — Sprint 6 — sectioned form with sticky save bar + unsaved-guard signal.
 * Sections render as Cards. Save bar pinned to bottom while content scrolls.
 */
export const FormLayout: React.FC<FormLayoutProps> = ({
  sections, saving = false, saved = false, isDirty = false,
  requiredCount, onSave, onCancel, extraActions, isDark = false,
}) => {
  const { t } = useTranslation();
  const sep = isDark ? palette.darkBorder : palette.border;
  const surface = isDark ? palette.darkSurface : palette.surface;

  // beforeunload guard
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg, paddingBottom: 80 }}>
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
            <h3 style={{
              margin: 0,
              fontSize: 16, fontWeight: 600,
              color: isDark ? palette.darkInk : palette.ink900,
            }}>{s.title}</h3>
            {s.description && (
              <div style={{
                marginTop: 4, fontSize: 13,
                color: isDark ? palette.darkInkMuted : palette.ink500,
              }}>{s.description}</div>
            )}
          </header>
          <div>{s.children}</div>
        </section>
      ))}

      <Affix offsetBottom={layout.footerHeight}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: space.md, padding: `${space.md}px ${space.lg}px`,
          background: surface,
          borderTop: `1px solid ${sep}`,
          borderRadius: `${radius.md}px ${radius.md}px 0 0`,
          boxShadow: '0 -4px 12px rgba(15,23,42,0.04)',
        }}>
          <Space size={space.sm}>
            {extraActions}
            {requiredCount !== undefined && requiredCount > 0 && (
              <Tag color="orange">
                {t('form_layout.required_fields', '{{n}} required fields', { n: requiredCount })}
              </Tag>
            )}
            {isDirty && !saving && (
              <Tag color="blue">{t('form_layout.unsaved_changes', 'Unsaved changes')}</Tag>
            )}
            {saving && (
              <span style={{ color: palette.primary500, fontSize: 13 }}>
                <LoadingOutlined /> {t('form_layout.saving', 'Saving...')}
              </span>
            )}
            {saved && !isDirty && !saving && (
              <span style={{ color: palette.success, fontSize: 13 }}>
                <CheckCircleOutlined /> {t('form_layout.saved', 'Saved')}
              </span>
            )}
          </Space>
          <Space size={space.sm}>
            {onCancel && (
              <Button icon={<CloseOutlined />} onClick={onCancel}>
                {t('form_layout.cancel', 'Cancel')}
              </Button>
            )}
            {onSave && (
              <Button
                type="primary" icon={<SaveOutlined />}
                loading={saving} disabled={!isDirty}
                onClick={() => { void onSave(); }}
              >
                {t('form_layout.save', 'Save')}
              </Button>
            )}
          </Space>
        </div>
      </Affix>
    </div>
  );
};

export default FormLayout;

/**
 * useUnsavedChangesGuard — Sprint 6 — hook to enable beforeunload prompt.
 * Use inside form components: `useUnsavedChangesGuard(isDirty);`
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
