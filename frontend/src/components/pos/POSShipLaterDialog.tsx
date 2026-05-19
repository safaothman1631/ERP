import React from 'react';
import { Form, DatePicker, Input, Button, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { TruckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api';
import { message } from '../../utils/message';
import { FormDialog } from '../responsive/FormDialog';

const { TextArea } = Input;
const { Text } = Typography;

interface POSShipLaterDialogProps {
 visible: boolean;
 orderId: string | null;
 customerAddress?: any;
 onClose: () => void;
 onSuccess: (salesOrderId: string, salesOrderNumber: string) => void;
}

const POSShipLaterDialog: React.FC<POSShipLaterDialogProps> = ({
 visible,
 orderId,
 customerAddress,
 onClose,
 onSuccess,
}) => {
 const { t } = useTranslation();
 const [form] = Form.useForm();
 const [loading, setLoading] = React.useState(false);

 const handleSubmit = async (values: any) => {
 if (!orderId) return;

 setLoading(true);
 try {
 const res = await api.post(`/api/pos/orders/${orderId}/ship-later`, {
 shipping_date: values.shipping_date.format('YYYY-MM-DD'),
 shipping_address: {
 street: values.street || '',
 city: values.city || '',
 state: values.state || '',
 zip: values.zip || '',
 country: values.country || 'Iraq',
 },
 notes: values.notes,
 });
 
 message.success(t('pos.ship_later_created'));
 onSuccess(res.data.sales_order_id, res.data.sales_order_number);
 handleClose();
 } catch (error) {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const handleClose = () => {
 form.resetFields();
 onClose();
 };

 React.useEffect(() => {
 if (visible && customerAddress) {
 form.setFieldsValue({
 street: customerAddress.street,
 city: customerAddress.city,
 state: customerAddress.state,
 zip: customerAddress.zip,
 country: customerAddress.country || 'Iraq',
 });
 }
 }, [visible, customerAddress, form]);

 return (
 <FormDialog
 title={
 <Space>
 <TruckOutlined />
 <span>{t('pos.ship_later')}</span>
 </Space>
 }
 open={visible}
 onCancel={handleClose} hideFooter
 >
 <Form
 form={form}
 layout="vertical"
 onFinish={handleSubmit}
 initialValues={{
 shipping_date: dayjs().add(1, 'day'),
 country: 'Iraq',
 }}
 >
 <Form.Item
 label={t('pos.shipping_date')}
 name="shipping_date"
 rules={[{ required: true, message: t('required') }]}
 >
 <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
 </Form.Item>

 <Text strong>{t('pos.shipping_address')}</Text>
 
 <Form.Item
 label={t('street')}
 name="street"
 style={{ marginTop: 8 }}
 >
 <Input placeholder={t('street')} />
 </Form.Item>

 <Space style={{ width: '100%' }}>
 <Form.Item
 label={t('city')}
 name="city"
 style={{ flex: 1 }}
 >
 <Input placeholder={t('city')} />
 </Form.Item>

 <Form.Item
 label={t('state')}
 name="state"
 style={{ flex: 1 }}
 >
 <Input placeholder={t('state')} />
 </Form.Item>
 </Space>

 <Space style={{ width: '100%' }}>
 <Form.Item
 label={t('zip')}
 name="zip"
 style={{ flex: 1 }}
 >
 <Input placeholder={t('zip')} />
 </Form.Item>

 <Form.Item
 label={t('country')}
 name="country"
 style={{ flex: 1 }}
 >
 <Input placeholder={t('country')} />
 </Form.Item>
 </Space>

 <Form.Item
 label={t('notes')}
 name="notes"
 >
 <TextArea rows={3} placeholder={t('pos.shipping_notes')} />
 </Form.Item>

 <Form.Item>
 <Button type="primary" htmlType="submit" loading={loading} block>
 {t('pos.create_sales_order')}
 </Button>
 </Form.Item>
 </Form>
 </FormDialog>
 );
};

export default POSShipLaterDialog;
