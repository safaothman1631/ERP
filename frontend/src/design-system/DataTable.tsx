import React from 'react';
import { Table, type TableProps } from 'antd';
import { motion } from 'framer-motion';
import EmptyState from './EmptyState';
import { radius, shadow } from '../theme/tokens';

export interface DataTableProps<T> extends TableProps<T> {
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyActionLabel?: React.ReactNode;
  onEmptyAction?: () => void;
  emptyIcon?: React.ReactNode;
  density?: 'compact' | 'default' | 'comfort';
  bordered?: boolean;
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
 */
export function DataTable<T extends object>({
  emptyTitle, emptyDescription, emptyActionLabel, onEmptyAction, emptyIcon,
  density = 'default', bordered, locale, dataSource, ...rest
}: DataTableProps<T>) {
  const isEmpty = !dataSource || (Array.isArray(dataSource) && dataSource.length === 0);

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
