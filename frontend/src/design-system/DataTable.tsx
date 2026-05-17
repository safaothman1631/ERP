import React from 'react';
import { Table, type TableProps } from 'antd';
import { motion } from 'framer-motion';
import EmptyState from './EmptyState';
import { radius, shadow } from '../theme/tokens';

/** Threshold above which virtual scrolling is automatically enabled (داواکاری ٥.٥) */
const VIRTUAL_SCROLL_THRESHOLD = 100;

/** Default virtual scroll height in pixels when auto-enabled */
const VIRTUAL_SCROLL_HEIGHT = 600;

export interface DataTableProps<T> extends TableProps<T> {
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyActionLabel?: React.ReactNode;
  onEmptyAction?: () => void;
  emptyIcon?: React.ReactNode;
  density?: 'compact' | 'default' | 'comfort';
  bordered?: boolean;
  /**
   * Override the virtual scroll height (px). Set to `false` to disable
   * auto virtual scrolling even for large datasets.
   * Default: auto-enables at 600px when dataSource.length > 100.
   */
  virtualScrollHeight?: number | false;
}

const DENSITY_SIZE: Record<NonNullable<DataTableProps<unknown>['density']>, 'small' | 'middle' | 'large'> = {
  compact: 'small',
  default: 'middle',
  comfort: 'large',
};

/**
 * DataTable — wrapper بۆ AntD Table بە:
 *  - density سەروکار
 *  - empty state دیزاینکراو
 *  - card-style (rounded + shadow)
 *  - row-hover animation (subtle)
 *  - virtual scrolling ئۆتۆماتیکی بۆ لیستەکانی زیاتر لە 100 ئایتەم (داواکاری ٥.٥)
 */
export function DataTable<T extends object>({
  emptyTitle, emptyDescription, emptyActionLabel, onEmptyAction, emptyIcon,
  density = 'default', bordered, locale, dataSource, scroll, virtualScrollHeight, ...rest
}: DataTableProps<T>) {
  const isEmpty = !dataSource || (Array.isArray(dataSource) && dataSource.length === 0);

  // Auto-enable virtual scrolling for lists with more than 100 items (Requirement 5.5)
  const itemCount = Array.isArray(dataSource) ? dataSource.length : 0;
  const shouldVirtualScroll =
    virtualScrollHeight !== false &&
    itemCount > VIRTUAL_SCROLL_THRESHOLD;

  const resolvedScroll = scroll ?? (
    shouldVirtualScroll
      ? { y: typeof virtualScrollHeight === 'number' ? virtualScrollHeight : VIRTUAL_SCROLL_HEIGHT }
      : undefined
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        background: 'var(--ant-color-bg-container, #fff)',
        borderRadius: radius.lg,
        boxShadow: shadow.sm,
        overflow: 'hidden',
      }}
    >
      <Table<T>
        {...rest}
        dataSource={dataSource}
        size={DENSITY_SIZE[density]}
        bordered={bordered ?? false}
        scroll={resolvedScroll}
        virtual={shouldVirtualScroll}
        locale={{
          ...locale,
          emptyText: isEmpty && emptyTitle ? (
            <EmptyState
              icon={emptyIcon}
              title={emptyTitle}
              description={emptyDescription}
              actionLabel={emptyActionLabel}
              onAction={onEmptyAction}
            />
          ) : (locale?.emptyText ?? undefined),
        }}
      />
    </motion.div>
  );
}

export default DataTable;
