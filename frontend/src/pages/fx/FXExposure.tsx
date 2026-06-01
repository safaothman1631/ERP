import React, { useState, useEffect } from 'react';
import { Card, DatePicker, Statistic, Row, Col, Space, Typography, Tag, message } from 'antd';
import { DollarOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { palette } from '../../theme/tokens';

const { Title, Text } = Typography;

interface ExposureCurrency {
  currency: string;
  foreign_balance: number;
  book_value: number;
  current_value: number;
  unrealized_gain_loss: number;
  accounts: Array<{
    account_id: string;
    account_name: string;
    balance: number;
    gain_loss: number;
  }>;
}

interface ExposureData {
  as_of_date: string;
  currencies: ExposureCurrency[];
  total_unrealized: number;
}

const FXExposure: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState<Dayjs>(dayjs());
  const [exposure, setExposure] = useState<ExposureData | null>(null);

  useEffect(() => {
    fetchExposure();
  }, []);

  const fetchExposure = async (date?: Dayjs) => {
    setLoading(true);
    try {
      const targetDate = date || asOfDate;
      const response = await api.get('/api/revaluations/exposure/current', {
        params: { as_of: targetDate.format('YYYY-MM-DD') },
      });
      setExposure(response.data);
    } catch (error: any) {
      message.error(error.response?.data?.detail || t('fx.fetchExposureError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (date: Dayjs | null) => {
    if (date) {
      setAsOfDate(date);
      fetchExposure(date);
    }
  };

  const expandedRowRender = (record: ExposureCurrency) => {
    const accountColumns = [
      {
        title: t('fx.accountName'),
        dataIndex: 'account_name',
        key: 'account_name',
      },
      {
        title: t('fx.balance'),
        dataIndex: 'balance',
        key: 'balance',
        align: 'right' as const,
        render: (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      },
      {
        title: t('fx.gainLoss'),
        dataIndex: 'gain_loss',
        key: 'gain_loss',
        align: 'right' as const,
        render: (val: number) => (
          <Text type={val >= 0 ? 'success' : 'danger'}>
            {val >= 0 ? '+' : ''}
            {val.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        ),
      },
    ];

    return (
      <ResponsiveTableAdapter
        columns={accountColumns}
        dataSource={record.accounts}
        rowKey="account_id"
        pagination={false}
        size="small"
      />
    );
  };

  const columns = [
    {
      title: t('fx.currency'),
      dataIndex: 'currency',
      key: 'currency',
      width: 120,
      render: (currency: string) => <Tag color={palette.info}>{currency}</Tag>,
    },
    {
      title: t('fx.foreignBalance'),
      dataIndex: 'foreign_balance',
      key: 'foreign_balance',
      align: 'right' as const,
      width: 150,
      render: (val: number, record: ExposureCurrency) =>
        `${val.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${record.currency}`,
    },
    {
      title: t('fx.bookValue'),
      dataIndex: 'book_value',
      key: 'book_value',
      align: 'right' as const,
      width: 150,
      render: (val: number) => `${val.toLocaleString('en-US', { minimumFractionDigits: 2 })} IQD`,
    },
    {
      title: t('fx.currentValue'),
      dataIndex: 'current_value',
      key: 'current_value',
      align: 'right' as const,
      width: 150,
      render: (val: number) => `${val.toLocaleString('en-US', { minimumFractionDigits: 2 })} IQD`,
    },
    {
      title: t('fx.unrealizedGainLoss'),
      dataIndex: 'unrealized_gain_loss',
      key: 'unrealized_gain_loss',
      align: 'right' as const,
      width: 180,
      render: (val: number) => (
        <Text strong type={val >= 0 ? 'success' : 'danger'}>
          {val >= 0 ? <RiseOutlined /> : <FallOutlined />}
          {' '}
          {val >= 0 ? '+' : ''}
          {val.toLocaleString('en-US', { minimumFractionDigits: 2 })} IQD
        </Text>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={<Title level={3} style={{ margin: 0 }}>{t('fx.fxExposure')}</Title>}
        extra={
          <Space>
            <Text>{t('fx.asOf')}:</Text>
            <DatePicker
              value={asOfDate}
              onChange={handleDateChange}
              format="YYYY-MM-DD"
              allowClear={false}
            />
          </Space>
        }
      >
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={8}>
            <Card>
              <Statistic
                title={t('fx.totalUnrealizedGainLoss')}
                value={exposure?.total_unrealized || 0}
                precision={2}
                valueStyle={{
                  color: (exposure?.total_unrealized || 0) >= 0 ? palette.success : palette.danger,
                }}
                prefix={<DollarOutlined />}
                suffix="IQD"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title={t('fx.currenciesExposed')}
                value={exposure?.currencies?.length || 0}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title={t('fx.evaluationDate')}
                value={exposure?.as_of_date || asOfDate.format('YYYY-MM-DD')}
                valueStyle={{ fontSize: '16px' }}
              />
            </Card>
          </Col>
        </Row>

        <ResponsiveTableAdapter
          columns={columns}
          dataSource={exposure?.currencies || []}
          rowKey="currency"
          loading={loading}
          expandable={{
            expandedRowRender,
            rowExpandable: (record) => record.accounts && record.accounts.length > 0,
          }}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default FXExposure;
