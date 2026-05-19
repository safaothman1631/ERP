import React from 'react';
import { Card, Space, Typography } from 'antd';
import { palette, radius, shadow, space } from '../theme/tokens';
import { useAuthStore } from '../store';

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
 * AntD Card بەکار دەهێنێت بەڵام spacing/elevation/heading consistent دەکات.
 * React.memo applied per Requirements 18.4.
 */
const SectionCardInner: React.FC<SectionCardProps> = ({
  title, subtitle, extra, bordered = true, padded = true, elevation = 1, children, style, bodyStyle,
}) => {
  const isDark = useAuthStore((s) => s.theme) === 'dark';
  const elev = elevation === 0 ? 'none' : elevation === 1 ? shadow.sm : shadow.md;
  const header = title ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
      <Space direction="vertical" size={2}>
        <Text strong style={{ fontSize: 15, color: isDark ? palette.darkInk : palette.ink900 }}>{title}</Text>
        {subtitle && <Text type="secondary" style={{ fontSize: 13 }}>{subtitle}</Text>}
      </Space>
      {extra}
    </div>
  ) : undefined;
  return (
    <Card
      bordered={bordered}
      style={{ borderRadius: radius.lg, boxShadow: elev, marginBottom: space.lg, ...style }}
      styles={{
        header: header ? { borderBottom: `1px solid ${isDark ? palette.darkBorder : palette.border}` } : undefined,
        body:   { padding: padded ? space.lg : 0, ...bodyStyle },
      }}
      title={header}
    >
      {children}
    </Card>
  );
};

export const SectionCard = React.memo(SectionCardInner);

export default SectionCard;
