import React from 'react';
import { Button, Dropdown, Checkbox, Space, Divider } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { palette, space, radius } from '../theme/tokens';

export interface ColumnVisibilityItem {
  key: string;
  label: React.ReactNode;
  /** Pinned columns can't be hidden. */
  pinned?: boolean;
}

export interface ColumnVisibilityProps {
  columns: ColumnVisibilityItem[];
  hidden: string[];
  onChange: (hidden: string[]) => void;
  isDark?: boolean;
}

/**
 * ColumnVisibility — Sprint 5 — dropdown checklist to hide/show table columns.
 * Pair with DataTable: filter `columns` by `!hidden.includes(col.key)`.
 */
export const ColumnVisibility: React.FC<ColumnVisibilityProps> = ({
  columns, hidden, onChange, isDark = false,
}) => {
  const { t } = useTranslation();

  const toggle = (key: string) => {
    if (hidden.includes(key)) onChange(hidden.filter((k) => k !== key));
    else onChange([...hidden, key]);
  };
  const showAll = () => onChange([]);
  const hideAll = () => onChange(columns.filter((c) => !c.pinned).map((c) => c.key));

  const sep = isDark ? palette.darkBorder : palette.border;
  const surface = isDark ? palette.darkSurface : palette.surface;

  const overlay = (
    <div style={{
      background: surface,
      border: `1px solid ${sep}`,
      borderRadius: radius.md,
      padding: space.sm,
      minWidth: 220, maxHeight: 360, overflowY: 'auto',
      boxShadow: '0 6px 24px rgba(15,23,42,0.12)',
    }}>
      <div style={{ padding: `${space.xs}px ${space.sm}px`, fontSize: 12, color: palette.ink500, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {t('data_table_v2.columns', 'Columns')}
      </div>
      <Space direction="vertical" size={2} style={{ width: '100%' }}>
        {columns.map((c) => (
          <label key={c.key} style={{
            display: 'flex', alignItems: 'center', gap: space.sm,
            padding: `${space.xs}px ${space.sm}px`, cursor: c.pinned ? 'not-allowed' : 'pointer',
            borderRadius: radius.sm, opacity: c.pinned ? 0.6 : 1,
          }}>
            <Checkbox
              checked={!hidden.includes(c.key)}
              disabled={c.pinned}
              onChange={() => toggle(c.key)}
            />
            <span style={{ flex: 1, fontSize: 13 }}>{c.label}</span>
            {c.pinned && <span style={{ fontSize: 10, color: palette.ink500 }}>· {t('data_table_v2.pinned', 'pinned')}</span>}
          </label>
        ))}
      </Space>
      <Divider style={{ margin: `${space.xs}px 0` }} />
      <Space size={space.xs} style={{ padding: `0 ${space.sm}px` }}>
        <Button size="small" type="text" onClick={showAll}>{t('data_table_v2.show_all', 'Show all')}</Button>
        <Button size="small" type="text" onClick={hideAll}>{t('data_table_v2.hide_all', 'Hide all')}</Button>
      </Space>
    </div>
  );

  return (
    <Dropdown trigger={['click']} popupRender={() => overlay}>
      <Button icon={<SettingOutlined />} aria-label={t('data_table_v2.columns', 'Columns')}>
        {t('data_table_v2.columns', 'Columns')}
      </Button>
    </Dropdown>
  );
};

export default ColumnVisibility;
