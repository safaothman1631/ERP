import React from 'react';
import { Button, Space } from 'antd';
import { useTranslation } from 'react-i18next';

export interface GlassDialogFooterProps {
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  primaryLoading?: boolean;
  primaryDanger?: boolean;
  hideSecondary?: boolean;
}

const GlassDialogFooter: React.FC<GlassDialogFooterProps> = ({
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  primaryLoading,
  primaryDanger,
  hideSecondary,
}) => {
  const { t } = useTranslation();

  return (
    <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
      {!hideSecondary && (
        <Button onClick={onSecondary}>{secondaryLabel ?? t('cancel')}</Button>
      )}
      <Button
        type="primary"
        danger={primaryDanger}
        loading={primaryLoading}
        onClick={onPrimary}
        style={{
          background: primaryDanger ? undefined : 'var(--role-accent, #1F6FEB)',
          borderColor: primaryDanger ? undefined : 'var(--role-accent, #1F6FEB)',
        }}
      >
        {primaryLabel ?? t('save')}
      </Button>
    </Space>
  );
};

export default GlassDialogFooter;
