/**
 * ConfirmDialog — danger/neutral confirmation modal.
 *
 * Features:
 * - Danger variant (red OK button) for destructive actions
 * - Neutral variant for informational confirmations
 * - Accessible:, aria-modal, focus trap via AntD Modal
 * - RTL-aware
 * - Loading state on OK button
 *
 * Requirements: 15.10, 17.6, 17.7
 */
import React from 'react';
import { Modal, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
 ExclamationCircleFilled,
 InfoCircleFilled,
} from '@ant-design/icons';
import { palette } from '../theme/tokens';

const { Text } = Typography;

export interface ConfirmDialogProps {
 /** Whether the dialog is visible */
 open: boolean;
 /** Dialog title */
 title: React.ReactNode;
 /** Optional body description */
 description?: React.ReactNode;
 /** OK button label — defaults to 'OK' */
 okText?: React.ReactNode;
 /** Cancel button label — defaults to 'Cancel' */
 cancelText?: React.ReactNode;
 /**
 * Danger variant — renders the OK button in red.
 * Use for destructive actions (delete, discard, etc.)
 */
 danger?: boolean;
 /** Whether the OK button is in loading state */
 loading?: boolean;
 /** Called when the user confirms */
 onOk: () => void | Promise<void>;
 /** Called when the user cancels or closes the dialog */
 onCancel: () => void;
 /**
 * Optional accessible label for the dialog.
 * Defaults to the title text if not provided.
 */
 ariaLabel?: string;
}

/**
 * ConfirmDialog — modal یەکگرتوو بۆ destructive یا critical actions.
 * + aria-modal + aria-label per WCAG AA — Requirements: 15.10, 17.6, 17.7
 * React.memo applied per Requirements 18.4.
 *
 * @example
 * <ConfirmDialog
 * open={open}
 * title="Delete Invoice"
 * description="This action cannot be undone."
 * danger
 * okText="Delete"
 * onOk={handleDelete}
 * onCancel={() => setOpen(false)}
 * />
 */
const ConfirmDialogInner: React.FC<ConfirmDialogProps> = ({
 open,
 title,
 description,
 okText,
 cancelText,
 danger = false,
 loading = false,
 onOk,
 onCancel,
 ariaLabel,
}) => {
 const { t } = useTranslation();
 const icon = danger ? (
 <ExclamationCircleFilled style={{ color: palette.danger }} />
 ) : (
 <InfoCircleFilled style={{ color: palette.warning }} />
 );

 // A small CENTERED glass Modal on every viewport (the bottom-sheet form
 // dialog was the wrong shape for a tiny confirm — the user wanted the
 // mobile confirm to look like the laptop's centered glass card). The
 // `vx-confirm-modal` class keeps it centered on mobile (overriding the
 // global modal→bottom-sheet rule); the glass styling is global in
 // vertex-kit.css. Danger → red OK button.
 return (
 <Modal
 open={open}
 onOk={onOk}
 onCancel={onCancel}
 okText={okText ?? t('ok', 'OK')}
 cancelText={cancelText ?? t('cancel', 'Cancel')}
 okButtonProps={{ danger, loading }}
 confirmLoading={loading}
 centered
 width={440}
 className="vx-confirm-modal"
 aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
 title={
 <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
 {icon}
 {title}
 </span>
 }
 >
 {description && (
 <Text
 type="secondary"
 role={danger ? 'alert' : undefined}
 aria-live={danger ? 'assertive' : 'polite'}
 style={{ display: 'block' }}
 >
 {description}
 </Text>
 )}
 </Modal>
 );
};

export const ConfirmDialog = React.memo(ConfirmDialogInner);

export default ConfirmDialog;
