import React from 'react';
import { Timeline as AntTimeline, type TimelineProps as AntTimelineProps } from 'antd';

export interface TimelineProps extends AntTimelineProps {
  // Pass-through wrapper.
}

/**
 * Timeline — Sprint 10 — wraps AntD Timeline.
 * React.memo applied per Requirements 18.4.
 */
const TimelineInner: React.FC<TimelineProps> = (props) => <AntTimeline {...props} />;

export const Timeline = React.memo(TimelineInner);

export default Timeline;
