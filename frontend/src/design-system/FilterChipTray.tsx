import React from 'react';
import { Tag, Space, Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { palette, space } from '../theme/tokens';

export interface FilterChip {
  key: string;
  label: React.ReactNode;
  /** Display value (already formatted). */
  value: React.ReactNode;
  onRemove: () => void;
}

export interface FilterChipTrayProps {
  chips: FilterChip[];
  onClearAll?: () => void;
  isDark?: boolean;
}

/**
 * FilterChipTray — Sprint 5 — shows active filters as removable chips above a list.
 * Pair with FilterBar: each chip = one applied filter; remove chip = clear that filter.
 */
export const FilterChipTray: React.FC<FilterChipTrayProps> = ({ chips, onClearAll, isDark = false }) => {
  const { t } = useTranslation();
  if (chips.length === 0) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: space.sm,
      flexWrap: 'wrap',
      padding: `${space.xs}px 0`,
    }}>
      <span style={{ fontSize: 12, color: palette.ink500, fontWeight: 600 }}>
        {t('filter_bar_v2.active_filters', 'Active filters')}:
      </span>
      <Space size={space.xs} wrap>
        {chips.map((c) => (
          <Tag
            key={c.key}
            color={isDark ? 'blue' : 'processing'}
            closable
            closeIcon={<CloseOutlined />}
            onClose={(e) => { e.preventDefault(); c.onRemove(); }}
            style={{ borderRadius: 12, padding: '2px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span style={{ opacity: 0.75 }}>{c.label}:</span>
            <strong>{c.value}</strong>
          </Tag>
        ))}
      </Space>
      {onClearAll && chips.length > 1 && (
        <Button type="link" size="small" onClick={onClearAll}>
          {t('filter_bar_v2.clear_all', 'Clear all')}
        </Button>
      )}
    </div>
  );
};

export default FilterChipTray;
