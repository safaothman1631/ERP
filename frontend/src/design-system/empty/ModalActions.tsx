/**
 * @file ModalActions.tsx
 * @description Shared footer actions for `<QuickCreateModal>` and `<QuickCreateDrawer>`.
 *
 * Renders:
 *   1. A primary button ("Create & Select" / "Save")
 *   2. An optional "Save & Add another" link (drawer only)
 *   3. A secondary "Cancel" button
 *   4. A "Full form…" link that navigates to the dedicated create page
 */

import { memo, type ReactNode } from 'react';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';

export interface ButtonDescriptor {
  labelKey: string;
  onClick: () => void;
  /** When true, render with a spinner. */
  loading?: boolean;
  /** When true, render disabled. */
  disabled?: boolean;
  icon?: ReactNode;
}

export interface ModalActionsProps {
  primary: ButtonDescriptor;
  secondary?: ButtonDescriptor;
  /** Drawer-only: persists the record and resets the form. */
  saveAndAddAnother?: ButtonDescriptor;
  /** "Full form…" link — `href` navigates the user to the dedicated route. */
  link?: { labelKey: string; onClick: () => void };
  className?: string;
}

function ModalActionsBase({
  primary,
  secondary,
  saveAndAddAnother,
  link,
  className,
}: ModalActionsProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      className={['empty-state__modal-actions', className].filter(Boolean).join(' ')}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginTop: 16,
      }}
      data-testid="modal-actions"
    >
      {link ? (
        <Button type="link" onClick={link.onClick} data-testid="modal-actions-link">
          {t(link.labelKey)}
        </Button>
      ) : (
        <span />
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {saveAndAddAnother ? (
          <Button
            onClick={saveAndAddAnother.onClick}
            loading={saveAndAddAnother.loading}
            disabled={saveAndAddAnother.disabled}
            data-testid="modal-actions-save-add"
          >
            {t(saveAndAddAnother.labelKey)}
          </Button>
        ) : null}
        {secondary ? (
          <Button
            onClick={secondary.onClick}
            disabled={secondary.disabled || primary.loading}
            data-testid="modal-actions-secondary"
          >
            {t(secondary.labelKey)}
          </Button>
        ) : null}
        <Button
          type="primary"
          onClick={primary.onClick}
          loading={primary.loading}
          disabled={primary.disabled}
          icon={primary.icon}
          data-testid="modal-actions-primary"
        >
          {t(primary.labelKey)}
        </Button>
      </div>
    </div>
  );
}

export const ModalActions = memo(ModalActionsBase);
ModalActions.displayName = 'ModalActions';

export default ModalActions;
