/**
 * KitSearchInput — the Vertex kit's pill-shape search input, 1:1.
 *
 * The kit (shell.jsx + screens.jsx) renders search as a 36px pill with:
 *   ─ subtle `--surface-2` fill on a hairline `--border`,
 *   ─ search icon at the start (muted ink-500),
 *   ─ placeholder + value text,
 *   ─ a clickable close glyph at the end when there's a value.
 *
 * We replace AntD's `<Input prefix=… allowClear>` (which renders a boxy
 * outlined input with the wrong radius and the wrong fill) with this
 * component so every list page's toolbar gets the kit's exact look.
 *
 * Purely token-driven (no hardcoded colours), RTL-correct via logical
 * properties, accent focus ring on focus. Drop-in replacement: same
 * `value` / `onChange` / `placeholder` / `style` props as before.
 */
import React, { useRef } from 'react';
import { SearchOutlined, CloseCircleFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export interface KitSearchInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  /** Optional aria-label override. */
  ariaLabel?: string;
  /** Auto-focus on mount. */
  autoFocus?: boolean;
  /** Default width — kit list pages use 260px. */
  width?: number | string;
}

const KitSearchInput: React.FC<KitSearchInputProps> = ({
  value, onChange, placeholder, style, className, ariaLabel, autoFocus, width = 260,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const label = ariaLabel ?? placeholder ?? t('search', 'Search');

  return (
    <label
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 36,
        width,
        padding: '0 13px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 999,
        color: 'var(--ink-500)',
        fontSize: 13,
        transition: 'border-color .15s, box-shadow .15s',
        cursor: 'text',
        ...style,
      }}
      onFocus={(e) => {
        // Only paint the accent ring when focus enters the inner input — not
        // when the user clicks the close icon (which steals focus briefly).
        if (e.target === inputRef.current) {
          e.currentTarget.style.borderColor = 'var(--accent-500)';
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-soft)';
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Suppress the global a11y.css focus-visible outline on our inner
          input — the OUTER label already paints an accent ring on focus, and
          the global rule (set with !important) would otherwise draw an ugly
          violet rectangle inside the pill. The kit-search-input class
          targets ONLY this input via the css block below.  */}
      <style>{`
        .kit-search-input:focus,
        .kit-search-input:focus-visible {
          outline: none !important;
          box-shadow: none !important;
          border: none !important;
        }
      `}</style>
      <SearchOutlined style={{ fontSize: 14, color: 'var(--ink-500)', flexShrink: 0 }} aria-hidden />
      <input
        ref={inputRef}
        type="text"
        className="kit-search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('search', 'Search')}
        aria-label={label}
        autoFocus={autoFocus}
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--ink-900)',
          fontSize: 13,
          padding: 0,
          fontFamily: 'inherit',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); inputRef.current?.focus(); }}
          aria-label={t('clear', 'Clear')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            padding: 0,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--ink-400)',
            flexShrink: 0,
          }}
        >
          <CloseCircleFilled style={{ fontSize: 14 }} />
        </button>
      )}
    </label>
  );
};

export default KitSearchInput;
