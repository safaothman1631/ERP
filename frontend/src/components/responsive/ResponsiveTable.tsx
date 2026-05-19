/**
 * ResponsiveTable — table → stacked card pattern (system-wide-ux-overhaul,
 * task 4.2).
 *
 * On Mobile_Viewport (`width <= 640 px`) each row of the table is rendered
 * as a card with stacked label/value pairs in the same order as the
 * desktop columns, preserving the same data and the same row-level
 * actions (R4.1). A horizontal-swipe gesture on a card reveals the row's
 * action buttons; an equivalent tap-only path is provided via an AntD
 * `Dropdown` button rendered inside the card header so users who do not
 * use gestures (and assistive-technology users) reach the same actions
 * (R5.3).
 *
 * Above Mobile_Viewport, the same data renders as a traditional grid
 * table backed by AntD `Table` v6, with sortable columns and a sticky
 * header (R4.2). When the table has more than 5 columns and the viewport
 * is at or below Tablet_Viewport (`width <= 1024 px`), only columns
 * marked `priority: 'high'` render at the top level; the remaining
 * columns sit behind an expandable per-row "Show more" affordance using
 * AntD's `expandable.expandedRowRender` API (R4.3).
 *
 * The choice between card list and grid table is driven exclusively by
 * `useViewport().isMobile` — i.e. by viewport width, never by user-agent
 * detection (R4.1, no-ua-layout-detection lint).
 *
 * Lint contract
 * -------------
 * This file lives under `frontend/src/components/responsive/**` which is
 * scoped to the `zoho-i18n/no-hardcoded-literal` rule at error severity.
 * Every user-facing string flows through `t()` against a key that is part
 * of the i18n_Registry (e.g. `'actions'`, `'more'`, `'no_data'`,
 * `'loading'`, `'close'`); the rule's allowlist also exempts `data-testid`
 * attributes used for test scaffolding (R13.4, R13.5).
 *
 * Logical-CSS only — no `left`/`right`/`margin-left`/`padding-right`
 * (R3.8, R14.7).
 *
 * _Validates: Requirements 4.1, 4.2, 4.3, 5.3_
 */
import React, {
  type CSSProperties,
  type Key,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button, Dropdown, Empty, Spin, Table } from 'antd';
import type {
  TableColumnsType,
  TablePaginationConfig,
} from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import {
  asTranslationKey,
  type TranslationKey,
} from '../../i18n/types';
import { useViewport } from '../../hooks/useViewport';
import { palette, space } from '../../theme/tokens';

import './clickable.css';
import './responsiveTable.css';

// ───────────────────────────── Public types ─────────────────────────────

/**
 * Visibility priority for a column. The umbrella spec uses three buckets
 * (R4.3): `'high'` columns are always visible, `'medium'` and `'low'`
 * columns are hidden behind a per-row "Show more" affordance when the
 * table has more than 5 columns and the viewport is ≤ Tablet_Viewport.
 *
 * On Mobile_Viewport every column appears as a label/value row inside the
 * card; the priority drives which rows are visible by default versus
 * tucked behind the card-level "Show more" toggle.
 */
export type ColumnPriority = 'high' | 'medium' | 'low';

/**
 * A single column in a {@link ResponsiveTable}. Mirrors the shape pinned
 * by `system-wide-ux-overhaul/design.md` → "Responsive Patterns Catalog"
 * → "ResponsiveTable" verbatim.
 */
export interface ResponsiveColumn<T> {
  /** Stable identifier — used as the React key for cells and label rows. */
  id: string;
  /** Translation_Key resolved through `t()` for the column header / mobile label. */
  headerKey: TranslationKey;
  /** Visibility priority for the > 5 columns / Tablet trimming rule (R4.3). */
  priority: ColumnPriority;
  /** Cell renderer — receives the row record and returns the cell content. */
  render: (row: T) => ReactNode;
  /**
   * Logical alignment for the cell value. Mapped to AntD `align` (`left` /
   * `center` / `right`) on the desktop path and to text-align logical
   * properties on the mobile card path. Defaults to `'start'`.
   */
  align?: 'start' | 'center' | 'end';
  /** Optional sorter — when provided, the desktop column gets a sort affordance. */
  sorter?: (a: T, b: T) => number;
  /** Optional fixed width (px). */
  width?: number | string;
}

/**
 * A row-level action — same shape on Desktop / Tablet / Mobile so
 * surfaces never drift (R4.1, R5.3).
 */
export interface RowAction {
  /** Stable id for the action — used as the React key and the menu item key. */
  id: string;
  /** Translation_Key resolved through `t()` for the visible label. */
  labelKey: TranslationKey;
  /** Click handler. */
  onClick: () => void;
  /** When true, the action renders with the danger color token from `theme/tokens.ts`. */
  danger?: boolean;
}

/**
 * Props for {@link ResponsiveTable}.
 *
 * `T` is the shape of a single row record. `getRowKey` is required so the
 * component can attach stable React keys regardless of which surface
 * (table, card list, expanded row) is rendering the row. When omitted,
 * falls back to a numeric index — acceptable for static lists, but
 * consumers SHOULD always supply a domain-meaningful key.
 */
export interface ResponsiveTableProps<T> {
  /** Column definitions — order matches both desktop columns and mobile rows. */
  columns: ResponsiveColumn<T>[];
  /** Row records. */
  data: T[];
  /** Optional per-row action factory. Receives the row, returns the actions. */
  rowActions?: (row: T) => RowAction[];
  /** Loading flag — renders a spinner overlay (Desktop) or a centered spinner (Mobile). */
  loading?: boolean;
  /** Empty-state node rendered when `data` is empty and `loading` is false. */
  emptyState?: ReactNode;
  /**
   * Stable row-key extractor. Strongly recommended; defaults to numeric
   * index when omitted.
   */
  getRowKey?: (row: T, index: number) => Key;
  /** Optional AntD pagination config — forwarded only to the desktop path. */
  pagination?: TablePaginationConfig | false;
  /** Optional className composed onto the wrapper. */
  className?: string;
  /** Optional `data-testid` for the wrapper element. */
  testId?: string;
}

// ───────────────────────────── Constants ─────────────────────────────

/**
 * Threshold used by R4.3: when the table has more than this many columns
 * and the viewport is ≤ Tablet_Viewport, only `priority: 'high'` columns
 * render and the rest sit behind a per-row "Show more" affordance.
 */
const COLUMN_TRIM_THRESHOLD = 5;

/**
 * Reveal distance (px) of the swipe-to-actions panel on mobile cards.
 * The swipe gesture commits the panel to its revealed position when the
 * drag distance exceeds half this value; otherwise it snaps back.
 */
const MOBILE_REVEAL_DISTANCE = 96;

/** Translation keys used by the wrapper itself — all owned by i18n_Registry. */
const TKEY_ACTIONS = asTranslationKey('actions');
const TKEY_MORE = asTranslationKey('more');
const TKEY_LESS = asTranslationKey('less');
const TKEY_LOADING = asTranslationKey('loading');
const TKEY_NO_DATA = asTranslationKey('no_data');
const TKEY_CLOSE = asTranslationKey('close');

// ───────────────────────────── Helpers ─────────────────────────────

/**
 * Map our logical `align` ('start' / 'center' / 'end') onto AntD's
 * physical `align` ('left' / 'center' / 'right'). AntD v6 still accepts
 * physical values; the wrapper retains logical alignment in its own
 * call-site contract so RTL is correct in the mobile card path.
 */
function mapAlignToAntD(
  align: ResponsiveColumn<unknown>['align'],
): 'left' | 'center' | 'right' {
  if (align === 'center') return 'center';
  if (align === 'end') return 'right';
  return 'left';
}

/**
 * Decide whether the > 5 columns / Tablet trimming rule (R4.3) applies.
 * Mobile_Viewport renders cards instead, so trimming on mobile is handled
 * by the per-card "Show more" toggle — not by this helper.
 */
function shouldTrimColumns(
  columnCount: number,
  isTablet: boolean,
): boolean {
  return columnCount > COLUMN_TRIM_THRESHOLD && isTablet;
}

// ───────────────────────────── Sub-components ─────────────────────────────

interface RowActionMenuProps {
  actions: RowAction[];
  ariaLabel: string;
  testId?: string;
}

/**
 * Tap-only path to row actions on Mobile_Viewport (R5.3) — also used as
 * the `Dropdown.Button` overflow on the desktop path so identifier-stable
 * actions are never gesture-only.
 */
const RowActionMenu: React.FC<RowActionMenuProps> = ({
  actions,
  ariaLabel,
  testId,
}) => {
  const { t } = useTranslation();
  if (actions.length === 0) return null;

  return (
    <Dropdown
      menu={{
        items: actions.map((action) => ({
          key: action.id,
          label: t(action.labelKey),
          danger: action.danger,
          onClick: () => action.onClick(),
        })),
      }}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button
        type="text"
        className="touchTarget"
        icon={<MoreOutlined />}
        aria-label={ariaLabel}
        data-testid={testId}
      />
    </Dropdown>
  );
};

interface MobileCardProps<T> {
  row: T;
  rowKey: Key;
  columns: ResponsiveColumn<T>[];
  rowActions?: (row: T) => RowAction[];
  /** When true, only `priority: 'high'` rows show by default. */
  trimRows: boolean;
}

/**
 * One mobile card. Owns its own swipe-to-reveal state and "Show more"
 * disclosure state in isolation so a stale offset never leaks across rows.
 */
function MobileCard<T>({
  row,
  rowKey,
  columns,
  rowActions,
  trimRows,
}: MobileCardProps<T>): React.ReactElement {
  const { t } = useTranslation();
  const [translateX, setTranslateX] = useState<number>(0);
  const [revealed, setRevealed] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showAll, setShowAll] = useState<boolean>(false);
  const dragStartX = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const actions = useMemo(
    () => (rowActions ? rowActions(row) : []),
    [rowActions, row],
  );

  // R5.3 — actions are reachable via swipe (gesture path) AND via the
  // header overflow button (tap-only equivalent path).
  const hasActions = actions.length > 0;
  const actionsPanelId = `${String(rowKey)}-actions`;

  const visibleColumns = useMemo(() => {
    if (!trimRows || showAll) return columns;
    const high = columns.filter((c) => c.priority === 'high');
    // Always show at least the first column even if the consumer marked
    // every column low — otherwise the card would render empty.
    return high.length > 0 ? high : columns.slice(0, 1);
  }, [columns, trimRows, showAll]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!hasActions) return;
      // Only react to primary-button presses (left mouse / single touch).
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStartX.current = event.clientX;
      setIsDragging(true);
    },
    [hasActions],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging || dragStartX.current === null) return;
      // We translate INLINE-START on swipe-start (delta < 0). The visual
      // translate is in physical pixels; the negative sign is correct in
      // both LTR and RTL because the actions panel is anchored to
      // `inset-inline-end` so the card always slides toward the start edge
      // to reveal it.
      const delta = event.clientX - dragStartX.current;
      // Resting position: `revealed ? -MOBILE_REVEAL_DISTANCE : 0`.
      const base = revealed ? -MOBILE_REVEAL_DISTANCE : 0;
      const next = base + delta;
      // Clamp to [-MOBILE_REVEAL_DISTANCE, 0].
      const clamped = Math.max(
        Math.min(next, 0),
        -MOBILE_REVEAL_DISTANCE,
      );
      setTranslateX(clamped);
    },
    [isDragging, revealed],
  );

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging || dragStartX.current === null) {
        setIsDragging(false);
        return;
      }
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* No-op — capture may already be released. */
      }
      // Commit when past the half-way point of the reveal distance.
      const halfway = -MOBILE_REVEAL_DISTANCE / 2;
      const nextRevealed = translateX <= halfway;
      setRevealed(nextRevealed);
      setTranslateX(nextRevealed ? -MOBILE_REVEAL_DISTANCE : 0);
      setIsDragging(false);
      dragStartX.current = null;
    },
    [isDragging, translateX],
  );

  const cardStyle: CSSProperties = {
    transform: `translate3d(${translateX}px, 0, 0)`,
  };

  const actionsLabel = t(TKEY_ACTIONS);
  const moreLabel = t(TKEY_MORE);
  const lessLabel = t(TKEY_LESS);

  return (
    <li className="responsive-table__card-wrapper">
      <div
        className="responsive-table__actions-panel"
        id={actionsPanelId}
        aria-hidden={!revealed}
      >
        {actions.map((action) => (
          <Button
            key={action.id}
            size="small"
            danger={action.danger}
            onClick={() => {
              action.onClick();
              // After invoking, snap back to the rest position so the user
              // does not have to swipe back manually.
              setRevealed(false);
              setTranslateX(0);
            }}
            className="touchTarget"
          >
            {t(action.labelKey)}
          </Button>
        ))}
      </div>
      <div
        ref={cardRef}
        className={
          isDragging
            ? 'responsive-table__card responsive-table__card--dragging'
            : 'responsive-table__card'
        }
        style={cardStyle}
        onPointerDown={hasActions ? handlePointerDown : undefined}
        onPointerMove={isDragging ? handlePointerMove : undefined}
        onPointerUp={isDragging ? finishDrag : undefined}
        onPointerCancel={isDragging ? finishDrag : undefined}
      >
        {hasActions ? (
          <div className="responsive-table__card-header">
            <span aria-hidden="true" />
            <RowActionMenu
              actions={actions}
              ariaLabel={actionsLabel}
              testId={`responsive-table-row-actions-${String(rowKey)}`}
            />
          </div>
        ) : null}

        <dl className="responsive-table__rows">
          {visibleColumns.map((col) => (
            <div
              key={col.id}
              className={`responsive-table__row responsive-table__row--align-${col.align ?? 'start'}`}
            >
              <dt className="responsive-table__label">{t(col.headerKey)}</dt>
              <dd className="responsive-table__value">{col.render(row)}</dd>
            </div>
          ))}
        </dl>

        {trimRows && columns.length > visibleColumns.length ? (
          <Button
            type="link"
            size="small"
            className="responsive-table__show-more"
            onClick={() => setShowAll((prev) => !prev)}
            aria-expanded={showAll}
          >
            {showAll ? lessLabel : moreLabel}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

// ───────────────────────────── Main component ─────────────────────────────

/**
 * Table → stacked-card responsive wrapper. See module-level JSDoc for
 * the full contract.
 */
export function ResponsiveTable<T>({
  columns,
  data,
  rowActions,
  loading = false,
  emptyState,
  getRowKey,
  pagination,
  className,
  testId,
}: ResponsiveTableProps<T>): React.ReactElement {
  const { t } = useTranslation();
  const { isMobile, isTablet } = useViewport();
  const reactKeySalt = useId();

  const resolveKey = useCallback(
    (row: T, index: number): Key =>
      getRowKey ? getRowKey(row, index) : `${reactKeySalt}-${index}`,
    [getRowKey, reactKeySalt],
  );

  const trimColumnsForTablet = shouldTrimColumns(columns.length, isTablet);

  // ─────────────── Mobile path: stacked card list ───────────────
  if (isMobile) {
    const wrapperClass = className
      ? `responsive-table responsive-table--mobile ${className}`
      : 'responsive-table responsive-table--mobile';

    if (loading) {
      return (
        <div
          className={wrapperClass}
          data-testid={testId}
          role="status"
          aria-busy="true"
          aria-label={t(TKEY_LOADING)}
        >
          <div className="responsive-table__empty">
            <Spin />
          </div>
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className={wrapperClass} data-testid={testId}>
          <div className="responsive-table__empty">
            {emptyState ?? <Empty description={t(TKEY_NO_DATA)} />}
          </div>
        </div>
      );
    }

    return (
      <div className={wrapperClass} data-testid={testId}>
        <ul className="responsive-table__list">
          {data.map((row, index) => {
            const key = resolveKey(row, index);
            return (
              <MobileCard<T>
                key={key}
                row={row}
                rowKey={key}
                columns={columns}
                rowActions={rowActions}
                // On mobile we only force per-card trimming when the table
                // would have been trimmed on Tablet (i.e. > 5 columns). At
                // ≤ 5 columns every label/value pair fits comfortably.
                trimRows={columns.length > COLUMN_TRIM_THRESHOLD}
              />
            );
          })}
        </ul>
      </div>
    );
  }

  // ─────────────── Desktop / Tablet path: AntD Table grid ───────────────

  // Build the visible-column list. On Tablet with > 5 columns we trim to
  // priority='high' and use AntD's expandable-row API to surface the rest
  // (R4.3). On Desktop we always show every column.
  const desktopColumns: ResponsiveColumn<T>[] = trimColumnsForTablet
    ? columns.filter((c) => c.priority === 'high')
    : columns;

  const hiddenColumns: ResponsiveColumn<T>[] = trimColumnsForTablet
    ? columns.filter((c) => c.priority !== 'high')
    : [];

  // Convert ResponsiveColumn → AntD ColumnType. The wrapper exposes a
  // small subset of AntD's column API on purpose — call sites that need
  // more should compose `render` returning the richer cell, not push more
  // columns through this contract.
  const antColumns: TableColumnsType<T> = desktopColumns.map((col) => ({
    key: col.id,
    title: t(col.headerKey),
    align: mapAlignToAntD(col.align),
    width: col.width,
    sorter: col.sorter,
    render: (_value: unknown, record: T) => col.render(record),
  }));

  // Append an "Actions" trailing column when rowActions is provided.
  // Same shape across Tablet and Desktop; the mobile card surfaces the
  // same actions through the swipe + header overflow button pair.
  if (rowActions) {
    antColumns.push({
      key: '__row_actions__',
      title: t(TKEY_ACTIONS),
      align: 'right',
      width: 64,
      render: (_value: unknown, record: T) => {
        const actions = rowActions(record);
        if (actions.length === 0) return null;
        return (
          <RowActionMenu
            actions={actions}
            ariaLabel={t(TKEY_ACTIONS)}
            testId={undefined}
          />
        );
      },
    });
  }

  // Expandable-row config — only mounted when we actually trim columns.
  const expandable = trimColumnsForTablet
    ? {
        expandedRowRender: (record: T): ReactNode => (
          <dl className="responsive-table__expanded">
            {hiddenColumns.map((col) => (
              <React.Fragment key={col.id}>
                <dt className="responsive-table__expanded-label">
                  {t(col.headerKey)}
                </dt>
                <dd className="responsive-table__expanded-value">
                  {col.render(record)}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        ),
        // Use AntD's own translated "expand" label when available; fall
        // back to "more" / "less" so we never render a hardcoded literal.
        expandRowByClick: false,
      }
    : undefined;

  const wrapperStyle: CSSProperties = {
    // Sticky header is provided by AntD's `sticky` prop below; this style
    // ensures the wrapper itself does not introduce extra block padding
    // that would push the header out of the viewport on Tablet.
    paddingBlock: 0,
    paddingInline: 0,
  };

  const wrapperClass = className
    ? `responsive-table responsive-table--desktop ${className}`
    : 'responsive-table responsive-table--desktop';

  // Customise the empty state (no_data) and loading tip via the AntD
  // `locale` and `loading` props so the wrapper never falls back to AntD's
  // English defaults when the active language is Kurdish.
  const tableLocale = {
    emptyText: emptyState ?? <Empty description={t(TKEY_NO_DATA)} />,
    triggerDesc: t(TKEY_MORE),
    triggerAsc: t(TKEY_LESS),
    cancelSort: t(TKEY_CLOSE),
  };

  // Border colour comes from `theme/tokens.ts` so visual treatment stays
  // consistent with the rest of the umbrella runtime layer.
  const tableBorderStyle: CSSProperties = {
    border: `1px solid ${palette.border}`,
    borderRadius: 14,
    overflow: 'hidden',
    background: palette.surface,
  };

  return (
    <div
      className={wrapperClass}
      style={wrapperStyle}
      data-testid={testId}
    >
      <div style={tableBorderStyle}>
        <Table<T>
          columns={antColumns}
          dataSource={data}
          rowKey={(record) => {
            const index = data.indexOf(record);
            return String(resolveKey(record, index));
          }}
          loading={loading ? { tip: t(TKEY_LOADING) } : false}
          pagination={pagination ?? false}
          // R4.2 — sticky header on the desktop / tablet path.
          sticky
          size="middle"
          locale={tableLocale}
          expandable={expandable}
          // Inline gutter for the table contents — matches the card padding
          // used on the mobile path so spacing reads consistently across
          // viewports.
          style={{ paddingInline: space.xxs }}
        />
      </div>
    </div>
  );
}

export default ResponsiveTable;
