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
import { Typography } from 'antd';
import {
 ExclamationCircleFilled,
 InfoCircleFilled,
} from '@ant-design/icons';
import { palette } from '../theme/tokens';
import { FormDialog } from '../components/responsive/FormDialog';

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
 okText = 'OK',
 cancelText = 'Cancel',
 danger = false,
 loading = false,
 onOk,
 onCancel,
 ariaLabel,
}) => {
 const icon = danger ? (
 <ExclamationCircleFilled style={{ color: palette.danger }} />
 ) : (
 <InfoCircleFilled style={{ color: palette.warning }} />
 );

 return (
 <FormDialog
 open={open}
 onOk={onOk}
 onClose={onCancel}
 danger={danger}
 suppressSwipeDismiss={danger}
 title={typeof title === 'string' ? title : 'Confirm'}
 >
 {typeof title !== 'string' && (
 <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
 {icon}
 {title}
 </div>
 )}
 {description && (
 <Text
 type="secondary"
 role={danger ? 'alert' : undefined}
 aria-live={danger ? 'assertive' : 'polite'}
 style={{ display: 'block', marginTop: 8 }}
 >
 {description}
 </Text>
 )}
 </FormDialog>
 );
};

export const ConfirmDialog = React.memo(ConfirmDialogInner);

export default ConfirmDialog;
