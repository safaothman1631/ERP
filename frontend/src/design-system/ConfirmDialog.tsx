import React from 'react';
import { Modal, Typography } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';
import { palette } from '../theme/tokens';

const { Text } = Typography;

export interface ConfirmDialogProps {
  open: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
  danger?: boolean;
  loading?: boolean;
  onOk: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * ConfirmDialog — modal یەکگرتوو بۆ destructive یا critical actions.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, title, description, okText = 'OK', cancelText = 'Cancel',
  danger, loading, onOk, onCancel,
}) => (
  <Modal
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText={okText}
    cancelText={cancelText}
    confirmLoading={loading}
    okButtonProps={{ danger }}
    centered
    destroyOnHidden
    title={
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <ExclamationCircleFilled style={{ color: danger ? palette.danger : palette.warning }} />
        {title}
      </span>
    }
  >
    {description && <Text type="secondary">{description}</Text>}
  </Modal>
);

export default ConfirmDialog;
