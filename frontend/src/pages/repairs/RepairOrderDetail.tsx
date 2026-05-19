import type React from 'react';
import { useEffect, useState } from 'react';
import { Card, Button, Descriptions, Space, Tag, Steps, Input, Modal } from 'antd';
import { message } from '../../utils/message';
import {
  ArrowLeftOutlined,
  SearchOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';

const RepairOrderDetail: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchOrder = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/repairs/orders/${id}`);
      setOrder(res.data);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrder();
  }, [id]);

  const handleDiagnose = () => {
    Modal.confirm({
      title: t('repairs.diagnose_title'),
      content: (
        <div>
          <p>{t('repairs.diagnose_notes')}</p>
          <Input.TextArea id="diagnose-notes" rows={3} />
        </div>
      ),
      onOk: async () => {
        const notes = (document.getElementById('diagnose-notes') as HTMLTextAreaElement)?.value;
        try {
          await api.post(`/api/repairs/orders/${id}/diagnose`, { notes });
          message.success(t('success'));
          void fetchOrder();
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  const handleRepair = () => {
    Modal.confirm({
      title: t('repairs.confirm_start_repair'),
      onOk: async () => {
        try {
          await api.post(`/api/repairs/orders/${id}/repair`, {});
          message.success(t('success'));
          void fetchOrder();
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  const handleComplete = () => {
    Modal.confirm({
      title: t('repairs.complete_title'),
      content: (
        <div>
          <p>{t('repairs.final_cost_label')}</p>
          <Input id="final-cost" type="number" placeholder="0" />
        </div>
      ),
      onOk: async () => {
        const finalCost = parseFloat(
          (document.getElementById('final-cost') as HTMLInputElement)?.value || '0'
        );
        try {
          await api.post(`/api/repairs/orders/${id}/complete`, { final_cost: finalCost });
          message.success(t('success'));
          void fetchOrder();
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  const handleDeliver = () => {
    Modal.confirm({
      title: t('repairs.confirm_deliver'),
      onOk: async () => {
        try {
          await api.post(`/api/repairs/orders/${id}/deliver`, {});
          message.success(t('success'));
          void fetchOrder();
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  const getStatusTag = (status?: string) => {
    const s = status || 'received';
    const colorMap: Record<string, string> = {
      received: 'blue',
      diagnosed: 'cyan',
      in_repair: 'orange',
      done: 'green',
      delivered: 'default',
    };
    return <Tag color={colorMap[s] || 'default'}>{t(`repairs.status_${s}`)}</Tag>;
  };

  const getStepIndex = (status?: string) => {
    const map: Record<string, number> = {
      received: 0,
      diagnosed: 1,
      in_repair: 2,
      done: 3,
      delivered: 4,
    };
    return map[status || 'received'] || 0;
  };

  const currentStatus = order?.status || 'received';
  const canDiagnose = currentStatus === 'received';
  const canRepair = currentStatus === 'diagnosed';
  const canComplete = currentStatus === 'in_repair';
  const canDeliver = currentStatus === 'done';

  const stepItems = [
    { title: t('repairs.step_received') },
    { title: t('repairs.step_diagnosed') },
    { title: t('repairs.step_repairing') },
    { title: t('repairs.step_completed') },
    { title: t('repairs.step_delivered') },
  ];

  return (
    <div>
      <PageHeader
        title={t('repairs.order_detail')}
        subtitle={order?.customer_name || ''}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/repairs/orders')}>
              {t('back')}
            </Button>
            {canDiagnose && (
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleDiagnose}
                loading={loading}
              >
                {t('repairs.diagnose')}
              </Button>
            )}
            {canRepair && (
              <Button
                type="primary"
                icon={<ToolOutlined />}
                onClick={handleRepair}
                loading={loading}
              >
                {t('repairs.start_repair')}
              </Button>
            )}
            {canComplete && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleComplete}
                loading={loading}
              >
                {t('repairs.complete')}
              </Button>
            )}
            {canDeliver && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleDeliver}
                loading={loading}
              >
                {t('repairs.deliver')}
              </Button>
            )}
          </Space>
        }
      />

      {order && (
        <>
          <Card style={{ marginBottom: space.md }} loading={loading}>
            <Steps current={getStepIndex(currentStatus)} items={stepItems} />
          </Card>

          <Card title={t('repairs.order_info')} style={{ marginBottom: space.md }} loading={loading}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label={t('repairs.customer_name')}>
                {order.customer_name}
              </Descriptions.Item>
              <Descriptions.Item label={t('repairs.status')}>
                {getStatusTag(order.status)}
              </Descriptions.Item>
              <Descriptions.Item label={t('repairs.product')}>
                {order.product_name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('repairs.serial_no')}>
                {order.serial_no || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('repairs.issue_description')} span={2}>
                {order.issue_description}
              </Descriptions.Item>
              <Descriptions.Item label={t('repairs.received_at')}>
                {order.received_at ? dayjs(order.received_at).format('YYYY-MM-DD HH:mm') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('repairs.estimated_cost')}>
                {order.estimated_cost?.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label={t('repairs.under_warranty')}>
                {order.is_under_warranty ? t('yes') : t('no')}
              </Descriptions.Item>
              <Descriptions.Item label={t('repairs.assigned_to')}>
                {order.assigned_to || '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {order.diagnosis_notes && (
            <Card title={t('repairs.diagnosis_notes')} style={{ marginBottom: space.md }}>
              <p>{order.diagnosis_notes}</p>
            </Card>
          )}

          {order.completion_notes && (
            <Card title={t('repairs.completion_notes')} style={{ marginBottom: space.md }}>
              <p>{order.completion_notes}</p>
              {order.final_cost !== undefined && (
                <p>
                  <strong>{t('repairs.final_cost')}:</strong> {order.final_cost?.toLocaleString()}
                </p>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default RepairOrderDetail;
