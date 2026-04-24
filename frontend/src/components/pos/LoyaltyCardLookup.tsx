import React, { useState } from 'react';
import { Modal, Input, Button, Card, Space, Tag, App } from 'antd';
import { BarcodeOutlined, GiftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';

interface LoyaltyCard {
  id: string;
  code: string;
  program_id: string;
  partner_id: string;
  points_balance: number;
  is_active: boolean;
}

interface LoyaltyCardLookupProps {
  visible: boolean;
  onClose: () => void;
  onRedeem?: (card: LoyaltyCard, rewardId: string) => void;
}

const LoyaltyCardLookup: React.FC<LoyaltyCardLookupProps> = ({
  visible,
  onClose,
  onRedeem,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  
  const [code, setCode] = useState('');
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    if (!code) {
      message.warning(t('enter_card_code'));
      return;
    }

    setLoading(true);
    try {
      const res = await api.get('/api/pos/loyalty/cards', {
        params: { code },
      });
      
      const cards = res.data.items || [];
      if (cards.length === 0) {
        message.error(t('card_not_found'));
        setCard(null);
      } else {
        setCard(cards[0]);
      }
    } catch (error) {
      message.error(t('error_loading'));
      setCard(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = () => {
    if (card && onRedeem) {
      // For now, just close. Real implementation would show reward picker
      message.info(t('feature_coming_soon'));
      onClose();
    }
  };

  return (
    <Modal
      title={t('loyalty_card_lookup')}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Input
          size="large"
          prefix={<BarcodeOutlined />}
          placeholder={t('scan_or_enter_card_code')}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onPressEnter={handleLookup}
        />
        <Button
          type="primary"
          block
          onClick={handleLookup}
          loading={loading}
        >
          {t('lookup')}
        </Button>

        {card && (
          <Card style={{ marginTop: 16 }}>
            <p>
              <strong>{t('card_code')}:</strong> <code>{card.code}</code>
            </p>
            <p>
              <strong>{t('points_balance')}:</strong>{' '}
              <Tag color="blue" style={{ fontSize: 16 }}>
                {card.points_balance.toFixed(2)}
              </Tag>
            </p>
            <p>
              <strong>{t('status')}:</strong>{' '}
              <Tag color={card.is_active ? 'green' : 'default'}>
                {card.is_active ? t('active') : t('inactive')}
              </Tag>
            </p>
            {card.is_active && onRedeem && (
              <Button
                type="primary"
                icon={<GiftOutlined />}
                onClick={handleRedeem}
                block
              >
                {t('redeem_rewards')}
              </Button>
            )}
          </Card>
        )}
      </Space>
    </Modal>
  );
};

export default LoyaltyCardLookup;
