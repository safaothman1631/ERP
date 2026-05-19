import React from 'react';
import { Input, Select, Space, Tooltip } from 'antd';
import { SearchOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { space } from '../theme/tokens';
import { MotionButton } from '../components/MotionButton';

export interface FilterDef {
  key: string;
  label: string;
  options: { label: string; value: string | number }[];
  multiple?: boolean;
}

export interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  filters?: FilterDef[];
  values?: Record<string, unknown>;
  onChange?: (values: Record<string, unknown>) => void;
  extra?: React.ReactNode;
  onReset?: () => void;
  onRefresh?: () => void;
}

/**
 * FilterBar — search + filters + actions. Standard UX pattern لە هەموو list pages.
 * React.memo applied per Requirements 18.4.
 */
const FilterBarInner: React.FC<FilterBarProps> = ({
  searchPlaceholder, searchValue, onSearchChange,
  filters = [], values = {}, onChange,
  extra, onReset, onRefresh,
}) => {
  const { t } = useTranslation();
  const setVal = React.useCallback((k: string, v: unknown) => onChange?.({ ...values, [k]: v }), [onChange, values]);

  return (
    <div style={{
      display: 'flex',
      gap: space.sm,
      flexWrap: 'wrap',
      alignItems: 'center',
      marginBottom: space.md,
    }}>
      {onSearchChange && (
        <Input
          prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
          placeholder={searchPlaceholder ?? t('search') ?? 'Search'}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
      )}
      {filters.map((f) => (
        <Select
          key={f.key}
          placeholder={f.label}
          options={f.options}
          mode={f.multiple ? 'multiple' : undefined}
          value={values[f.key] as never}
          onChange={(v) => setVal(f.key, v)}
          allowClear
          maxTagCount="responsive"
          suffixIcon={<FilterOutlined />}
          style={{ minWidth: 160 }}
        />
      ))}
      <div style={{ flex: 1 }} />
      <Space>
        {onReset && <MotionButton onClick={onReset}>{t('reset') ?? 'Reset'}</MotionButton>}
        {onRefresh && (
          <Tooltip title={t('refresh') ?? 'Refresh'}>
            <MotionButton icon={<ReloadOutlined />} onClick={onRefresh} />
          </Tooltip>
        )}
        {extra}
      </Space>
    </div>
  );
};

export const FilterBar = React.memo(FilterBarInner);

export default FilterBar;
