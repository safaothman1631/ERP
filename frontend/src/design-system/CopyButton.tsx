import React, { useState } from 'react';
import { Button, Tooltip, message } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export interface CopyButtonProps {
  text: string;
  size?: 'small' | 'middle' | 'large';
  tooltip?: string;
}

/**
 * CopyButton — Sprint 10 — copy text to clipboard with success feedback.
 */
export const CopyButton: React.FC<CopyButtonProps> = ({ text, size = 'small', tooltip }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      message.success(t('copied', 'Copied'));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      message.error(t('copy_failed', 'Copy failed'));
    }
  };

  return (
    <Tooltip title={tooltip ?? t('copy', 'Copy')}>
      <Button
        type="text"
        size={size}
        icon={copied ? <CheckOutlined style={{ color: 'var(--success-500)' }} /> : <CopyOutlined />}
        onClick={handleCopy}
        aria-label={t('copy', 'Copy')}
      />
    </Tooltip>
  );
};

export default CopyButton;
