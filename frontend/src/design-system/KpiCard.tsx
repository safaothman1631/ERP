import React from 'react';
import { Card, Statistic, Skeleton, Tooltip } from 'antd';
import { motion } from 'framer-motion';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { palette, radius, shadow, space } from '../theme/tokens';

export interface KpiCardProps {
  title: React.ReactNode;
  value: number | string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  icon?: React.ReactNode;
  trend?: number;        // %
  trendLabel?: string;
  loading?: boolean;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  hint?: string;
  onClick?: () => void;
}

const TONE_BG: Record<NonNullable<KpiCardProps['tone']>, string> = {
  primary: palette.primary50,
  success: palette.successBg,
  warning: palette.warningBg,
  danger:  palette.dangerBg,
  info:    palette.infoBg,
};
const TONE_COLOR: Record<NonNullable<KpiCardProps['tone']>, string> = {
  primary: palette.primary600,
  success: palette.success,
  warning: palette.warning,
  danger:  palette.danger,
  info:    palette.info,
};

/**
 * KpiCard — کارتی متریک بۆ داشبۆرد، animated value + trend indicator.
 */
export const KpiCard: React.FC<KpiCardProps> = ({
  title, value, prefix, suffix, icon, trend, trendLabel, loading, tone = 'primary', hint, onClick,
}) => {
  const trendUp = (trend ?? 0) >= 0;
  return (
    <motion.div
      whileHover={onClick ? { y: -2 } : undefined}
      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
    >
      <Card
        hoverable={!!onClick}
        onClick={onClick}
        styles={{ body: { padding: space.lg } }}
        style={{ borderRadius: radius.lg, boxShadow: shadow.sm, height: '100%', cursor: onClick ? 'pointer' : 'default' }}
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
              <Tooltip title={hint}>
                <span style={{ color: palette.ink500, fontSize: 13, fontWeight: 500 }}>{title}</span>
              </Tooltip>
              {icon && (
                <div style={{
                  width: 36, height: 36, borderRadius: radius.md,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: TONE_BG[tone], color: TONE_COLOR[tone], fontSize: 18,
                }}>{icon}</div>
              )}
            </div>
            <Statistic value={value} prefix={prefix} suffix={suffix} styles={{ content: { fontWeight: 600, fontSize: 24 } }} />
            {typeof trend === 'number' && (
              <div style={{ marginTop: space.sm, fontSize: 12, color: trendUp ? palette.success : palette.danger, display: 'flex', alignItems: 'center', gap: 4 }}>
                {trendUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                <span>{Math.abs(trend).toFixed(1)}%</span>
                {trendLabel && <span style={{ color: palette.ink500 }}>· {trendLabel}</span>}
              </div>
            )}
          </>
        )}
      </Card>
    </motion.div>
  );
};

export default KpiCard;
