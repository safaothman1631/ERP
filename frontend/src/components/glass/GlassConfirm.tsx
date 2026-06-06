import React from 'react';
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import GlassDialogFooter from './GlassDialogFooter';

export interface GlassConfirmProps {
  open: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const GlassConfirm: React.FC<GlassConfirmProps> = ({
  open,
  title,
  description,
  okText,
  cancelText,
  danger,
  loading,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnHidden
      width={420}
      styles={{ content: { borderRadius: 16 } }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <ExclamationCircleOutlined style={{ fontSize: 22, color: danger ? 'var(--danger-500)' : 'var(--role-accent, #7B61FF)', marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{title ?? t('confirm', 'Confirm')}</div>
          {description && <div style={{ opacity: 0.75, marginBottom: 16 }}>{description}</div>}
          <GlassDialogFooter
            primaryLabel={okText ?? t('confirm', 'Confirm')}
            secondaryLabel={cancelText ?? t('cancel')}
            onPrimary={onConfirm}
            onSecondary={onCancel}
            primaryLoading={loading}
            primaryDanger={danger}
          />
        </div>
      </div>
    </Modal>
  );
};

export default GlassConfirm;
