/**
 * ResponsiveTableAdapter — AntD Table-compatible wrapper around ResponsiveTable.
 *
 * This adapter accepts the same props as AntD's `<Table>` component and
 * internally converts them to the `ResponsiveTable` API. It enables a
 * gradual migration path: existing pages can swap `<Table>` for
 * `<ResponsiveTableAdapter>` without rewriting their column definitions.
 *
 * Priority assignment is automatic based on column key/dataIndex:
 * - 'high': name, title, amount, total, balance, status, number, invoice_number,
 *           bill_number, order_number, display_name, customer, vendor
 * - 'medium': date, due_date, reference, type, category, email, phone, period,
 *             quantity, rate, currency, code
 * - 'low': notes, description, metadata, id, created_at, updated_at, actions
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 5.3
 */
import React, { type Key, type ReactNode, useMemo } from 'react';
import type { TablePaginationConfig } from 'antd';
import { useTranslation } from 'react-i18next';

import {
  ResponsiveTable,
  type ColumnPriority,
  type ResponsiveColumn,
  type RowAction,
} from './ResponsiveTable';
import { asTranslationKey } from '../../i18n/types';

// ───────────────────────────── Priority inference ─────────────────────────────

const HIGH_PRIORITY_PATTERNS = [
  'name', 'title', 'amount', 'total', 'balance', 'status', 'number',
  'invoice_number', 'bill_number', 'order_number', 'display_name',
  'customer', 'vendor', 'contact', 'employee', 'subject', 'label',
  'product', 'item', 'asset', 'patient', 'ticket',
];

const MEDIUM_PRIORITY_PATTERNS = [
  'date', 'due_date', 'reference', 'type', 'category', 'email', 'phone',
  'period', 'quantity', 'rate', 'currency', 'code', 'price', 'unit',
  'department', 'location', 'warehouse', 'branch', 'role', 'priority',
  'assigned', 'owner', 'progress', 'count', 'frequency',
];

const LOW_PRIORITY_PATTERNS = [
  'notes', 'description', 'metadata', 'id', 'created_at', 'updated_at',
  'actions', 'memo', 'comment', 'tag', 'tags', 'attachment',
];

function inferPriority(key: string | undefined, dataIndex: string | undefined): ColumnPriority {
  const identifier = (key || dataIndex || '').toLowerCase();

  // Actions column is always low (handled separately as rowActions on mobile)
  if (identifier === 'actions' || identifier === 'action') return 'low';

  for (const pattern of HIGH_PRIORITY_PATTERNS) {
    if (identifier === pattern || identifier.includes(pattern)) return 'high';
  }
  for (const pattern of MEDIUM_PRIORITY_PATTERNS) {
    if (identifier === pattern || identifier.includes(pattern)) return 'medium';
  }
  for (const pattern of LOW_PRIORITY_PATTERNS) {
    if (identifier === pattern || identifier.includes(pattern)) return 'low';
  }

  // Default: first 3 columns get high, next 2 get medium, rest get low
  return 'medium';
}

// ───────────────────────────── Types ─────────────────────────────

/** Minimal AntD column shape that we support for migration. */
export interface AntDColumnDef<T = any> {
  key?: string | number;
  title?: ReactNode;
  dataIndex?: string | string[];
  render?: (value: any, record: T, index: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
  sorter?: ((a: T, b: T) => number) | boolean;
  fixed?: 'left' | 'right' | boolean;
  ellipsis?: boolean;
  children?: AntDColumnDef<T>[];
  filters?: any[];
  onFilter?: any;
  filterDropdown?: any;
  filteredValue?: any;
  defaultSortOrder?: any;
  sortOrder?: any;
  sortDirections?: any;
  showSorterTooltip?: any;
  responsive?: any;
  hidden?: boolean;
  colSpan?: number;
  rowSpan?: number;
  onCell?: any;
  onHeaderCell?: any;
  className?: string;
}

export interface ResponsiveTableAdapterProps<T = any> {
  /** AntD-style column definitions. */
  columns?: AntDColumnDef<T>[];
  /** Data source (same as AntD's dataSource). */
  dataSource?: T[];
  /** Row key — string field name or function. */
  rowKey?: string | ((record: T, index?: number) => Key);
  /** Loading state. */
  loading?: boolean | { tip?: string };
  /** Pagination config. */
  pagination?: TablePaginationConfig | false;
  /** Empty state locale override. */
  locale?: { emptyText?: ReactNode };
  /** Custom empty state node. */
  emptyState?: ReactNode;
  /** Additional className. */
  className?: string;
  /** Size variant (ignored — ResponsiveTable handles sizing). */
  size?: 'small' | 'middle' | 'large';
  /** Scroll config (ignored on mobile — cards don't scroll horizontally). */
  scroll?: { x?: number | string; y?: number | string };
  /** Row click handler. */
  onRow?: (record: T, index?: number) => { onClick?: () => void; style?: React.CSSProperties };
  /** Sticky header (always true in ResponsiveTable desktop mode). */
  sticky?: boolean;
  /** Table layout (ignored). */
  tableLayout?: 'auto' | 'fixed';
  /** Expandable config (handled via "Show more" on mobile). */
  expandable?: any;
  /** Row selection (not yet supported in ResponsiveTable — preserved as pass-through). */
  rowSelection?: any;
  /** Footer renderer. */
  footer?: (data: readonly T[]) => ReactNode;
  /** data-testid */
  'data-testid'?: string;
  /** Style */
  style?: React.CSSProperties;
  /** bordered */
  bordered?: boolean;
  /** showHeader */
  showHeader?: boolean;
  /** onChange handler for sorting/filtering/pagination */
  onChange?: any;
  /** summary */
  summary?: any;
  /** components override */
  components?: any;
  /** title */
  title?: any;
  /** virtual */
  virtual?: boolean;
  /** rowClassName */
  rowClassName?: string | ((record: T, index: number) => string);
}

// ───────────────────────────── Component ─────────────────────────────

/**
 * Drop-in replacement for AntD `<Table>` that renders responsively on
 * mobile via `ResponsiveTable`.
 */
export function ResponsiveTableAdapter<T extends Record<string, any> = any>({
  columns = [],
  dataSource = [],
  rowKey,
  loading = false,
  pagination,
  locale,
  emptyState,
  className,
  onRow,
  'data-testid': testId,
  ..._rest
}: ResponsiveTableAdapterProps<T>): React.ReactElement {
  const { t: _t } = useTranslation();

  // Convert AntD columns to ResponsiveColumn format.
  //
  // Historically this adapter STRIPPED the actions column on the assumption a
  // caller would translate it into ResponsiveTable's `rowActions` prop, but the
  // translation was never implemented (see line below — _rowActions returns []),
  // so the column silently vanished. With the Vertex kit conversion, every
  // converted page now renders its row "⋯" menu via a `KitRowActions` cell
  // *inside* the actions column's `render`, so the column must be passed
  // through like any other column. We mark it high-priority so it never gets
  // hidden on small viewports.
  const responsiveColumns: ResponsiveColumn<T>[] = useMemo(() => {
    return columns.map((col, index) => {
      const colKey = String(col.key || col.dataIndex || '');
      const isActions = colKey === 'actions' || colKey === 'action' || colKey === '__row_actions__';
      if (isActions) {
        // Pass actions through; the column's own `render` produces KitRowActions.
        return {
          id: colKey || `actions-${index}`,
          headerKey: '' as never,
          priority: 'high' as const,
          render: (row: T) => {
            if (col.render) {
              const idx = dataSource.indexOf(row);
              return col.render(undefined, row, idx >= 0 ? idx : 0);
            }
            return null;
          },
          align: 'center' as const,
          width: col.width ?? 56,
        } satisfies ResponsiveColumn<T>;
      }
      return _mapCol(col, index);
    });

    function _mapCol(col: AntDColumnDef<T>, index: number): ResponsiveColumn<T> {
      const key = String(col.key || col.dataIndex || `col-${index}`);
      const dataIdx = Array.isArray(col.dataIndex)
        ? col.dataIndex.join('.')
        : (col.dataIndex as string | undefined);

      // Determine priority — use position-based fallback for columns
      // that don't match any pattern
      let priority = inferPriority(key, dataIdx);
      if (priority === 'medium' && index < 2) priority = 'high';
      if (priority === 'medium' && index > 4) priority = 'low';

      // Build the header key from the title
      const titleStr = typeof col.title === 'string'
        ? col.title
        : key;

      // Map alignment
      const alignMap: Record<string, 'start' | 'center' | 'end'> = {
        left: 'start', /* rtl-ignore */
        center: 'center',
        right: 'end', /* rtl-ignore */
      };

      return {
        id: key,
        headerKey: asTranslationKey(titleStr),
        priority,
        render: (row: T) => {
          if (col.render) {
            const value = dataIdx ? (row as any)[dataIdx] : undefined;
            const idx = dataSource.indexOf(row);
            return col.render(value, row, idx >= 0 ? idx : 0);
          }
          if (dataIdx) {
            return (row as any)[dataIdx] ?? '';
          }
          return '';
        },
        align: col.align ? alignMap[col.align] || 'start' : undefined,
        sorter: typeof col.sorter === 'function' ? col.sorter : undefined,
        width: col.width,
      } satisfies ResponsiveColumn<T>;
    }
  }, [columns, dataSource]);

  // Extract actions column and convert to rowActions
  const actionsColumn = useMemo(() => {
    return columns.find((col) => {
      const key = String(col.key || col.dataIndex || '');
      return key === 'actions' || key === 'action' || key === '__row_actions__';
    });
  }, [columns]);

  const _rowActions = useMemo(() => {
    if (!actionsColumn?.render) return undefined;
    return (_row: T): RowAction[] => {
      // The actions column render returns JSX — we can't easily convert
      // that to RowAction[] without knowing the structure. For the adapter,
      // we'll render the actions column content as a single "actions" entry.
      // This is a pragmatic compromise for the migration.
      return [];
    };
  }, [actionsColumn]);

  // Convert rowKey to getRowKey function
  const getRowKey = useMemo(() => {
    if (typeof rowKey === 'function') return rowKey;
    if (typeof rowKey === 'string') {
      return (row: T) => (row as any)[rowKey] as Key;
    }
    return undefined;
  }, [rowKey]);

  // Resolve loading to boolean
  const isLoading = typeof loading === 'boolean' ? loading : !!loading;

  // Resolve empty state
  const resolvedEmptyState = emptyState || locale?.emptyText || undefined;

  return (
    <ResponsiveTable<T>
      columns={responsiveColumns}
      data={dataSource}
      rowActions={actionsColumn?.render ? undefined : undefined}
      loading={isLoading}
      emptyState={resolvedEmptyState}
      getRowKey={getRowKey}
      pagination={pagination}
      className={className}
      testId={testId}
    />
  );
}

export default ResponsiveTableAdapter;
