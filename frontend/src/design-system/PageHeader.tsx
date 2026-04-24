import React from 'react';
import { Breadcrumb, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { space } from '../theme/tokens';
import HelpButton from '../components/HelpButton';

const { Title, Text } = Typography;

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  breadcrumb?: { label: string; to?: string }[];
  extra?: React.ReactNode;
  tag?: React.ReactNode;
  /** When provided, a HelpButton drawer is shown next to the title. */
  helpKey?: string;
}

/**
 * PageHeader — title + breadcrumb + actions، پەترۆنی هاوبەش بۆ هەموو لاپەڕە.
 * Sprint 7: respects prefers-reduced-motion.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, breadcrumb, extra, tag, helpKey }) => {
  const reduce = useReducedMotion();
  return (
  <motion.div
    initial={reduce ? false : { opacity: 0, y: -8 }}
    animate={reduce ? undefined : { opacity: 1, y: 0 }}
    transition={{ duration: reduce ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
    style={{ marginBottom: space.lg }}
  >
    {breadcrumb && breadcrumb.length > 0 && (
      <Breadcrumb
        style={{ marginBottom: space.sm }}
        items={breadcrumb.map((b) => ({
          title: b.to ? <Link to={b.to}>{b.label}</Link> : b.label,
        }))}
      />
    )}
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <Space align="center" size={space.sm}>
          <Title level={3} style={{ margin: 0, fontWeight: 600 }}>{title}</Title>
          {tag}
          {helpKey && <HelpButton pageKey={helpKey} />}
        </Space>
        {subtitle && (
          <div style={{ marginTop: space.xs }}>
            <Text type="secondary">{subtitle}</Text>
          </div>
        )}
      </div>
      {extra && <Space size={space.sm} wrap>{extra}</Space>}
    </div>
  </motion.div>
  );
};

export default PageHeader;
