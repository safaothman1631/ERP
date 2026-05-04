import type React from 'react';
import { useEffect, useState } from 'react';
import { Card, Button, Descriptions, Space, Tag, Modal } from 'antd';
import { message } from '../../utils/message';
import { ArrowLeftOutlined, PlayCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';

const RentalContractDetail: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchContract = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/rental/contracts/${id}`);
      setContract(res.data);
      if (res.data.product_id) {
        const pRes = await api.get(`/api/rental/products/${res.data.product_id}`);
        setProduct(pRes.data);
      }
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchContract();
  }, [id]);

  const handleStart = () => {
    Modal.confirm({
      title: t('rental.confirm_start'),
      onOk: async () => {
        try {
          await api.post(`/api/rental/contracts/${id}/start`, {});
          message.success(t('success'));
          void fetchContract();
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  const handleClose = () => {
    Modal.confirm({
      title: t('rental.confirm_close'),
      onOk: async () => {
        try {
          await api.post(`/api/rental/contracts/${id}/close`, {});
          message.success(t('success'));
          void fetchContract();
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  const getStatusTag = (status?: string) => {
    if (!status || status === 'draft') return <Tag>{t('rental.status_draft')}</Tag>;
    if (status === 'active') return <Tag color="green">{t('rental.status_active')}</Tag>;
    if (status === 'closed') return <Tag color="default">{t('rental.status_closed')}</Tag>;
    return <Tag>{status}</Tag>;
  };

  const canStart = !contract?.status || contract?.status === 'draft';
  const canClose = contract?.status === 'active';

  const calculateDuration = () => {
    if (!contract?.start_date || !contract?.end_date) return '—';
    const start = dayjs(contract.start_date);
    const end = dayjs(contract.end_date);
    const days = end.diff(start, 'day');
    return t('rental.days_count', { count: days });
  };

  return (
    <div>
      <PageHeader
        title={t('rental.contract_detail')}
        subtitle={contract?.customer_name || ''}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/rental/contracts')}>
              {t('back')}
            </Button>
            {canStart && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleStart}
                loading={loading}
              >
                {t('rental.start_contract')}
              </Button>
            )}
            {canClose && (
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={handleClose}
                loading={loading}
              >
                {t('rental.close_contract')}
              </Button>
            )}
          </Space>
        }
      />

      {contract && (
        <>
          <Card title={t('rental.contract_info')} style={{ marginBottom: space.md }} loading={loading}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label={t('rental.customer_name')}>
                {contract.customer_name}
              </Descriptions.Item>
              <Descriptions.Item label={t('rental.status')}>
                {getStatusTag(contract.status)}
              </Descriptions.Item>
              <Descriptions.Item label={t('rental.product')}>
                {product?.name || contract.product_id}
              </Descriptions.Item>
              <Descriptions.Item label={t('rental.quantity')}>
                {contract.quantity}
              </Descriptions.Item>
              <Descriptions.Item label={t('rental.start_date')}>
                {contract.start_date ? dayjs(contract.start_date).format('YYYY-MM-DD') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('rental.end_date')}>
                {contract.end_date ? dayjs(contract.end_date).format('YYYY-MM-DD') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('rental.period_duration')}>
                {calculateDuration()}
              </Descriptions.Item>
              <Descriptions.Item label={t('rental.deposit')}>
                {contract.deposit_amount?.toLocaleString() || '0'}
              </Descriptions.Item>
              {contract.daily_rate && (
                <Descriptions.Item label={t('rental.daily_rate')}>
                  {contract.daily_rate?.toLocaleString()}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {product && (
            <Card title={t('rental.product_rates')} loading={loading}>
              <Descriptions column={2} bordered>
                <Descriptions.Item label={t('rental.daily_rate')}>
                  {product.daily_rate?.toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label={t('rental.weekly_rate')}>
                  {product.weekly_rate?.toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label={t('rental.monthly_rate')}>
                  {product.monthly_rate?.toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label={t('rental.deposit')}>
                  {product.deposit?.toLocaleString()}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default RentalContractDetail;
