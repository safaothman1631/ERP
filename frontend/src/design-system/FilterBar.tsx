import React from 'react';
import { Input, Select, Space, Tooltip } from 'antd';
import { SearchOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useIsDark } from '../hooks/useIsDark';
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
 *
 * Rebuilt to the Vertex "Slate & Signal" kit toolbar (screens.jsx ListScreen):
 * a flat `var(--surface)` row on a hairline `var(--border)` border, kit-height
 * (38px) search + filter selects with a 3px accent focus ring, pill chips, and
 * right-aligned actions. Fully theme-aware — every color resolves from the
 * auto-flipping CSS-var tokens (`vertex-tokens.css` flips them under
 * `[data-theme="dark"]`), so it is correct in BOTH light and dark.
 *
 * React.memo applied per Requirements 18.4.
 */
const FilterBarInner: React.FC<FilterBarProps> = ({
  searchPlaceholder, searchValue, onSearchChange,
  filters = [], values = {}, onChange,
  extra, onReset, onRefresh,
}) => {
  const { t } = useTranslation();
  // Subscribe to the live theme so any token-driven branch re-renders on toggle.
  useIsDark();
  const setVal = React.useCallback((k: string, v: unknown) => onChange?.({ ...values, [k]: v }), [onChange, values]);

  const hasFilters = filters.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-sm)',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBlockEnd: 'var(--space-lg)',
        paddingBlock: 'var(--space-sm)',
        paddingInline: 'var(--space-md)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {onSearchChange && (
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--ink-300)' }} />}
          placeholder={searchPlaceholder ?? t('search') ?? 'Search'}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
          style={{ width: 260 }}
        />
      )}
      {filters.map((f) => {
        const active = f.multiple
          ? Array.isArray(values[f.key]) && (values[f.key] as unknown[]).length > 0
          : values[f.key] != null && values[f.key] !== '';
        return (
          <Select
            key={f.key}
            placeholder={f.label}
            options={f.options}
            mode={f.multiple ? 'multiple' : undefined}
            value={values[f.key] as never}
            onChange={(v) => setVal(f.key, v)}
            allowClear
            maxTagCount="responsive"
            // Mirror the kit's "active filter" affordance: tint the suffix icon
            // with the accent token when a value is set. Colors come from the
            // auto-flipping tokens, so it stays correct in light + dark.
            suffixIcon={<FilterOutlined style={{ color: active ? 'var(--accent-500)' : 'var(--ink-400)' }} />}
            style={{ minWidth: 160 }}
          />
        );
      })}
      <div style={{ flex: 1, minWidth: hasFilters ? 0 : undefined }} />
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
