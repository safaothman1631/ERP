import React from 'react';
import { Steps, type StepsProps } from 'antd';

// Pass-through wrapper for consistent design-system surface.
export type StepperProps = StepsProps;

/**
 * Stepper — Sprint 10 — wraps AntD Steps for consistent DS API.
 * React.memo applied per Requirements 18.4.
 */
const StepperInner: React.FC<StepperProps> = (props) => <Steps {...props} />;

export const Stepper = React.memo(StepperInner);

export default Stepper;
