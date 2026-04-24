import React, { useEffect, useState } from 'react';
import { Tag, Tooltip } from 'antd';
import { WifiOutlined, DisconnectOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

/**
 * ConnectionStatus — Sprint 10 — shows online/offline state.
 */
export const ConnectionStatus: React.FC = () => {
  const { t } = useTranslation();
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <Tooltip title={online ? t('online', 'سەرهێڵە') : t('offline', 'دەرهێڵە')}>
      <Tag color={online ? 'green' : 'red'} icon={online ? <WifiOutlined /> : <DisconnectOutlined />} style={{ margin: 0 }}>
        {online ? t('online', 'سەرهێڵ') : t('offline', 'دەرهێڵ')}
      </Tag>
    </Tooltip>
  );
};

export default ConnectionStatus;
