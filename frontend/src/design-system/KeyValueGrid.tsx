import React from 'react';
import { Typography, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { palette, space } from '../theme/tokens';
import { useAuthStore } from '../store';

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
 * RTL-aware؛ copyable values جوان نمایش دەکرێن.
 */
export const KeyValueGrid: React.FC<KeyValueGridProps> = ({ items, columns = 2, rowGap = space.md }) => {
  const { t } = useTranslation();
  const isDark = useAuthStore((s) => s.theme) === 'dark';
  const labelColor = isDark ? palette.darkInkMuted : palette.ink500;
  const valueColor = isDark ? palette.darkInk : palette.ink900;

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
            gap: 2,
            minWidth: 0,
          }}
        >
          <Text style={{ fontSize: 12, color: labelColor }}>{it.label}</Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: space.xs, color: valueColor, fontSize: 14, fontWeight: 500 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.value ?? '—'}</span>
            {it.copyable && (
              <CopyOutlined
                onClick={() => handleCopy(it.value)}
                style={{ cursor: 'pointer', color: labelColor, fontSize: 12 }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KeyValueGrid;
