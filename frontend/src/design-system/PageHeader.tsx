import React from 'react';
import { Breadcrumb, Space } from 'antd';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { space } from '../theme/tokens';
import HelpButton from '../components/HelpButton';
import { HelpIcon } from '../help/HelpIcon';
import type { SectionId } from '../help/sectionIds';

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  breadcrumb?: { label: string; to?: string }[];
  extra?: React.ReactNode;
  tag?: React.ReactNode;
  /** When provided, a HelpButton drawer is shown next to the title. */
  helpKey?: string;
  /** When provided, renders the universal HelpIcon from the Help_Registry (R6.1, R7.5). */
  sectionId?: SectionId;
}

/**
 * PageHeader — title + breadcrumb + actions، پەترۆنی هاوبەش بۆ هەموو لاپەڕە.
 * Vertex kit "PageHead": var(--font-display) 26px var(--ink-900) -0.02em title,
 * 13.5px var(--ink-500) subtitle, actions row on the inline-end. Fully theme-aware
 * via auto-flipping CSS var tokens (light + dark).
 * Sprint 7: respects prefers-reduced-motion.
 * React.memo applied per Requirements 18.4.
 */
const PageHeaderInner: React.FC<PageHeaderProps> = ({ title, subtitle, breadcrumb, extra, tag, helpKey, sectionId }) => {
  const reduce = useReducedMotion();
  return (
  <motion.div
    initial={reduce ? false : { opacity: 0, y: -8 }}
    animate={reduce ? undefined : { opacity: 1, y: 0 }}
    transition={{ duration: reduce ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
    style={{ marginBottom: space.lg }}
    data-section-id={sectionId || undefined}
  >
    {breadcrumb && breadcrumb.length > 0 && (
      <Breadcrumb
        style={{ marginBottom: space.sm }}
        items={breadcrumb.map((b) => ({
          title: b.to ? <Link to={b.to}>{b.label}</Link> : b.label,
        }))}
      />
    )}
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: space.md,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              lineHeight: 1.2,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--ink-900)',
            }}
          >
            {title}
          </h1>
          {tag}
          {sectionId && <HelpIcon sectionId={sectionId} />}
          {helpKey && !sectionId && <HelpButton pageKey={helpKey} />}
        </div>
        {subtitle && (
          <p
            style={{
              margin: '5px 0 0',
              fontSize: 13.5,
              lineHeight: 1.45,
              color: 'var(--ink-500)',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {extra && <Space className="vx-pageheader-actions" size={space.sm} wrap>{extra}</Space>}
    </div>
  </motion.div>
  );
};

export const PageHeader = React.memo(PageHeaderInner);

export default PageHeader;
