import React from 'react';
import { Button, Dropdown, Checkbox, Space } from 'antd';
import { SettingOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useIsDark } from '../hooks/useIsDark';

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
 *
 * Vertex "Slate & Signal" kit dropdown: flat var(--surface) panel on a hairline
 * 1px var(--border) border, --radius-md corners, --shadow-lg elevation, kit row
 * idiom (34px rows, --radius-sm, --accent-soft selected state, --surface-2 hover).
 * Fully theme-aware — every token auto-flips between light and dark via
 * [data-theme="dark"] on <html>, so the panel is correct in BOTH themes.
 */
export const ColumnVisibility: React.FC<ColumnVisibilityProps> = ({
  columns, hidden, onChange, isDark: isDarkProp,
}) => {
  const { t } = useTranslation();
  // Default `isDark` from the live theme so the panel adapts even when the
  // consumer doesn't thread the prop down (the common case). Rules-of-hooks safe.
  const themeDark = useIsDark();
  const isDark = isDarkProp ?? themeDark;

  const toggle = (key: string) => {
    if (hidden.includes(key)) onChange(hidden.filter((k) => k !== key));
    else onChange([...hidden, key]);
  };
  const showAll = () => onChange([]);
  const hideAll = () => onChange(columns.filter((c) => !c.pinned).map((c) => c.key));

  const overlay = (
    <div
      // colorScheme keeps native form controls + the kit scrollbar correct per theme.
      style={{
        colorScheme: isDark ? 'dark' : 'light',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 6,
        minWidth: 232,
        maxHeight: 360,
        overflowY: 'auto',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div
        style={{
          padding: '6px 10px 8px',
          fontSize: 11,
          color: 'var(--ink-500)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          fontFamily: 'var(--font-display)',
        }}
      >
        {t('data_table_v2.columns', 'Columns')}
      </div>
      <Space direction="vertical" size={2} style={{ width: '100%' }}>
        {columns.map((c) => {
          const visible = !hidden.includes(c.key);
          return (
            <label
              key={c.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 34,
                padding: '0 10px',
                cursor: c.pinned ? 'not-allowed' : 'pointer',
                borderRadius: 'var(--radius-sm)',
                opacity: c.pinned ? 0.55 : 1,
                color: 'var(--ink-700)',
                fontSize: 13.5,
                fontWeight: visible ? 600 : 500,
                transition: 'background .12s, color .12s',
              }}
              onMouseEnter={(e) => {
                if (!c.pinned) e.currentTarget.style.background = 'var(--surface-2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Checkbox
                checked={visible}
                disabled={c.pinned}
                onChange={() => toggle(c.key)}
              />
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.label}
              </span>
              {c.pinned && (
                <span style={{ fontSize: 10.5, color: 'var(--ink-300)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {t('data_table_v2.pinned', 'pinned')}
                </span>
              )}
              {visible && !c.pinned && (
                <CheckOutlined style={{ fontSize: 12, color: 'var(--accent-500)' }} aria-hidden />
              )}
            </label>
          );
        })}
      </Space>
      <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />
      <Space size={4} style={{ padding: '0 6px' }}>
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
