import React from 'react';
import { Tabs, Affix } from 'antd';
import { palette, space, radius, layout } from '../theme/tokens';

export interface DetailLayoutTab {
  key: string;
  label: React.ReactNode;
  children: React.ReactNode;
}

export interface DetailLayoutProps {
  /** Sticky title + subtitle + actions row at top of body. */
  header?: React.ReactNode;
  /** Sticky toolbar (Approve / Cancel / Edit / Send …). Overrides header.actions. */
  toolbar?: React.ReactNode;
  /** Optional tabs row beneath header. */
  tabs?: DetailLayoutTab[];
  defaultTabKey?: string;
  /** Main left column (≈ 70%). If `tabs` provided, replaces children. */
  children?: React.ReactNode;
  /** Right column (≈ 30%). e.g. ActivityFeed, Attachments, Comments. */
  side?: React.ReactNode;
  /** Disable side column on small screens. */
  hideSideOnNarrow?: boolean;
  isDark?: boolean;
  isRTL?: boolean;
}

/**
 * DetailLayout — Sprint 6 — 70/30 split for record detail pages.
 * Standard chrome: sticky toolbar + optional tabs + main column + side column.
 */
export const DetailLayout: React.FC<DetailLayoutProps> = ({
  header, toolbar, tabs, defaultTabKey, children, side,
  hideSideOnNarrow = true, isDark = false, isRTL = false,
}) => {
  const showSide = !!side;
  const sep = isDark ? palette.darkBorder : palette.border;
  const surface = isDark ? palette.darkSurface : palette.surface;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.md }}>
      {(header || toolbar) && (
        <Affix offsetTop={layout.topbarHeight}>
          <div style={{
            background: surface,
            borderBottom: `1px solid ${sep}`,
            padding: `${space.md}px ${space.lg}px`,
            borderRadius: `${radius.md}px ${radius.md}px 0 0`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: space.md, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>{header}</div>
            {toolbar && <div style={{ flexShrink: 0 }}>{toolbar}</div>}
          </div>
        </Affix>
      )}

      <div
        className="detail-layout-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: showSide ? `minmax(0, 1fr) ${layout.detailSplitDefault}px` : '1fr',
          gap: space.lg,
          alignItems: 'flex-start',
          direction: isRTL ? 'rtl' : 'ltr',
        }}
      >
        <main style={{ minWidth: 0 }}>
          {tabs && tabs.length > 0 ? (
            <Tabs defaultActiveKey={defaultTabKey ?? tabs[0]?.key} items={tabs} />
          ) : children}
        </main>
        {showSide && (
          <aside
            className={hideSideOnNarrow ? 'detail-layout-side' : ''}
            style={{
              position: 'sticky', top: layout.topbarHeight + 80,
              maxHeight: `calc(100vh - ${layout.topbarHeight + 100}px)`,
              overflowY: 'auto', minWidth: 0,
            }}
          >
            {side}
          </aside>
        )}
      </div>

      {hideSideOnNarrow && (
        <style>{`
          @media (max-width: 992px) {
            .detail-layout-grid { grid-template-columns: 1fr !important; }
            .detail-layout-side { position: static !important; max-height: none !important; }
          }
        `}</style>
      )}
    </div>
  );
};

export default DetailLayout;
