import React from 'react';
import { Timeline as AntTimeline, type TimelineProps as AntTimelineProps } from 'antd';

export interface TimelineProps extends AntTimelineProps {
  // Pass-through wrapper.
}

/**
 * Timeline — Sprint 10 — wraps AntD Timeline.
 */
export const Timeline: React.FC<TimelineProps> = (props) => <AntTimeline {...props} />;

export default Timeline;
