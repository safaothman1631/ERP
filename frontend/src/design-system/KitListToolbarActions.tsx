/**
 * KitListToolbarActions — the Vertex kit's right-hand toolbar cluster, 1:1.
 *
 * In the kit (screens.jsx) every list toolbar ends with TWO bare icon buttons
 * pinned to the inline-end:
 *
 *   ⊞  Columns   →  popover with a per-column show/hide toggle list
 *   ⋯  More      →  menu: Export · Import · Print list · Manage columns ·
 *                          Saved views · ─── · Archive (red/danger)
 *
 * Our pages previously showed a labelled "Columns" button + a separate
 * ExportMenu, which did not match the kit. This component reproduces the kit's
 * exact two-icon cluster + the consolidated ⋯ menu, reusably, so every list
 * page gets identical controls. All styling is tokens (auto light/dark + RTL);
 * the AntD Dropdown menu surface is kit-styled globally in vertex-kit.css.
 */
import React, { useState } from 'react';
import { Button, Dropdown, Checkbox, type MenuProps } from 'antd';
import {
  AppstoreOutlined, MoreOutlined, DownloadOutlined, UploadOutlined,
  PrinterOutlined, SettingOutlined, GlobalOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnVisibilityItem } from './ColumnVisibility';

export interface KitListToolbarActionsProps {
  /** Columns for the show/hide toggle popover (omit to hide the ⊞ icon). */
  columns?: ColumnVisibilityItem[];
  hiddenCols?: string[];
  onColumnsChange?: (hidden: string[]) => void;
  /** ⋯ menu actions — pass only the ones a page supports; others are hidden. */
  onExport?: () => void;
  onImport?: () => void;
  onPrint?: () => void;
  onSavedViews?: () => void;
  onArchive?: () => void;
  /** Extra custom items appended before Archive (optional). */
  extraMoreItems?: MenuProps['items'];
}

const KitListToolbarActions: React.FC<KitListToolbarActionsProps> = ({
  columns, hiddenCols = [], onColumnsChange,
  onExport, onImport, onPrint, onSavedViews, onArchive, extraMoreItems,
}) => {
  const { t } = useTranslation();
  const [colsOpen, setColsOpen] = useState(false);
  const hasColumns = Array.isArray(columns) && columns.length > 0;

  const toggle = (key: string) => {
    if (!onColumnsChange) return;
    onColumnsChange(hiddenCols.includes(key) ? hiddenCols.filter((k) => k !== key) : [...hiddenCols, key]);
  };

  const columnsPanel = (
    <div
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md, 8px)', padding: 6, minWidth: 224, maxHeight: 360,
        overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{ padding: '6px 10px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-500)' }}>
        {t('data_table_v2.columns', 'Columns')}
      </div>
      {(columns ?? []).map((c) => {
        const visible = !hiddenCols.includes(c.key);
        return (
          <label
            key={c.key}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, padding: '0 10px',
              cursor: c.pinned ? 'not-allowed' : 'pointer', borderRadius: 'var(--radius-sm, 6px)',
              opacity: c.pinned ? 0.55 : 1, color: 'var(--ink-700)', fontSize: 13.5, fontWeight: visible ? 600 : 500,
            }}
            onMouseEnter={(e) => { if (!c.pinned) e.currentTarget.style.background = 'var(--surface-2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Checkbox checked={visible} disabled={c.pinned} onChange={() => toggle(c.key)} />
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
          </label>
        );
      })}
      <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />
      <Button size="small" type="text" onClick={() => onColumnsChange?.([])}>{t('data_table_v2.show_all', 'Show all')}</Button>
    </div>
  );

  // Kit ⋯ menu order: Export · Import · Print list · Manage columns · Saved views · ─── · Archive
  const moreItems: MenuProps['items'] = [
    onExport && { key: 'export', icon: <DownloadOutlined />, label: t('export_csv', 'Export CSV'), onClick: onExport },
    onImport && { key: 'import', icon: <UploadOutlined />, label: t('import', 'Import'), onClick: onImport },
    onPrint && { key: 'print', icon: <PrinterOutlined />, label: t('print_list', 'Print list'), onClick: onPrint },
    hasColumns && { key: 'cols', icon: <SettingOutlined />, label: t('manage_columns', 'Manage columns'), onClick: () => setColsOpen(true) },
    onSavedViews && { key: 'views', icon: <GlobalOutlined />, label: t('saved_views', 'Saved views'), onClick: onSavedViews },
    ...(extraMoreItems ?? []),
    onArchive && { type: 'divider' as const, key: 'div' },
    onArchive && { key: 'archive', icon: <InboxOutlined />, label: t('archive', 'Archive'), danger: true, onClick: onArchive },
  ].filter(Boolean) as MenuProps['items'];

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {hasColumns && (
        <Dropdown open={colsOpen} onOpenChange={setColsOpen} trigger={['click']} placement="bottomRight" popupRender={() => columnsPanel}>
          <Button type="text" icon={<AppstoreOutlined />} aria-label={t('data_table_v2.columns', 'Columns')} />
        </Dropdown>
      )}
      {moreItems && moreItems.length > 0 && (
        <Dropdown menu={{ items: moreItems }} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<MoreOutlined />} aria-label={t('more', 'More')} />
        </Dropdown>
      )}
    </div>
  );
};

export default KitListToolbarActions;
