import React from 'react';
import { Steps, type StepsProps } from 'antd';

export interface StepperProps extends StepsProps {
  // Pass-through wrapper for consistent design-system surface.
}

/**
 * Stepper — Sprint 10 — wraps AntD Steps for consistent DS API.
 * React.memo applied per Requirements 18.4.
 */
const StepperInner: React.FC<StepperProps> = (props) => <Steps {...props} />;

export const Stepper = React.memo(StepperInner);

export default Stepper;
