import type React from 'react';
import { useEffect, useState } from 'react';
import { Button, Space, Modal } from 'antd';
import { message } from '../../utils/message';
import { ArrowLeftOutlined, PlayCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader, DetailLayout, SectionCard, KeyValueGrid, StatusTag } from '../../design-system';
import type { KeyValueItem } from '../../design-system';

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
    if (!status || status === 'draft') return <StatusTag status="default" label={t('rental.status_draft')} />;
    if (status === 'active') return <StatusTag status="success" label={t('rental.status_active')} />;
    if (status === 'closed') return <StatusTag status="default" label={t('rental.status_closed')} />;
    return <StatusTag status="default" label={status} />;
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

  const contractItems: KeyValueItem[] = contract
    ? [
        { label: t('rental.customer_name'), value: contract.customer_name },
        { label: t('rental.status'), value: getStatusTag(contract.status) },
        { label: t('rental.product'), value: product?.name || contract.product_id },
        { label: t('rental.quantity'), value: contract.quantity },
        { label: t('rental.start_date'), value: contract.start_date ? dayjs(contract.start_date).format('YYYY-MM-DD') : '—' },
        { label: t('rental.end_date'), value: contract.end_date ? dayjs(contract.end_date).format('YYYY-MM-DD') : '—' },
        { label: t('rental.period_duration'), value: calculateDuration() },
        { label: t('rental.deposit'), value: contract.deposit_amount?.toLocaleString() || '0' },
        ...(contract.daily_rate ? [{ label: t('rental.daily_rate'), value: contract.daily_rate?.toLocaleString() } as KeyValueItem] : []),
      ]
    : [];

  return (
    <DetailLayout
      header={
        <PageHeader
          title={t('rental.contract_detail')}
          subtitle={contract?.customer_name || ''}
          tag={contract ? getStatusTag(contract.status) : undefined}
        />
      }
      toolbar={
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
    >
      {contract && (
        <>
          <SectionCard title={t('rental.contract_info')}>
            <KeyValueGrid columns={2} items={contractItems} />
          </SectionCard>

          {product && (
            <SectionCard title={t('rental.product_rates')}>
              <KeyValueGrid
                columns={2}
                items={[
                  { label: t('rental.daily_rate'), value: product.daily_rate?.toLocaleString() },
                  { label: t('rental.weekly_rate'), value: product.weekly_rate?.toLocaleString() },
                  { label: t('rental.monthly_rate'), value: product.monthly_rate?.toLocaleString() },
                  { label: t('rental.deposit'), value: product.deposit?.toLocaleString() },
                ]}
              />
            </SectionCard>
          )}
        </>
      )}
    </DetailLayout>
  );
};

export default RentalContractDetail;
