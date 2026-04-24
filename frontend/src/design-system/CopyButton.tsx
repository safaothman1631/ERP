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
      message.success(t('copied', 'کۆپی کرا'));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      message.error(t('copy_failed', 'کۆپی شکست هێنا'));
    }
  };

  return (
    <Tooltip title={tooltip ?? t('copy', 'کۆپی')}>
      <Button
        type="text"
        size={size}
        icon={copied ? <CheckOutlined style={{ color: '#16A34A' }} /> : <CopyOutlined />}
        onClick={handleCopy}
        aria-label={t('copy', 'کۆپی')}
      />
    </Tooltip>
  );
};

export default CopyButton;
