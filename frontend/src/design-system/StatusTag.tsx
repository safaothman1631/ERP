import React from 'react';
import { Tag } from 'antd';
import { palette } from '../theme/tokens';

export type StatusKind =
  | 'draft' | 'pending' | 'approved' | 'rejected'
  | 'paid' | 'partial' | 'unpaid' | 'overdue' | 'sent' | 'viewed'
  | 'open' | 'closed' | 'cancelled' | 'void' | 'posted'
  | 'active' | 'inactive' | 'archived'
  | 'success' | 'warning' | 'error' | 'info' | 'default';

const MAP: Record<StatusKind, { color: string; bg: string; label?: string }> = {
  draft:     { color: palette.ink700, bg: palette.ink100 },
  pending:   { color: palette.warning, bg: palette.warningBg },
  approved:  { color: palette.success, bg: palette.successBg },
  rejected:  { color: palette.danger,  bg: palette.dangerBg },
  paid:      { color: palette.success, bg: palette.successBg },
  partial:   { color: palette.info,    bg: palette.infoBg },
  unpaid:    { color: palette.warning, bg: palette.warningBg },
  overdue:   { color: palette.danger,  bg: palette.dangerBg },
  sent:      { color: palette.info,    bg: palette.infoBg },
  viewed:    { color: palette.primary600, bg: palette.primary50 },
  open:      { color: palette.primary600, bg: palette.primary50 },
  closed:    { color: palette.ink500,  bg: palette.ink100 },
  cancelled: { color: palette.danger,  bg: palette.dangerBg },
  void:      { color: palette.ink500,  bg: palette.ink100 },
  posted:    { color: palette.success, bg: palette.successBg },
  active:    { color: palette.success, bg: palette.successBg },
  inactive:  { color: palette.ink500,  bg: palette.ink100 },
  archived:  { color: palette.ink500,  bg: palette.ink100 },
  success:   { color: palette.success, bg: palette.successBg },
  warning:   { color: palette.warning, bg: palette.warningBg },
  error:     { color: palette.danger,  bg: palette.dangerBg },
  info:      { color: palette.info,    bg: palette.infoBg },
  default:   { color: palette.ink700,  bg: palette.ink100 },
};

export interface StatusTagProps {
  status: StatusKind | string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
}

/**
 * StatusTag — tag یەکسان بۆ هەموو دۆخ. بەرامبەر AntD Tag، token-driven.
 */
export const StatusTag: React.FC<StatusTagProps> = ({ status, label, icon }) => {
  const key = (MAP[status as StatusKind] ? status : 'default') as StatusKind;
  const cfg = MAP[key];
  return (
    <Tag
      variant="filled"
      icon={icon}
      style={{
        color: cfg.color,
        background: cfg.bg,
        fontWeight: 500,
        paddingInline: 10,
        paddingBlock: 2,
        borderRadius: 6,
        margin: 0,
      }}
    >
      {label ?? status}
    </Tag>
  );
};

export default StatusTag;
