/**
 * POSProductGrid — virtualized 2D product grid.
 *
 * Uses `@tanstack/react-virtual` to render only the visible rows. Each
 * row holds N columns (computed from the container width / target card
 * width), and we virtualize the rows so a 5000-item catalog stays at
 * 60fps on a low-end Android tablet.
 *
 * The grid is intentionally headless about pricing / images — the parent
 * passes a list of `TerminalProduct` records and an `onSelect` callback.
 * Skeleton placeholders fill any cell whose product is still loading
 * (when the parent feeds in `undefined` for a slot — used by infinite
 * scroll later).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Typography, Tag, Empty, Skeleton } from 'antd';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatCurrency } from '../../utils/formatters';
import type { TerminalProduct } from '../../hooks/usePOSTerminal';

const { Text } = Typography;

export interface POSProductGridProps {
  items: Array<TerminalProduct | undefined>;
  onSelect: (item: TerminalProduct) => void;
  /** Approximate width per card in pixels. Used to derive the column count. */
  cardWidth?: number;
  /** Approximate height of each card row. */
  rowHeight?: number;
}

const DEFAULT_CARD_WIDTH = 160;
const DEFAULT_ROW_HEIGHT = 140;
const GAP = 12;

export const POSProductGrid: React.FC<POSProductGridProps> = ({
  items,
  onSelect,
  cardWidth = DEFAULT_CARD_WIDTH,
  rowHeight = DEFAULT_ROW_HEIGHT,
}) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Observe container width — column count is derived from it.
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setContainerWidth(e.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columnCount = useMemo(() => {
    if (containerWidth <= 0) return 4; // best-guess default
    const per = Math.max(1, Math.floor((containerWidth + GAP) / (cardWidth + GAP)));
    return per;
  }, [containerWidth, cardWidth]);

  const rowCount = Math.ceil(items.length / Math.max(columnCount, 1));

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight + GAP,
    overscan: 4,
  });

  if (items.length === 0) {
    return <Empty />;
  }

  return (
    <div
      ref={parentRef}
      style={{ height: '100%', minHeight: 400, overflowY: 'auto', position: 'relative' }}
    >
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowItems = items.slice(startIndex, startIndex + columnCount);
          return (
            <div
              key={virtualRow.key}
              data-row-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0, /* rtl-ignore */
                width: '100%',
                height: rowHeight,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                gap: GAP,
                padding: `0 0 ${GAP}px 0`,
              }}
            >
              {rowItems.map((item, colIdx) => {
                if (!item) {
                  return (
                    <Card key={`skel-${startIndex + colIdx}`} bodyStyle={{ padding: 12 }}>
                      <Skeleton active paragraph={{ rows: 2 }} title={false} />
                    </Card>
                  );
                }
                return (
                  <Card
                    key={item.id}
                    hoverable
                    onClick={() => onSelect(item)}
                    style={{ height: rowHeight, cursor: 'pointer' }}
                    bodyStyle={{ padding: 12 }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'center' }}>
                      <Text strong ellipsis style={{ display: 'block' }}>
                        {item.name_ku || item.name}
                      </Text>
                      {item.sku && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.sku}
                        </Text>
                      )}
                      <Tag color="blue" style={{ alignSelf: 'center' }}>
                        {formatCurrency(item.selling_price ?? 0)}
                      </Tag>
                    </div>
                  </Card>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default POSProductGrid;
