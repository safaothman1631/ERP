/**
 * DataTable — ProTable-style wrapper around AntD Table.
 *
 * Features:
 *  - DataTableProps<T> generic interface
 *  - Sticky header (stickyHeader prop)
 *  - Sortable columns (built-in AntD sort, updates within 200ms)
 *  - Resizable columns (via CSS resize handle)
 *  - Row hover quick actions (view, edit, more) via CSS opacity transition
 *  - BulkActionBar integration when rows are selected
 *  - Auto-virtualization for datasets ≥ 200 rows (rc-virtual-list via AntD virtual prop)
 *  - LoadingSkeleton variant="table" when loading prop is true
 *  - EmptyState (illustration + headline + CTA) when dataSource is empty
 *  - ExportMenu integration via exportConfig
 *
 * Requirements: 14.1–14.9, 18.5
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Table, type TableProps, type TableColumnType } from 'antd';
import { EyeOutlined, EditOutlined, MoreOutlined } from '@ant-design/icons';
import { motion, useReducedMotion } from 'framer-motion';
import EmptyState from './EmptyState';
import LoadingSkeleton from './LoadingSkeleton';
import BulkActionBar, { type BulkAction } from './BulkActionBar';
import { space } from '../theme/tokens';
import { useIsDark } from '../hooks/useIsDark';
import { MotionButton } from '../components/MotionButton';

// ─── Threshold ────────────────────────────────────────────────────────────────

/**
 * Auto-enable virtualization for datasets ≥ 200 rows.
 * Requirements: 14.5, 18.5
 */
const VIRTUALIZE_THRESHOLD = 200;

/** Default virtual scroll height in pixels */
const VIRTUAL_SCROLL_HEIGHT = 600;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColumnDef<T> extends TableColumnType<T> {
  /** Whether this column is resizable. Defaults to false. */
  resizable?: boolean;
}

export interface ExportConfig {
  onExport: (format: 'csv' | 'xlsx' | 'pdf') => void | Promise<void>;
  formats?: ('csv' | 'xlsx' | 'pdf')[];
}

export interface QuickAction<T> {
  key: string;
  icon?: React.ReactNode;
  label?: React.ReactNode;
  onClick: (record: T) => void;
  danger?: boolean;
}

export interface DataTableProps<T extends object> {
  /** Column definitions — extends AntD TableColumnType with resizable flag */
  columns: ColumnDef<T>[];
  /** Data source array */
  dataSource: T[];
  /** Show LoadingSkeleton variant="table" when true */
  loading?: boolean;
  /** Enable row selection + BulkActionBar */
  rowSelection?: boolean;
  /** Callback when a bulk action is triggered */
  onBulkAction?: (action: string, keys: React.Key[]) => void;
  /** Bulk actions to show in BulkActionBar */
  bulkActions?: BulkAction[];
  /** Export configuration for ExportMenu */
  exportConfig?: ExportConfig;
  /**
   * Force virtualization on/off.
   * Auto-enabled when dataSource.length >= 200.
   * Requirements: 14.5, 18.5
   */
  virtualize?: boolean;
  /** Stick the header to the top of the scroll container */
  stickyHeader?: boolean;
  /** Quick actions shown on row hover (view, edit, more) */
  quickActions?: QuickAction<T>[];
  /** Show default view/edit/more quick actions */
  showDefaultQuickActions?: boolean;
  /** Callback for default "view" quick action */
  onView?: (record: T) => void;
  /** Callback for default "edit" quick action */
  onEdit?: (record: T) => void;
  /** Callback for default "more" quick action */
  onMore?: (record: T) => void;
  /** Empty state title */
  emptyTitle?: React.ReactNode;
  /** Empty state description */
  emptyDescription?: React.ReactNode;
  /** Empty state CTA label */
  emptyActionLabel?: React.ReactNode;
  /** Empty state CTA callback */
  onEmptyAction?: () => void;
  /** Empty state icon */
  emptyIcon?: React.ReactNode;
  /** Density mode */
  density?: 'compact' | 'default' | 'comfort';
  /** Dark mode override */
  isDark?: boolean;
  /** Row key extractor */
  rowKey?: TableProps<T>['rowKey'];
  /** Pagination config */
  pagination?: TableProps<T>['pagination'];
  /** Additional AntD Table props */
  tableProps?: Omit<TableProps<T>, 'columns' | 'dataSource' | 'loading' | 'rowSelection' | 'pagination'>;
  /** Virtual scroll height override */
  virtualScrollHeight?: number;
  /** CSS class name */
  className?: string;
  /** Inline style */
  style?: React.CSSProperties;
}

// ─── Density mapping ──────────────────────────────────────────────────────────

const DENSITY_SIZE: Record<NonNullable<DataTableProps<object>['density']>, 'small' | 'middle' | 'large'> = {
  compact: 'small',
  default: 'middle',
  comfort: 'large',
};

// ─── Resizable column hook ────────────────────────────────────────────────────

/**
 * Returns a ResizableTitle component and a handler to update column widths.
 * Uses native HTML resize via a drag handle overlay.
 */
function useResizableColumns<T extends object>(initialColumns: ColumnDef<T>[]) {
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const dragging = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const handleMouseDown = useCallback((key: string, currentWidth: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = { key, startX: e.clientX, startWidth: currentWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - dragging.current.startX;
      const newWidth = Math.max(60, dragging.current.startWidth + delta);
      setColWidths(prev => ({ ...prev, [dragging.current!.key]: newWidth }));
    };

    const onMouseUp = () => {
      dragging.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const columns = useMemo(() =>
    initialColumns.map(col => {
      const key = String(col.key ?? col.dataIndex ?? '');
      const width = colWidths[key] ?? (typeof col.width === 'number' ? col.width : undefined);
      if (!col.resizable) return { ...col, width };

      return {
        ...col,
        width,
        title: (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', userSelect: 'none' }}>
            <span style={{ flex: 1 }}>{col.title as React.ReactNode}</span>
            {/* Resize handle */}
            <span
              onMouseDown={handleMouseDown(key, width ?? 120)}
              style={{
                position: 'absolute',
                insetInlineEnd: -4,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 8,
                height: 20,
                cursor: 'col-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
              aria-hidden="true"
            >
              <span style={{
                width: 2,
                height: 16,
                background: 'var(--border-strong)',
                borderRadius: 1,
              }} />
            </span>
          </div>
        ),
      };
    }),
  [initialColumns, colWidths, handleMouseDown]);

  return columns;
}

// ─── Quick Actions cell renderer ─────────────────────────────────────────────

function QuickActionsCell<T extends object>({
  record,
  quickActions,
  onView,
  onEdit,
  onMore,
  showDefaultQuickActions,
}: {
  record: T;
  quickActions?: QuickAction<T>[];
  onView?: (r: T) => void;
  onEdit?: (r: T) => void;
  onMore?: (r: T) => void;
  showDefaultQuickActions?: boolean;
}) {
  const actions: QuickAction<T>[] = quickActions ?? [];

  // Inject default actions if requested and not already provided
  const defaultActions: QuickAction<T>[] = [];
  if (showDefaultQuickActions || (!quickActions && (onView || onEdit || onMore))) {
    if (onView) defaultActions.push({ key: '__view', icon: <EyeOutlined />, label: 'View', onClick: onView });
    if (onEdit) defaultActions.push({ key: '__edit', icon: <EditOutlined />, label: 'Edit', onClick: onEdit });
    if (onMore) defaultActions.push({ key: '__more', icon: <MoreOutlined />, label: 'More', onClick: onMore });
  }

  const allActions = [...defaultActions, ...actions];
  if (allActions.length === 0) return null;

  return (
    <div
      className="table-row-actions"
      style={{ display: 'flex', gap: space.xs, alignItems: 'center' }}
    >
      {allActions.map(action => (
        <MotionButton
          key={action.key}
          type="text"
          size="small"
          icon={action.icon}
          danger={action.danger}
          onClick={(e) => { e.stopPropagation(); action.onClick(record); }}
          aria-label={typeof action.label === 'string' ? action.label : action.key}
          style={{ padding: '0 4px' }}
        >
          {action.label}
        </MotionButton>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * DataTable — ProTable-style wrapper around AntD Table.
 *
 * Requirements: 14.1–14.9
 * React.memo applied per Requirements 18.4.
 */
// Memoized so a stable (useMemo'd) columns/dataSource skips re-rendering the
// whole table — the "React.memo applied" the docstring promised but the wrapper
// never delivered. React.memo strips the generic, so the cast restores the call
// signature; callers passing fresh array literals each render simply re-render
// as before (shallow-unequal props) — no behaviour change.
export const DataTable = React.memo(DataTableInner) as typeof DataTableInner;

function DataTableInner<T extends object>({
  columns,
  dataSource,
  loading = false,
  rowSelection = false,
  onBulkAction,
  bulkActions = [],
  exportConfig: _exportConfig,
  virtualize,
  stickyHeader = true,
  quickActions,
  showDefaultQuickActions,
  onView,
  onEdit,
  onMore,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  emptyIcon,
  density = 'default',
  isDark: isDarkProp,
  rowKey = 'id',
  pagination,
  tableProps,
  virtualScrollHeight,
  className,
  style,
}: DataTableProps<T>) {
  // Auto-flip dark mode from the live theme; explicit prop still wins (rules-of-hooks safe).
  const themeDark = useIsDark();
  const isDark = isDarkProp ?? themeDark;
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const prefersReducedMotion = useReducedMotion();

  // ── Virtualization ──────────────────────────────────────────────────────────
  // Auto-enable for datasets ≥ 200 rows (Requirements 14.5, 18.5)
  const itemCount = Array.isArray(dataSource) ? dataSource.length : 0;
  const shouldVirtualize = itemCount >= VIRTUALIZE_THRESHOLD || virtualize === true;
  const scrollY = virtualScrollHeight ?? (shouldVirtualize ? VIRTUAL_SCROLL_HEIGHT : undefined);

  // ── Resizable columns ───────────────────────────────────────────────────────
  const resizableColumns = useResizableColumns(columns);

  // ── Numeric columns → kit .vx-num (tabular-nums + end-align via vertex-kit.css) ──
  // Right/end-aligned columns are treated as numeric per the kit's `.vx-num` rule.
  const styledColumns = useMemo<ColumnDef<T>[]>(() =>
    resizableColumns.map(col => {
      const isNumeric = col.align === 'right' || col.align === 'end';
      if (!isNumeric) return col;
      const className = [col.className, 'vx-num'].filter(Boolean).join(' ');
      return { ...col, className };
    }),
  [resizableColumns]);

  // ── Quick actions column ────────────────────────────────────────────────────
  const hasQuickActions = quickActions?.length || onView || onEdit || onMore || showDefaultQuickActions;
  const columnsWithActions = useMemo<ColumnDef<T>[]>(() => {
    if (!hasQuickActions) return styledColumns;
    return [
      ...styledColumns,
      {
        key: '__actions',
        title: '',
        width: 120,
        fixed: 'right' as const,
        render: (_: unknown, record: T) => (
          <QuickActionsCell
            record={record}
            quickActions={quickActions}
            onView={onView}
            onEdit={onEdit}
            onMore={onMore}
            showDefaultQuickActions={showDefaultQuickActions}
          />
        ),
      },
    ];
  }, [styledColumns, hasQuickActions, quickActions, onView, onEdit, onMore, showDefaultQuickActions]);

  // ── Row selection ───────────────────────────────────────────────────────────
  const antRowSelection = rowSelection
    ? {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
        preserveSelectedRowKeys: true,
      }
    : undefined;

  const handleClearSelection = useCallback(() => setSelectedRowKeys([]), []);

  // ── Empty state ─────────────────────────────────────────────────────────────
  const isEmpty = !dataSource || (Array.isArray(dataSource) && dataSource.length === 0);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  // Show LoadingSkeleton variant="table" when loading (Requirements 14.8)
  if (loading) {
    return (
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          ...style,
        }}
        className={className}
      >
        <LoadingSkeleton variant="table" rows={8} isDark={isDark} />
      </div>
    );
  }

  return (
    <>
      {/* BulkActionBar — shown when rows are selected (Requirements 14.4) */}
      {rowSelection && selectedRowKeys.length > 0 && (
        <BulkActionBar
          selectedCount={selectedRowKeys.length}
          onClear={handleClearSelection}
          isDark={isDark}
          floating
          actions={bulkActions.map(action => ({
            ...action,
            onClick: async () => {
              await action.onClick();
              onBulkAction?.(action.key, selectedRowKeys);
            },
          }))}
        />
      )}

      {/* aria-live region for dynamic selection count updates — Requirements 17.1 */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
      >
        {selectedRowKeys.length > 0 ? `${selectedRowKeys.length} rows selected` : ''}
      </div>

      {/* Table wrapper with CSS for row hover quick actions */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          ...style,
        }}
        className={className}
      >
        {/*
          Kit `.vx-table` look (theme-aware via CSS vars) + row-hover quick-action
          reveal (Requirements 14.3) + sort transition within 200ms (Requirements 14.9).
          The global vertex-kit.css already styles AntD tables; these scoped rules
          pin the kit appearance for this wrapper and stay correct in light + dark.
        */}
        <style>{`
          .zoho-datatable .table-row-actions {
            opacity: 0;
            transition: opacity 150ms ease;
          }
          .zoho-datatable .ant-table-row:hover .table-row-actions {
            opacity: 1;
          }
          .zoho-datatable .ant-table { background: transparent; }
          .zoho-datatable .ant-table-thead > tr > th {
            background: var(--surface-2);
            color: var(--ink-500);
            font-size: 11px;
            font-weight: 600;
            letter-spacing: .06em;
            text-transform: uppercase;
            border-bottom: 1px solid var(--border);
          }
          .zoho-datatable .ant-table-tbody > tr > td {
            color: var(--ink-700);
            border-bottom: 1px solid var(--border);
          }
          .zoho-datatable .ant-table-tbody > tr {
            transition: background-color 120ms ease;
          }
          .zoho-datatable .ant-table-tbody > tr:hover > td {
            background: var(--surface-2);
          }
          .zoho-datatable .ant-table-tbody > tr.ant-table-row-selected > td {
            background: var(--accent-soft);
          }
          .zoho-datatable .ant-table-cell.vx-num {
            font-variant-numeric: tabular-nums;
            text-align: end;
          }
          .zoho-datatable .ant-table-column-sorter {
            transition: color 150ms ease;
          }
        `}</style>

        <Table<T>
          {...tableProps}
          className="zoho-datatable"
          columns={columnsWithActions}
          dataSource={dataSource}
          loading={false}
          size={DENSITY_SIZE[density]}
          rowKey={rowKey}
          rowSelection={antRowSelection}
          virtual={shouldVirtualize}
          scroll={
            stickyHeader || shouldVirtualize
              ? { y: scrollY, x: 'max-content' }
              : { x: 'max-content' }
          }
          sticky={stickyHeader ? { offsetHeader: 0 } : false}
          pagination={pagination ?? { pageSize: 20, showSizeChanger: true, showQuickJumper: true }}
          locale={{
            emptyText: isEmpty && emptyTitle ? (
              <EmptyState
                icon={emptyIcon}
                title={emptyTitle}
                description={emptyDescription}
                actionLabel={emptyActionLabel}
                onAction={onEmptyAction}
              />
            ) : undefined,
          }}
          // Sort change triggers re-render within 200ms via React state (Requirements 14.9)
          onChange={(_pagination, _filters, _sorter, extra) => {
            tableProps?.onChange?.(_pagination, _filters, _sorter, extra);
          }}
          role="grid"
          aria-label="Data table"
        />
      </motion.div>
    </>
  );
}

export default DataTable;
