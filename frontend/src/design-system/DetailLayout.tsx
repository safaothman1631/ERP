import React from 'react';
import { Tabs, Affix } from 'antd';
import { space, radius, layout } from '../theme/tokens';
import { useIsDark } from '../hooks/useIsDark';

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
 * DetailLayout — record detail page chrome, rebuilt to the Vertex
 * "Slate & Signal" kit (records.jsx `RecordShell`):
 *   • var(--bg) canvas with the kit page-entrance animation
 *   • flat var(--surface) header card with a hairline rule and display-font title
 *   • 70/30 split — main column + sticky var(--surface) side rail
 * Fully theme-aware: every colour resolves from auto-flipping CSS-var tokens, so
 * it is correct in BOTH light and dark with no `isDark` thread-through required.
 *
 * Public props/API unchanged.
 */
export const DetailLayout: React.FC<DetailLayoutProps> = ({
  header, toolbar, tabs, defaultTabKey, children, side,
  hideSideOnNarrow = true, isDark: _isDark, isRTL = false,
}) => {
  // Dark mode auto-flips via CSS-var tokens; we still subscribe so the (rare)
  // explicit `isDark` consumer keeps working and the component re-renders on
  // theme toggle. Tokens carry the actual colours, so no light/dark branching.
  const themeDark = useIsDark();
  void (_isDark ?? themeDark);

  const showSide = !!side;

  return (
    <div
      className="vx-page detail-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: space.md,
        background: 'var(--bg)',
        color: 'var(--ink-900)',
      }}
    >
      {(header || toolbar) && (
        <Affix offsetTop={layout.topbarHeight}>
          <div
            className="detail-layout-header"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderBottom: '1px solid var(--border-strong)',
              boxShadow: 'var(--shadow-sm)',
              padding: `${space.md}px ${space.lg}px`,
              borderRadius: `${radius.lg}px ${radius.lg}px 0 0`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space.md,
              flexWrap: 'wrap',
            }}
          >
            <div
              className="detail-layout-header-title"
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.01em',
                color: 'var(--ink-900)',
              }}
            >
              {header}
            </div>
            {toolbar && (
              <div
                className="detail-layout-toolbar"
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: space.sm }}
              >
                {toolbar}
              </div>
            )}
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
            className={hideSideOnNarrow ? 'detail-layout-side' : 'detail-layout-side detail-layout-side--always'}
            style={{
              position: 'sticky',
              top: layout.topbarHeight + 80,
              maxHeight: `calc(100vh - ${layout.topbarHeight + 100}px)`,
              overflowY: 'auto',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: space.md,
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
