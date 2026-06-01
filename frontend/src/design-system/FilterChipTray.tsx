import React from 'react';
import { Space, Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { space } from '../theme/tokens';
import { useIsDark } from '../hooks/useIsDark';

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
 * React.memo applied per Requirements 18.4.
 *
 * Vertex kit look: flat `accent-soft` pill chips with `accent-400` text, hairline-free,
 * 22px height, kit `--radius-sm`. Fully theme-aware via CSS var tokens (auto-flip in dark).
 */
const FilterChipTrayInner: React.FC<FilterChipTrayProps> = ({ chips, onClearAll, isDark: isDarkProp }) => {
  const { t } = useTranslation();
  // Auto-flip with the app theme when the consumer doesn't thread `isDark` (the common case).
  const themeDark = useIsDark();
  const isDark = isDarkProp ?? themeDark;
  // Reference isDark to keep the public prop wired even though tokens handle theming.
  void isDark;

  if (chips.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space.sm,
        flexWrap: 'wrap',
        paddingBlock: space.xs,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: 'var(--ink-500)',
          fontWeight: 600,
        }}
      >
        {t('filter_bar_v2.active_filters', 'Active filters')}:
      </span>
      <Space size={space.xs} wrap>
        {chips.map((c) => (
          <span
            key={c.key}
            className="vx-tag"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 22,
              paddingInline: 9,
              borderRadius: 'var(--radius-sm)',
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: '0.01em',
              background: 'var(--accent-soft)',
              color: 'var(--accent-400)',
            }}
          >
            <span style={{ opacity: 0.78 }}>{c.label}:</span>
            <strong style={{ fontWeight: 700 }}>{c.value}</strong>
            <button
              type="button"
              aria-label={t('filter_bar_v2.remove_filter', 'Remove filter')}
              onClick={(e) => {
                e.preventDefault();
                c.onRemove();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginInlineStart: 2,
                padding: 0,
                width: 14,
                height: 14,
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: 10,
                opacity: 0.7,
                transition: 'opacity .12s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7';
              }}
            >
              <CloseOutlined />
            </button>
          </span>
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

export const FilterChipTray = React.memo(FilterChipTrayInner);

export default FilterChipTray;
