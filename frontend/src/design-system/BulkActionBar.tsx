import React from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { MotionButton } from '../components/MotionButton';
import { useIsDark } from '../hooks/useIsDark';

export interface BulkAction {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}

export interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  actions: BulkAction[];
  isDark?: boolean;
  /** Show as floating bar at bottom of viewport. */
  floating?: boolean;
}

/**
 * BulkActionBar — appears when rows are selected in a DataTable.
 *
 * Vertex "Slate & Signal" kit selection bar: flat var(--surface) card with a
 * hairline 1px var(--border) border, kit radii/elevation, and an accent count
 * pill (var(--accent-soft) / var(--accent-600)). Clear is pushed to the trailing
 * edge with marginInlineStart:auto (RTL-safe, logical properties only).
 *
 * Theme-aware: all colors use the kit CSS-var tokens that auto-flip between
 * light and dark via [data-theme="dark"]; `isDark` (defaulted from the live
 * theme via useIsDark) selects the matching elevation token and guarantees a
 * re-render on theme toggle.
 *
 * Floating mode: pinned to bottom-center of viewport with strong elevation.
 * React.memo applied per Requirements 18.4.
 */
const BulkActionBarInner: React.FC<BulkActionBarProps> = ({
  selectedCount, onClear, actions, isDark: isDarkProp, floating = true,
}) => {
  const { t } = useTranslation();
  // Default isDark from the live theme so the bar adapts even when the consumer
  // does not thread `isDark` (the common case); subscribing also re-renders on toggle.
  const themeDark = useIsDark();
  const isDark = isDarkProp ?? themeDark;

  if (selectedCount <= 0) return null;

  const inner = (
    <div
      role="toolbar"
      aria-label={t('data_table_v2.bulk_actions', 'Bulk actions')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--surface)',
        // Hairline border; in dark mode lift the flat surface off the near-black
        // canvas with the kit's stronger hairline token.
        border: `1px solid ${isDark ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '10px 14px',
        boxShadow: floating ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          height: 24,
          padding: '0 10px',
          borderRadius: 'var(--radius-pill, 999px)',
          background: 'var(--accent-soft)',
          color: 'var(--accent-600)',
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {t('data_table_v2.selected_n', '{{n}} selected', { n: selectedCount })}
      </span>

      <span
        aria-hidden
        style={{
          width: 1,
          alignSelf: 'stretch',
          background: 'var(--border)',
          marginInline: 2,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {actions.map((a) => (
          <MotionButton
            key={a.key}
            icon={a.icon}
            danger={a.danger}
            disabled={a.disabled}
            onClick={() => { void a.onClick(); }}
            size="small"
          >
            {a.label}
          </MotionButton>
        ))}
      </div>

      <MotionButton
        type="text"
        size="small"
        icon={<CloseOutlined />}
        onClick={onClear}
        aria-label={t('data_table_v2.clear_selection', 'Clear selection')}
        style={{ marginInlineStart: 'auto' }}
      >
        {t('data_table_v2.clear_selection', 'Clear selection')}
      </MotionButton>
    </div>
  );

  if (!floating) return inner;
  return (
    <div style={{
      position: 'fixed',
      insetBlockEnd: 48,
      insetInline: 0,
      marginInline: 'auto',
      width: 'fit-content',
      zIndex: 1010,
    }}>
      {inner}
    </div>
  );
};

export const BulkActionBar = React.memo(BulkActionBarInner);

export default BulkActionBar;
