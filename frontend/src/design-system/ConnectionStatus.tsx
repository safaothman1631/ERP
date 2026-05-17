import React, { useEffect, useState } from 'react';
import { Tag, Tooltip, Alert } from 'antd';
import { WifiOutlined, DisconnectOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export type ConnectionStatusVariant = 'tag' | 'banner';

export interface ConnectionStatusProps {
  /**
   * 'tag'   — compact inline tag (for TopBar use)
   * 'banner' — full-width offline banner (for AppShell use, Requirement 4.12)
   */
  variant?: ConnectionStatusVariant;
}

/**
 * ConnectionStatus — Requirement 4.12
 * WHERE بەکارهێنەر ئینتەرنێتی لەدەست دات، THE سیستەم SHALL offline indicator نیشان بدات.
 *
 * Supports two variants:
 * - 'tag'    — compact inline tag suitable for TopBar
 * - 'banner' — animated full-width banner that slides in when offline
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ variant = 'tag' }) => {
  const { t } = useTranslation();
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (variant === 'banner') {
    return (
      <AnimatePresence>
        {!online && (
          <motion.div
            key="offline-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
            role="status"
            aria-live="polite"
            aria-label={t('offline_banner_label', 'ئینتەرنێت نییە')}
          >
            <Alert
              type="warning"
              icon={<DisconnectOutlined />}
              showIcon
              banner
              title={
                <span style={{ fontWeight: 600 }}>
                  {t('offline_title', 'دەرهێڵ — ئینتەرنێت نییە')}
                </span>
              }
              description={t(
                'offline_description',
                'پەیوەندی ئینتەرنێتت بڕاوە. هەندێک تایبەتمەندی کار ناکەن تا پەیوەندی دووبارە بکرێتەوە.',
              )}
              style={{ borderRadius: 0, borderInline: 'none', borderTop: 'none' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Default: compact tag variant
  return (
    <Tooltip title={online ? t('online', 'سەرهێڵە') : t('offline', 'دەرهێڵە')}>
      <Tag
        color={online ? 'green' : 'red'}
        icon={online ? <WifiOutlined /> : <DisconnectOutlined />}
        style={{ margin: 0 }}
        role="status"
        aria-live="polite"
      >
        {online ? t('online', 'سەرهێڵ') : t('offline', 'دەرهێڵ')}
      </Tag>
    </Tooltip>
  );
};

export default ConnectionStatus;
