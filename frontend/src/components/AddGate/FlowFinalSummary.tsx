/**
 * `FlowFinalSummary` — renders unsatisfied required sections on the
 * final step of a multi-step flow (R10.4).
 *
 * When the user reaches the final step of a flow, this component lists
 * any required Sections that still have `recordCount === 0`, each with
 * a deep link so the user can jump back and satisfy the requirement.
 *
 * _Validates: Requirements 10.4_
 */

import React from 'react';
import { Alert, List, Button } from 'antd';
import { WarningOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { UnsatisfiedSection } from './AddGateProvider';

export interface FlowFinalSummaryProps {
  /** List of unsatisfied required sections from `useAddGateFlow`. */
  unsatisfiedSections: UnsatisfiedSection[];
  /**
   * Optional map from sectionId to a human-readable label (translated).
   * Falls back to the sectionId itself if not provided.
   */
  sectionLabels?: Record<string, string>;
  /**
   * Optional callback when the user clicks "Go to section" for a step
   * that has a route. If not provided, uses React Router navigate.
   */
  onNavigateToSection?: (sectionId: string, route?: string) => void;
}

/**
 * Final-step summary listing unsatisfied required Sections with deep
 * links (R10.4). Only renders when there are unsatisfied sections.
 */
export const FlowFinalSummary: React.FC<FlowFinalSummaryProps> = ({
  unsatisfiedSections,
  sectionLabels,
  onNavigateToSection,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (unsatisfiedSections.length === 0) {
    return null;
  }

  const handleNavigate = (sectionId: string, route?: string) => {
    if (onNavigateToSection) {
      onNavigateToSection(sectionId, route);
      return;
    }
    if (route) {
      navigate(route);
    }
  };

  return (
    <Alert
      type="warning"
      icon={<WarningOutlined />}
      showIcon
      message={t('addGate.flow.unsatisfiedSummaryTitle')}
      description={
        <div>
          <p style={{ marginBottom: 8 }}>
            {t('addGate.flow.unsatisfiedSummaryDesc')}
          </p>
          <List
            size="small"
            dataSource={unsatisfiedSections}
            renderItem={(item) => {
              const label =
                sectionLabels?.[item.sectionId] ?? item.sectionId;
              return (
                <List.Item
                  actions={
                    item.route
                      ? [
                          <Button
                            key="go"
                            type="link"
                            size="small"
                            icon={<ArrowLeftOutlined />}
                            onClick={() =>
                              handleNavigate(item.sectionId, item.route)
                            }
                          >
                            {t('addGate.flow.goToSection')}
                          </Button>,
                        ]
                      : undefined
                  }
                >
                  <List.Item.Meta title={label} />
                </List.Item>
              );
            }}
          />
        </div>
      }
      style={{ marginBottom: 16 }}
    />
  );
};

export default FlowFinalSummary;
