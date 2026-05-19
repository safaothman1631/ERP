import React, { useState } from 'react';
import { Input, Button, InputNumber, Space, Typography, App } from 'antd';
import { BarcodeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { FormDialog } from '../responsive/FormDialog';

const { Text } = Typography;

interface GiftCard {
 code: string;
 current_value: number;
 is_active: boolean;
 expiration_date?: string;
}

interface GiftCardChargeDialogProps {
 visible: boolean;
 onClose: () => void;
 onCharged?: (code: string, amount: number) => void;
 orderId?: string;
}

const GiftCardChargeDialog: React.FC<GiftCardChargeDialogProps> = ({
 visible,
 onClose,
 onCharged,
 orderId,
}) => {
 const { t } = useTranslation();
 const { message } = App.useApp();
 
 const [code, setCode] = useState('');
 const [card, setCard] = useState<GiftCard | null>(null);
 const [amount, setAmount] = useState(0);
 const [loading, setLoading] = useState(false);

 const handleLookup = async () => {
 if (!code) {
 message.warning(t('enter_gift_card_code'));
 return;
 }

 setLoading(true);
 try {
 const res = await api.get(`/api/pos/gift-cards/${code}`);
 setCard(res.data);
 
 if (!res.data.is_active) {
 message.warning(t('gift_card_not_activated'));
 } else if (res.data.expiration_date && new Date(res.data.expiration_date) < new Date()) {
 message.warning(t('gift_card_expired'));
 }
 } catch (error) {
 message.error(t('gift_card_not_found'));
 setCard(null);
 } finally {
 setLoading(false);
 }
 };

 const handleCharge = async () => {
 if (!card || !amount) {
 message.warning(t('enter_amount'));
 return;
 }

 if (amount > card.current_value) {
 message.error(t('insufficient_balance'));
 return;
 }

 setLoading(true);
 try {
 await api.post(`/api/pos/gift-cards/${code}/charge`, {
 amount,
 order_id: orderId,
 });
 
 message.success(t('gift_card_charged', { amount: amount.toLocaleString() }));
 
 if (onCharged) {
 onCharged(code, amount);
 }
 
 onClose();
 setCode('');
 setCard(null);
 setAmount(0);
 } catch (error: any) {
 const detail = error.response?.data?.detail;
 message.error(detail || t('error_charging_gift_card'));
 } finally {
 setLoading(false);
 }
 };

 return (
 <FormDialog
 title={t('charge_gift_card')}
 open={visible}
 onClose={onClose}
 hideFooter >
 <Space orientation="vertical" style={{ width: '100%' }}>
 <Input
 prefix={<BarcodeOutlined />}
 placeholder={t('scan_or_enter_gift_card_code')}
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
 <div style={{ marginTop: 16, padding: 16, background: '#f0f0f0', borderRadius: 8 }}>
 <p>
 <strong>{t('card_code')}:</strong> <code>{card.code}</code>
 </p>
 <p>
 <strong>{t('current_balance')}:</strong>{' '}
 <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
 {card.current_value.toLocaleString()} {t('currency')}
 </Text>
 </p>
 {card.is_active && (
 <>
 <InputNumber
 value={amount}
 onChange={(val) => setAmount(val || 0)}
 min={0}
 max={card.current_value}
 style={{ width: '100%', marginTop: 16 }}
 placeholder={t('enter_amount_to_charge')}
 formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
 />
 <Button
 type="primary"
 block
 onClick={handleCharge}
 loading={loading}
 disabled={!amount || amount > card.current_value}
 style={{ marginTop: 16 }}
 >
 {t('charge')} {amount > 0 && `${amount.toLocaleString()} ${t('currency')}`}
 </Button>
 </>
 )}
 </div>
 )}
 </Space>
 </FormDialog>
 );
};

export default GiftCardChargeDialog;
