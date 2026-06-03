/**
 * KitListCard — the Vertex kit's list composition, reproduced 1:1.
 *
 * In the Vertex kit EVERY list screen (invoices, contacts, items, bills, …) is
 * rendered by ONE component (`ListScreen` in screens.jsx) with this exact shape:
 *
 *   ┌─ vx-card (surface, hairline border, radius-xl, overflow:hidden) ──────────┐
 *   │  [ Tab strip ]   All · Customers · Vendors · …   (active = accent + 2px bar)│
 *   │  ──────────────────────────────────────────────────────────── hairline    │
 *   │  [ Toolbar ]     Search…            Filters  Status        ⋯  ⋮            │
 *   │  ──────────────────────────────────────────────────────────────────────── │
 *   │  [ children ]    the table                                                 │
 *   └────────────────────────────────────────────────────────────────────────────┘
 *
 * Our app's list pages were bespoke (PageHeader + a loose search row + a bare
 * AntD table) — they had NO tabs and the table was not wrapped in the card, so
 * they never matched the kit no matter how the table itself was recolored. This
 * component restores the kit's structure. Pages keep their own data/logic and
 * just compose their toolbar + table inside it.
 *
 * Pure tokens (CSS vars from vertex-tokens.css) — adapts to light/dark and RTL
 * automatically (logical properties only). No hardcoded colors.
 */
import React from 'react';

export interface KitListTab {
  /** Stable key passed back to onTabChange. */
  key: string;
  /** Visible label (already translated). */
  label: React.ReactNode;
  /** Optional count badge shown after the label (omit to hide). */
  count?: number;
}

export interface KitListCardProps {
  /** Tab strip definitions. Omit/empty to render the card with no tabs. */
  tabs?: KitListTab[];
  /** Currently-active tab key. */
  activeTab?: string;
  /** Fired when a tab is clicked. */
  onTabChange?: (key: string) => void;
  /** Toolbar content (search input + filter/action buttons). Laid out in a flex row. */
  toolbar?: React.ReactNode;
  /** The table (or any body content). */
  children: React.ReactNode;
  /** Optional extra style for the outer card. */
  style?: React.CSSProperties;
  className?: string;
}

/** The kit's `vx-card` surface, expressed with our token CSS vars.
 *
 * NOTE: no boxShadow + NO border. On dark backgrounds the `--border` token
 * (`rgba(255,255,255,0.08)`) renders as a visible WHITE hairline frame around
 * the card — the user's repeated "چوارچێوەی سپی" complaint. The surface
 * (`--surface = #11151F`) is already a step lighter than the canvas
 * (`--bg = #0B0E14`), so the card is clearly delimited by its background
 * alone, with no need for a border. */
const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 'var(--radius-xl, 16px)',
  overflow: 'hidden',
};

const KitListCard: React.FC<KitListCardProps> = ({
  tabs,
  activeTab,
  onTabChange,
  toolbar,
  children,
  style,
  className,
}) => {
  const hasTabs = Array.isArray(tabs) && tabs.length > 0;

  return (
    <div className={className} style={{ ...cardStyle, ...style }}>
      {hasTabs && (
        <div
          role="tablist"
          className="vx-tabstrip"
          style={{
            display: 'flex',
            gap: 4,
            padding: '4px 12px 0',
            borderBottom: '1px solid var(--border)',
            overflowX: 'auto',
          }}
        >
          {tabs!.map((t) => {
            const active = t.key === activeTab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange?.(t.key)}
                style={{
                  position: 'relative',
                  border: 'none',
                  background: 'none',
                  padding: '12px',
                  cursor: 'pointer',
                  fontSize: 13.5,
                  fontWeight: active ? 600 : 500,
                  color: active ? 'var(--accent-500)' : 'var(--ink-500)',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'color .15s',
                }}
              >
                {t.label}
                {typeof t.count === 'number' && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      lineHeight: 1,
                      padding: '2px 6px',
                      borderRadius: 999,
                      background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                      color: active ? 'var(--accent-500)' : 'var(--ink-500)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {t.count}
                  </span>
                )}
                {active && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      insetInline: 8,
                      bottom: -1,
                      height: 2,
                      background: 'var(--accent-500)',
                      borderRadius: 2,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {toolbar && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            flexWrap: 'wrap',
          }}
        >
          {toolbar}
        </div>
      )}

      {children}
    </div>
  );
};

export default KitListCard;
