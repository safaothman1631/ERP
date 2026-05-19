/**
 * EditableLineItems — drag-reorder editable table for form line items.
 *
 * Features:
 *   - Drag-and-drop row reordering via @dnd-kit/sortable
 *   - Keyboard navigation: Tab moves between cells, Enter confirms inline edit
 *   - Add / remove rows
 *   - Configurable columns (text, number, select, money)
 *   - RTL-aware drag handle placement
 *
 * Requirements: 15.2
 */
import React, { useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Input, InputNumber, Select, Space, Tooltip } from 'antd';
import {
  HolderOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { palette, space, radius } from '../theme/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LineItemColumnType = 'text' | 'number' | 'money' | 'select';

export interface LineItemColumn<T = LineItem> {
  key: keyof T & string;
  title: React.ReactNode;
  type?: LineItemColumnType;
  width?: number | string;
  /** For 'select' type */
  options?: { label: string; value: string | number }[];
  /** Minimum value for number/money */
  min?: number;
  /** Decimal precision for number/money */
  precision?: number;
  /** Whether this column is read-only */
  readOnly?: boolean;
  /** Custom render — overrides built-in cell editor */
  render?: (value: unknown, row: T, rowIndex: number) => React.ReactNode;
}

export interface LineItem {
  id: string;
  [key: string]: unknown;
}

export interface EditableLineItemsProps<T extends LineItem = LineItem> {
  /** Current rows */
  value: T[];
  /** Called when rows change (reorder, edit, add, delete) */
  onChange: (rows: T[]) => void;
  /** Column definitions */
  columns: LineItemColumn<T>[];
  /** Factory for a new empty row */
  newRow?: () => T;
  /** Label for the "Add row" button */
  addLabel?: string;
  /** Whether the table is read-only */
  readOnly?: boolean;
  /** Whether to show the drag handle column */
  showDragHandle?: boolean;
  /** Whether to show the delete column */
  showDelete?: boolean;
  /** Dark mode */
  isDark?: boolean;
  /** Max rows (disables Add when reached) */
  maxRows?: number;
}

// ─── Sortable Row ─────────────────────────────────────────────────────────────

interface SortableRowProps<T extends LineItem> {
  row: T;
  rowIndex: number;
  columns: LineItemColumn<T>[];
  onCellChange: (rowId: string, key: string, value: unknown) => void;
  onDelete: (rowId: string) => void;
  showDragHandle: boolean;
  showDelete: boolean;
  readOnly: boolean;
  isDark: boolean;
  isRTL: boolean;
  /** ref to first focusable cell in this row (for keyboard nav) */
  firstCellRef?: React.RefObject<HTMLElement | null>;
}

function SortableRow<T extends LineItem>({
  row,
  rowIndex,
  columns,
  onCellChange,
  onDelete,
  showDragHandle,
  showDelete,
  readOnly,
  isDark,
  isRTL,
}: SortableRowProps<T>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDark ? palette.darkSurface : palette.surface,
    borderBottom: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
    display: 'flex',
    alignItems: 'center',
    gap: space.xs,
    padding: `${space.xs}px ${space.sm}px`,
  };

  return (
    <div ref={setNodeRef} style={style} role="row" aria-rowindex={rowIndex + 2}>
      {/* Drag handle */}
      {showDragHandle && !readOnly && (
        <span
          {...attributes}
          {...listeners}
          style={{
            cursor: 'grab',
            color: isDark ? palette.darkInkMuted : palette.ink400,
            flexShrink: 0,
            touchAction: 'none',
            padding: '0 4px',
          }}
          aria-label="Drag to reorder"
          role="button"
          tabIndex={0}
        >
          <HolderOutlined />
        </span>
      )}

      {/* Cells */}
      {columns.map((col) => (
        <div
          key={col.key}
          role="gridcell"
          style={{
            flex: col.width ? `0 0 ${col.width}` : 1,
            minWidth: 0,
          }}
        >
          {col.render ? (
            col.render(row[col.key], row, rowIndex)
          ) : (
            <CellEditor
              column={col}
              value={row[col.key]}
              onChange={(v) => onCellChange(row.id, col.key, v)}
              readOnly={readOnly || col.readOnly}
              isDark={isDark}
              isRTL={isRTL}
            />
          )}
        </div>
      ))}

      {/* Delete button */}
      {showDelete && !readOnly && (
        <Tooltip title="Remove row">
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(row.id)}
            aria-label="Remove row"
            style={{ flexShrink: 0 }}
          />
        </Tooltip>
      )}
    </div>
  );
}

// ─── Cell Editor ──────────────────────────────────────────────────────────────

interface CellEditorProps<T extends LineItem> {
  column: LineItemColumn<T>;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
  isDark: boolean;
  isRTL: boolean;
}

function CellEditor<T extends LineItem>({
  column,
  value,
  onChange,
  readOnly,
  isRTL,
}: CellEditorProps<T>) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Move focus to next focusable element
        const focusable = document.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const idx = Array.from(focusable).indexOf(e.currentTarget as HTMLElement);
        if (idx >= 0 && idx < focusable.length - 1) {
          focusable[idx + 1].focus();
        }
      }
    },
    []
  );

  if (readOnly) {
    return (
      <span style={{ padding: '4px 8px', display: 'block' }}>
        {String(value ?? '')}
      </span>
    );
  }

  switch (column.type) {
    case 'number':
      return (
        <InputNumber
          value={value as number}
          onChange={(v) => onChange(v)}
          min={column.min}
          precision={column.precision ?? 2}
          controls={false}
          style={{ width: '100%' }}
          onKeyDown={handleKeyDown}
          dir={isRTL ? 'rtl' : 'ltr'}
        />
      );

    case 'money':
      return (
        <InputNumber
          value={value as number}
          onChange={(v) => onChange(v)}
          min={column.min ?? 0}
          precision={column.precision ?? 2}
          controls={false}
          style={{ width: '100%' }}
          onKeyDown={handleKeyDown}
          dir={isRTL ? 'rtl' : 'ltr'}
        />
      );

    case 'select':
      return (
        <Select
          value={value as string | number}
          onChange={(v) => onChange(v)}
          options={column.options}
          style={{ width: '100%' }}
          onKeyDown={handleKeyDown}
        />
      );

    default:
      return (
        <Input
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%' }}
          onKeyDown={handleKeyDown}
        />
      );
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

let _idCounter = 0;
function generateId(): string {
  return `row-${Date.now()}-${++_idCounter}`;
}

export function EditableLineItems<T extends LineItem = LineItem>({
  value,
  onChange,
  columns,
  newRow,
  addLabel,
  readOnly = false,
  showDragHandle = true,
  showDelete = true,
  isDark = false,
  maxRows,
}: EditableLineItemsProps<T>) {
  const { t, i18n } = useTranslation();
  const isRTL = ['ku', 'ar'].includes(i18n.language);
  const containerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = value.findIndex((r) => r.id === active.id);
        const newIndex = value.findIndex((r) => r.id === over.id);
        onChange(arrayMove(value, oldIndex, newIndex));
      }
    },
    [value, onChange]
  );

  const handleCellChange = useCallback(
    (rowId: string, key: string, cellValue: unknown) => {
      onChange(
        value.map((r) => (r.id === rowId ? { ...r, [key]: cellValue } : r))
      );
    },
    [value, onChange]
  );

  const handleDelete = useCallback(
    (rowId: string) => {
      onChange(value.filter((r) => r.id !== rowId));
    },
    [value, onChange]
  );

  const handleAddRow = useCallback(() => {
    const row: T = newRow
      ? newRow()
      : ({ id: generateId() } as T);
    // Ensure id is set
    if (!row.id) (row as LineItem).id = generateId();
    onChange([...value, row]);
  }, [value, onChange, newRow]);

  const canAdd = !readOnly && (maxRows === undefined || value.length < maxRows);

  const headerBg = isDark ? palette.darkSurface : '#fafafa';
  const borderColor = isDark ? palette.darkBorder : palette.border;

  return (
    <div
      ref={containerRef}
      role="grid"
      aria-label={t('line_items.table_label', 'Line items')}
      aria-rowcount={value.length + 1}
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: radius.md,
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <div
        role="row"
        aria-rowindex={1}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space.xs,
          padding: `${space.xs}px ${space.sm}px`,
          background: headerBg,
          borderBottom: `1px solid ${borderColor}`,
          fontWeight: 600,
          fontSize: 13,
          color: isDark ? palette.darkInkMuted : palette.ink500,
        }}
      >
        {showDragHandle && !readOnly && (
          <span style={{ width: 24, flexShrink: 0 }} />
        )}
        {columns.map((col) => (
          <div
            key={col.key}
            role="columnheader"
            style={{
              flex: col.width ? `0 0 ${col.width}` : 1,
              minWidth: 0,
            }}
          >
            {col.title}
          </div>
        ))}
        {showDelete && !readOnly && (
          <span style={{ width: 32, flexShrink: 0 }} />
        )}
      </div>

      {/* Sortable rows */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={value.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          {value.map((row, idx) => (
            <SortableRow
              key={row.id}
              row={row}
              rowIndex={idx}
              columns={columns}
              onCellChange={handleCellChange}
              onDelete={handleDelete}
              showDragHandle={showDragHandle}
              showDelete={showDelete}
              readOnly={readOnly}
              isDark={isDark}
              isRTL={isRTL}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Empty state */}
      {value.length === 0 && (
        <div
          style={{
            padding: `${space.lg}px`,
            textAlign: 'center',
            color: isDark ? palette.darkInkMuted : palette.ink400,
            fontSize: 13,
          }}
        >
          {t('line_items.empty', 'No items yet. Click "Add row" to begin.')}
        </div>
      )}

      {/* Add row button */}
      {canAdd && (
        <div
          style={{
            padding: `${space.xs}px ${space.sm}px`,
            borderTop: value.length > 0 ? `1px solid ${borderColor}` : undefined,
          }}
        >
          <Space>
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddRow}
              aria-label={addLabel ?? t('line_items.add_row', 'Add row')}
            >
              {addLabel ?? t('line_items.add_row', 'Add row')}
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
}

export default EditableLineItems;
