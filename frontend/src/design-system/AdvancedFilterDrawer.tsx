import React from 'react';
import { Drawer, Button, Space } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

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
 */
export const AdvancedFilterDrawer: React.FC<AdvancedFilterDrawerProps> = ({ open, onClose, onApply, onReset, children, width = 400 }) => {
  const { t } = useTranslation();
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={<><FilterOutlined /> {t('advanced_filters', 'فلتەری پێشکەوتوو')}</>}
      width={width}
      extra={
        <Space>
          {onReset && <Button onClick={onReset}>{t('reset', 'سڕینەوە')}</Button>}
          <Button type="primary" onClick={onApply}>{t('apply', 'جێبەجێکردن')}</Button>
        </Space>
      }
    >
      {children}
    </Drawer>
  );
};

export default AdvancedFilterDrawer;
