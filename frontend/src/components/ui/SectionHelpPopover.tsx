import React from 'react';
import { Popover } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

/**
 * SectionHelpPopover — Contextual help trigger for Settings section headers.
 * Renders an ⓘ icon that opens an Ant Design Popover on click, showing:
 *   - What the section is (one sentence)
 *   - Why it is used (one sentence)
 *   - Step-by-step usage instructions (2–7 steps)
 *
 * Placed in the `actions` slot of SectionCard so it appears top-right of
 * every card header without requiring changes to SectionCard itself.
 */
export interface SectionHelpPopoverProps {
  what: string;    // one-sentence "what is this"
  why: string;     // one-sentence "why use it"
  steps: string[]; // 2–7 step-by-step instructions
}

const SectionHelpPopover: React.FC<SectionHelpPopoverProps> = ({ what, why, steps }) => {
  const { t } = useTranslation();

  const content = (
    <div style={{ maxWidth: 320 }}>
      <p style={{ margin: '0 0 8px' }}>
        <strong>{what}</strong>
      </p>
      <p style={{ margin: '0 0 8px' }}>
        <strong>{why}</strong>
      </p>
      <ol style={{ margin: 0, paddingInlineStart: 20 }}>
        {steps.map((step, index) => (
          <li key={index} style={{ marginBottom: 4 }}>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
    >
      <InfoCircleOutlined
        aria-label={t('help')}
        style={{ cursor: 'pointer', fontSize: 16, opacity: 0.6 }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          // Allow keyboard activation via Enter or Space
          if (e.key === 'Enter' || e.key === ' ') {
            e.currentTarget.click();
          }
        }}
      />
    </Popover>
  );
};

export default SectionHelpPopover;
