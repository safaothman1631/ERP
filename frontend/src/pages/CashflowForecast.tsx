import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Select, Space } from 'antd';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, KpiCard } from '../design-system';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ResponsiveChart } from '../components/responsive/ResponsiveChart';
import { asTranslationKey } from '../i18n/types';

const { Option } = Select;

const CashflowForecast: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [_loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/cashflow/forecast/${days}`);
      setData(res.data);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [days]);

  return (
    <div>
      <PageHeader
        title={t('cashflow_forecast')}
        subtitle={t('cashflow_forecast_subtitle', 'Forecast cash flow')}
        helpKey="cashflow"
        extra={
          <Select value={days} onChange={setDays} style={{ width: 150 }}>
            <Option value={30}>{t('30_days', '30 days')}</Option>
            <Option value={60}>{t('60_days', '60 days')}</Option>
            <Option value={90}>{t('90_days', '90 days')}</Option>
          </Select>
        }
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard title={t('starting_cash')} value={data?.starting_cash || 0} tone="success" />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard title={t('projected_inflow')} value={data?.projected_inflow || 0} tone="info" />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard title={t('projected_outflow')} value={data?.projected_outflow || 0} tone="danger" />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              title={t('ending_cash')}
              value={data?.ending_cash || 0}
              tone={(data?.ending_cash || 0) > (data?.starting_cash || 0) ? 'success' : 'danger'}
            />
          </Col>
        </Row>

        <Card title={t('daily_breakdown')}>
          <ResponsiveChart
            legendItems={[
              { id: 'balance', labelKey: asTranslationKey('balance'), color: '#8884d8' },
              { id: 'inflow', labelKey: asTranslationKey('inflow'), color: '#82ca9d' },
              { id: 'outflow', labelKey: asTranslationKey('outflow'), color: '#ff7875' },
            ]}
            minMobileBlockSize={300}
          >
            <LineChart data={data?.daily_breakdown || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="balance" stroke="#8884d8" name={t('balance')} />
              <Line type="monotone" dataKey="inflow" stroke="#82ca9d" name={t('inflow')} />
              <Line type="monotone" dataKey="outflow" stroke="#ff7875" name={t('outflow')} />
            </LineChart>
          </ResponsiveChart>
        </Card>
      </Space>
    </div>
  );
};

export default CashflowForecast;
