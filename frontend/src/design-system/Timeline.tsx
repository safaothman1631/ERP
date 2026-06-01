import React, { useId } from 'react';
import { Timeline as AntTimeline, type TimelineProps as AntTimelineProps } from 'antd';
import { useIsDark } from '../hooks/useIsDark';

// Pass-through wrapper.
export type TimelineProps = AntTimelineProps & {
  /**
   * Force dark styling. Defaults to the live theme store (`useIsDark`) so the
   * timeline adapts to dark mode even when the consumer doesn't thread it down.
   */
  isDark?: boolean;
};

type TimelineComponent = React.NamedExoticComponent<TimelineProps> & {
  /** Re-exposed AntD static so `<Timeline.Item>` consumers keep working. */
  Item: typeof AntTimeline.Item;
};

/**
 * Timeline — Vertex "Slate & Signal" activity timeline.
 *
 * Wraps AntD Timeline (full API preserved — `items`, `children`/`Timeline.Item`,
 * `mode`, `pending`, per-item `color`/`dot` all keep working) and restyles it to
 * match the kit's vertical activity feed (records.jsx "Audit trail"):
 *   - accent dots            → var(--accent-500)
 *   - hairline connector     → var(--border)
 *   - content / meta text    → var(--ink-700)
 *   - title text             → var(--ink-900), display font
 *
 * Every value is a kit CSS-var token, so the component is correct in BOTH light
 * and dark themes (the tokens auto-flip via [data-theme="dark"]).
 *
 * React.memo applied per Requirements 18.4.
 */
const TimelineInner: React.FC<TimelineProps> = ({ isDark: _isDarkProp, className, ...props }) => {
  // Subscribe to the live theme so the component re-renders on toggle. The
  // styling itself is token-driven (auto-flips), so this is only kept for the
  // public `isDark` override contract + to stay reactive.
  const themeDark = useIsDark();
  void (_isDarkProp ?? themeDark);

  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const scope = `vx-timeline-${uid}`;

  return (
    <div className={scope}>
      <style>{`
        .${scope} .ant-timeline {
          /* Drive AntD v6 Timeline (built on Steps) via its public CSS vars,
             so the dot fill, connector rail and content text use kit tokens. */
          --ant-cmp-steps-item-icon-dot-color: var(--accent-500);
          --ant-cmp-steps-item-icon-dot-bg-color: var(--accent-500);
          --ant-cmp-steps-item-solid-line-color: var(--border);
        }
        /* Connector / rail — kit hairline. */
        .${scope} .ant-timeline-item-rail {
          background: var(--border);
          color: var(--border);
        }
        /* Dot — flat electric-violet accent. */
        .${scope} .ant-timeline-item-icon,
        .${scope} .ant-timeline-item-icon::after {
          color: var(--accent-500);
          background-color: var(--accent-500);
        }
        /* Per-item color escapes the accent default so semantic dots still win. */
        .${scope} .ant-timeline-item-color-blue .ant-timeline-item-icon,
        .${scope} .ant-timeline-item-color-blue .ant-timeline-item-icon::after { background-color: var(--accent-500); color: var(--accent-500); }
        .${scope} .ant-timeline-item-color-green .ant-timeline-item-icon,
        .${scope} .ant-timeline-item-color-green .ant-timeline-item-icon::after { background-color: var(--success-500); color: var(--success-500); }
        .${scope} .ant-timeline-item-color-red .ant-timeline-item-icon,
        .${scope} .ant-timeline-item-color-red .ant-timeline-item-icon::after { background-color: var(--danger-500); color: var(--danger-500); }
        .${scope} .ant-timeline-item-color-gray .ant-timeline-item-icon,
        .${scope} .ant-timeline-item-color-gray .ant-timeline-item-icon::after { background-color: var(--ink-400); color: var(--ink-400); }
        /* Content / meta text — kit secondary ink. */
        .${scope} .ant-timeline-item-content {
          color: var(--ink-700);
          font-size: 13px;
          line-height: 1.5;
        }
        /* Title / header — primary ink, display font. */
        .${scope} .ant-timeline-item-title,
        .${scope} .ant-timeline-item-header {
          color: var(--ink-900);
          font-family: var(--font-display);
          font-weight: 600;
        }
      `}</style>
      <AntTimeline className={className} {...props} />
    </div>
  );
};

export const Timeline = React.memo(TimelineInner) as TimelineComponent;
// Re-expose AntD's static subcomponent so `<Timeline.Item>` keeps working.
Timeline.Item = AntTimeline.Item;

export default Timeline;
