import React from 'react';
import { Typography, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { space } from '../theme/tokens';

const { Text } = Typography;

export interface KeyValueItem {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Show copy button next to the value (string only). */
  copyable?: boolean;
  /** Span across multiple columns (1..3). Default 1. */
  span?: 1 | 2 | 3;
}

export interface KeyValueGridProps {
  items: KeyValueItem[];
  /** Number of columns (1, 2, or 3). Default 2. */
  columns?: 1 | 2 | 3;
  /** Row gap. Default space.md. */
  rowGap?: number;
}

/**
 * KeyValueGrid — display grid بۆ detail pages (label / value pairs).
 *
 * Vertex "Slate & Signal" kit field grid (records.jsx): muted `--ink-500` label
 * above an `--ink-900` value, separated by hairline `--border` rows. Fully
 * theme-aware — all colors are CSS var tokens that auto-flip for dark mode via
 * [data-theme="dark"], so no `isDark` prop is needed. RTL-aware (logical
 * properties)؛ copyable values جوان نمایش دەکرێن.
 */
export const KeyValueGrid: React.FC<KeyValueGridProps> = ({ items, columns = 2, rowGap = space.md }) => {
  const { t } = useTranslation();

  const handleCopy = (val: React.ReactNode) => {
    if (typeof val !== 'string' && typeof val !== 'number') return;
    void navigator.clipboard.writeText(String(val));
    void message.success(t('copied', 'Copied'));
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        rowGap,
        columnGap: space.lg,
      }}
    >
      {items.map((it, idx) => (
        <div
          key={idx}
          style={{
            gridColumn: it.span && it.span > 1 ? `span ${Math.min(it.span, columns)}` : undefined,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minWidth: 0,
            paddingBlockEnd: space.sm,
            borderBlockEnd: '1px solid var(--border)',
          }}
        >
          <Text
            style={{
              fontSize: 12,
              lineHeight: 1.35,
              color: 'var(--ink-500)',
            }}
          >
            {it.label}
          </Text>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space.xs,
              color: 'var(--ink-900)',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {it.value ?? '—'}
            </span>
            {it.copyable && (
              <CopyOutlined
                onClick={() => handleCopy(it.value)}
                style={{ cursor: 'pointer', color: 'var(--ink-500)', fontSize: 12 }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KeyValueGrid;
