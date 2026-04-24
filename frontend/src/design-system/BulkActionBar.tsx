import React from 'react';
import { Button, Space, Divider } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { palette, space, radius, shadow } from '../theme/tokens';

export interface BulkAction {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}

export interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  actions: BulkAction[];
  isDark?: boolean;
  /** Show as floating bar at bottom of viewport. */
  floating?: boolean;
}

/**
 * BulkActionBar — Sprint 5 — appears when rows are selected in a DataTable.
 * Floating mode: pinned to bottom of viewport with strong elevation.
 */
export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount, onClear, actions, isDark = false, floating = true,
}) => {
  const { t } = useTranslation();
  if (selectedCount <= 0) return null;

  const surface = isDark ? palette.darkSurface : palette.surface;
  const sep = isDark ? palette.darkBorder : palette.border;

  const inner = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: space.md,
      background: surface,
      border: `1px solid ${sep}`,
      borderRadius: radius.md,
      padding: `${space.sm}px ${space.md}px`,
      boxShadow: floating ? shadow.lg : shadow.sm,
    }}>
      <span style={{ fontWeight: 600, color: isDark ? palette.darkInk : palette.ink900 }}>
        {t('data_table_v2.selected_n', '{{n}} selected', { n: selectedCount })}
      </span>
      <Divider type="vertical" style={{ margin: 0 }} />
      <Space size={space.xs}>
        {actions.map((a) => (
          <Button
            key={a.key} icon={a.icon} danger={a.danger}
            disabled={a.disabled} onClick={() => { void a.onClick(); }}
            size="small"
          >
            {a.label}
          </Button>
        ))}
      </Space>
      <Divider type="vertical" style={{ margin: 0 }} />
      <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClear} aria-label={t('data_table_v2.clear_selection', 'Clear selection')}>
        {t('data_table_v2.clear_selection', 'Clear selection')}
      </Button>
    </div>
  );

  if (!floating) return inner;
  return (
    <div style={{
      position: 'fixed', bottom: 48, left: '50%', transform: 'translateX(-50%)',
      zIndex: 1010,
    }}>
      {inner}
    </div>
  );
};

export default BulkActionBar;
