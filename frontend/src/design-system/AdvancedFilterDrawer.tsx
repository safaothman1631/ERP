import React from 'react';
import { Button, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { FormDialog } from '../components/responsive/FormDialog';

export interface AdvancedFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  onReset?: () => void;
  children: React.ReactNode;
  width?: number;
}

/**
 * AdvancedFilterDrawer — Sprint 5 — slide-in drawer for complex filter forms.
 * Now uses ResponsiveDialog (via FormDialog) for mobile-first responsive behavior.
 */
export const AdvancedFilterDrawer: React.FC<AdvancedFilterDrawerProps> = ({ open, onClose, onApply, onReset, children }) => {
  const { t } = useTranslation();
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t('advanced_filters', 'Advanced filters')}
      onOk={onApply}
      okText={t('apply', 'Apply')}
    >
      {children}
      {onReset && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-start' }}>
          <Button onClick={onReset}>{t('reset', 'Reset')}</Button>
        </div>
      )}
    </FormDialog>
  );
};

export default AdvancedFilterDrawer;
