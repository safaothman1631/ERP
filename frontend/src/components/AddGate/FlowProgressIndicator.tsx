/**
 * `FlowProgressIndicator` — renders step status for multi-step flows
 * integrated with the AddGate system (R10.3).
 *
 * Surfaces each step's live status in the progress indicator:
 * - `required-incomplete` — step is required and its Section is empty
 * - `optional` — step is optional or already configured (R10.2)
 * - `completed` — step has been advanced past
 *
 * _Validates: Requirements 10.2, 10.3_
 */

import React from 'react';
import { Steps, Tag } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import type { FlowStepStatus } from './AddGateProvider';

export interface FlowProgressStep {
  /** Step title (already translated). */
  title: string;
  /** Optional icon for the step. */
  icon?: React.ReactNode;
  /** The live status from AddGateProvider's FlowView. */
  status: FlowStepStatus;
  /** Whether this step has existing data (for "already configured" label). */
  alreadyConfigured?: boolean;
}

export interface FlowProgressIndicatorProps {
  /** Steps to render in the progress indicator. */
  steps: FlowProgressStep[];
  /** Index of the current step (0-based). */
  currentStep: number;
}

/**
 * Maps a FlowStepStatus to an AntD Steps status value.
 */
function mapToAntdStatus(
  status: FlowStepStatus,
  index: number,
  currentStep: number,
): 'wait' | 'process' | 'finish' | 'error' {
  if (status === 'completed') return 'finish';
  if (index === currentStep) return 'process';
  if (status === 'required-incomplete') return 'wait';
  return 'wait';
}

/**
 * Renders a status tag below the step title.
 */
function StatusTag({
  status,
  alreadyConfigured,
}: {
  status: FlowStepStatus;
  alreadyConfigured?: boolean;
}) {
  const { t } = useTranslation();

  if (status === 'completed') {
    return (
      <Tag
        icon={<CheckCircleOutlined />}
        color="success"
        style={{ fontSize: 11, marginTop: 4 }}
      >
        {t('addGate.flow.completed')}
      </Tag>
    );
  }

  if (status === 'optional') {
    const label = alreadyConfigured
      ? t('addGate.flow.optionalAlreadyConfigured')
      : t('addGate.flow.optional');
    return (
      <Tag
        icon={<MinusCircleOutlined />}
        color="default"
        style={{ fontSize: 11, marginTop: 4 }}
      >
        {label}
      </Tag>
    );
  }

  // required-incomplete
  return (
    <Tag
      icon={<ExclamationCircleOutlined />}
      color="warning"
      style={{ fontSize: 11, marginTop: 4 }}
    >
      {t('addGate.flow.requiredIncomplete')}
    </Tag>
  );
}

/**
 * Progress indicator that surfaces AddGate step status (R10.3).
 */
export const FlowProgressIndicator: React.FC<FlowProgressIndicatorProps> = ({
  steps,
  currentStep,
}) => {
  return (
    <Steps
      current={currentStep}
      style={{ marginBottom: 32 }}
      items={steps.map((step, index) => ({
        title: step.title,
        icon: step.icon,
        status: mapToAntdStatus(step.status, index, currentStep),
        description: (
          <StatusTag
            status={step.status}
            alreadyConfigured={step.alreadyConfigured}
          />
        ),
      }))}
    />
  );
};

export default FlowProgressIndicator;
