import React from 'react';
import { Steps, type StepsProps } from 'antd';

export interface StepperProps extends StepsProps {
  // Pass-through wrapper for consistent design-system surface.
}

/**
 * Stepper — Sprint 10 — wraps AntD Steps for consistent DS API.
 */
export const Stepper: React.FC<StepperProps> = (props) => <Steps {...props} />;

export default Stepper;
