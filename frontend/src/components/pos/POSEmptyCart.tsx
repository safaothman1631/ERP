import React from 'react';
import { Empty } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export default function POSEmptyCart() {
  const { t } = useTranslation();

  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <Empty
        image={<ShoppingCartOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
        description={
          <span style={{ fontSize: 16, color: '#8c8c8c' }}>
            {t('pos.emptyCart', 'Add product to start')}
          </span>
        }
      />
    </div>
  );
}
