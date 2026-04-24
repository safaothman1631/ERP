import React from 'react';
import { Modal, Form, Input, DatePicker, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../../api';
import { message } from '../../utils/message';

interface POSQuotationDialogProps {
  visible: boolean;
  orderId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const POSQuotationDialog: React.FC<POSQuotationDialogProps> = ({
  visible,
  orderId,
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
      await api.post(`/api/pos/orders/${orderId}/draft`, {
        name: values.name,
        valid_until: values.valid_until?.format('YYYY-MM-DD'),
        customer_phone: values.customer_phone,
      });
      
      message.success(t('pos.quotation_saved'));
      onSuccess();
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

  // Generate default quotation name
  const defaultName = `Quote #${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 1000)}`;

  return (
    <Modal
      title={t('pos.save_as_quotation')}
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          name: defaultName,
          valid_until: dayjs().add(7, 'days'),
        }}
      >
        <Form.Item
          label={t('pos.quotation_name')}
          name="name"
          rules={[{ required: true, message: t('required') }]}
        >
          <Input placeholder={defaultName} />
        </Form.Item>

        <Form.Item
          label={t('pos.valid_until')}
          name="valid_until"
        >
          <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
        </Form.Item>

        <Form.Item
          label={t('pos.customer_phone')}
          name="customer_phone"
        >
          <Input placeholder={t('phone')} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            {t('save')}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default POSQuotationDialog;
