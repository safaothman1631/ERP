/**
 * KitFiltersButton — the Vertex kit's toolbar "▽ Filters" button + popover, 1:1.
 *
 * A kit-styled outline button (filter glyph + label + active-count badge) that
 * opens a popover holding the page's own filter controls (date range, amount,
 * toggles…), with Clear / Apply at the bottom. Turns accent when filters active.
 * Reusable across every list: pass the entity's filter controls as children.
 */
import React, { useState } from 'react';
import { Button, Popover } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export interface KitFiltersButtonProps {
  /** Number of active filters (shows a badge + accent state when > 0). */
  activeCount?: number;
  /** The filter controls. */
  children: React.ReactNode;
  /** Clear-all handler. */
  onClear?: () => void;
  /** Button label (default: "Filters"). */
  label?: React.ReactNode;
  /** Popover heading (default: "Filters"). */
  title?: React.ReactNode;
}

const KitFiltersButton: React.FC<KitFiltersButtonProps> = ({ activeCount = 0, children, onClear, label, title }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const content = (
    <div style={{ minWidth: 244, maxWidth: 300 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--ink-900)' }}>
        {title ?? t('filters', 'Filters')}
      </div>
      {children}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Button size="small" type="text" style={{ flex: 1 }} onClick={() => onClear?.()}>
          {t('clear', 'Clear')}
        </Button>
        <Button size="small" type="primary" style={{ flex: 1 }} onClick={() => setOpen(false)}>
          {t('apply', 'Apply')}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen} trigger="click" content={content} placement="bottomLeft">
      <Button
        size="small"
        icon={<FilterOutlined />}
        style={{
          height: 32,
          paddingInline: 10,
          fontSize: 12.5,
          ...(activeCount ? { borderColor: 'var(--accent-500)', color: 'var(--accent-500)' } : null),
        }}
      >
        {label ?? t('filters', 'Filters')}
        {activeCount > 0 && (
          <span style={{ marginInlineStart: 4, background: 'var(--accent-500)', color: '#fff', borderRadius: 999, fontSize: 10.5, fontWeight: 700, padding: '0 5px' }}>
            {activeCount}
          </span>
        )}
      </Button>
    </Popover>
  );
};

export default KitFiltersButton;
