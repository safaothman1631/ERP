import React from 'react';
import { Card, Space, Typography } from 'antd';

const { Text } = Typography;

export interface SectionCardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  extra?: React.ReactNode;
  bordered?: boolean;
  padded?: boolean;
  elevation?: 0 | 1 | 2;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}

/**
 * SectionCard — تەنها سەرچاوەی container-ـی section لە forms/settings/details.
 * Vertex kit `.vx-card`: flat var(--surface) on var(--bg), 1px var(--border) hairline,
 * var(--radius-lg) corners, hairline header with var(--ink-900) title. Fully theme-aware
 * via CSS var tokens (auto-flip on [data-theme="dark"]) — no hardcoded surface/text colors.
 * React.memo applied per Requirements 18.4.
 */
const SectionCardInner: React.FC<SectionCardProps> = ({
  title, subtitle, extra, bordered = true, padded = true, elevation = 1, children, style, bodyStyle,
}) => {
  // Kit cards are flat; elevation maps to kit shadow tokens (auto-flip in dark).
  const elev = elevation === 0 ? 'none' : elevation === 1 ? 'var(--shadow-sm)' : 'var(--shadow-md)';
  const header = title ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
      <Space direction="vertical" size={2}>
        <Text
          strong
          style={{
            fontSize: 15,
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.01em',
            color: 'var(--ink-900)',
          }}
        >
          {title}
        </Text>
        {subtitle && <Text style={{ fontSize: 13, color: 'var(--ink-500)' }}>{subtitle}</Text>}
      </Space>
      {extra}
    </div>
  ) : undefined;
  return (
    <Card
      className="vx-card"
      bordered={bordered}
      style={{
        background: 'var(--surface)',
        border: bordered ? '1px solid var(--border)' : 'none',
        borderRadius: 'var(--radius-lg)',
        boxShadow: elev,
        marginBottom: 'var(--space-xl)',
        ...style,
      }}
      styles={{
        header: header ? { borderBottom: '1px solid var(--border)' } : undefined,
        body:   { padding: padded ? 'var(--space-xl)' : 0, ...bodyStyle },
      }}
      title={header}
    >
      {children}
    </Card>
  );
};

export const SectionCard = React.memo(SectionCardInner);

export default SectionCard;
