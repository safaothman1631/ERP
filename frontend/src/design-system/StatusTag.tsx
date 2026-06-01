import React from 'react';

export type StatusKind =
  | 'draft' | 'pending' | 'approved' | 'rejected'
  | 'paid' | 'partial' | 'unpaid' | 'overdue' | 'sent' | 'viewed'
  | 'open' | 'closed' | 'cancelled' | 'void' | 'posted'
  | 'active' | 'inactive' | 'archived'
  | 'success' | 'warning' | 'error' | 'info' | 'default';

/**
 * Status palette — kit `vx-tag` triplet: [background, foreground, dot].
 * Each value is a Vertex CSS-var token (`src/theme/vertex-tokens.css`) that
 * auto-flips for dark mode via `[data-theme="dark"]` on <html>, so the tag is
 * correct in BOTH light and dark with no JS palette branching.
 */
type TagTokens = { bg: string; fg: string; dot: string };

const SUCCESS: TagTokens = { bg: 'var(--success-bg)', fg: 'var(--success-fg)', dot: 'var(--success-500)' };
const WARNING: TagTokens = { bg: 'var(--warning-bg)', fg: 'var(--warning-fg)', dot: 'var(--warning-500)' };
const DANGER:  TagTokens = { bg: 'var(--danger-bg)',  fg: 'var(--danger-fg)',  dot: 'var(--danger-500)' };
const INFO:    TagTokens = { bg: 'var(--info-bg)',    fg: 'var(--info-fg)',    dot: 'var(--info-500)' };
const ACCENT:  TagTokens = { bg: 'var(--accent-soft)', fg: 'var(--accent-500)', dot: 'var(--accent-500)' };
const NEUTRAL: TagTokens = { bg: 'var(--surface-2)',  fg: 'var(--ink-500)',    dot: 'var(--ink-300)' };

const MAP: Record<StatusKind, TagTokens> = {
  draft:     NEUTRAL,
  pending:   WARNING,
  approved:  SUCCESS,
  rejected:  DANGER,
  paid:      SUCCESS,
  partial:   WARNING,
  unpaid:    WARNING,
  overdue:   DANGER,
  sent:      INFO,
  viewed:    ACCENT,
  open:      ACCENT,
  closed:    NEUTRAL,
  cancelled: DANGER,
  void:      NEUTRAL,
  posted:    SUCCESS,
  active:    SUCCESS,
  inactive:  NEUTRAL,
  archived:  NEUTRAL,
  success:   SUCCESS,
  warning:   WARNING,
  error:     DANGER,
  info:      INFO,
  default:   NEUTRAL,
};

export interface StatusTagProps {
  status: StatusKind | string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  /** Optional accessible label override. Defaults to the displayed label text. */
  ariaLabel?: string;
}

/**
 * StatusTag — Vertex kit `vx-tag` chip: 22px tall, 11.5px / 600, a small status
 * dot, status-tinted bg/fg via semantic tokens. Token-driven and fully
 * theme-aware (light + dark) — no AntD `Tag`, no hardcoded colors.
 * role="status" per WCAG AA — Requirements: 17.6
 * React.memo applied per Requirements 18.4.
 */
const StatusTagInner: React.FC<StatusTagProps> = ({ status, label, icon, ariaLabel }) => {
  const key = (MAP[status as StatusKind] ? status : 'default') as StatusKind;
  const cfg = MAP[key];
  const displayLabel = label ?? status;
  return (
    <span
      role="status"
      aria-label={ariaLabel ?? (typeof displayLabel === 'string' ? displayLabel : String(status))}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        paddingInline: 9,
        borderRadius: 'var(--radius-sm)',
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: '.01em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color: cfg.fg,
        background: cfg.bg,
      }}
    >
      {icon ?? (
        <span
          aria-hidden
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: cfg.dot,
            flexShrink: 0,
          }}
        />
      )}
      {displayLabel}
    </span>
  );
};

export const StatusTag = React.memo(StatusTagInner);

export default StatusTag;
