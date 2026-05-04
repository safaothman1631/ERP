import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Select, Space } from 'antd';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader } from '../design-system';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const { Option } = Select;

const CashflowForecast: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
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
        subtitle={t('cashflow_forecast_subtitle', 'پێش‌بینی گۆڕانی پارە')}
        helpKey="cashflow"
        extra={
          <Select value={days} onChange={setDays} style={{ width: 150 }}>
            <Option value={30}>{t('30_days', '٣٠ ڕۆژ')}</Option>
            <Option value={60}>{t('60_days', '٦٠ ڕۆژ')}</Option>
            <Option value={90}>{t('90_days', '٩٠ ڕۆژ')}</Option>
          </Select>
        }
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('starting_cash')}
                value={data?.starting_cash || 0}
                precision={2}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('projected_inflow')}
                value={data?.projected_inflow || 0}
                precision={2}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('projected_outflow')}
                value={data?.projected_outflow || 0}
                precision={2}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('ending_cash')}
                value={data?.ending_cash || 0}
                precision={2}
                valueStyle={{ color: (data?.ending_cash || 0) > (data?.starting_cash || 0) ? '#3f8600' : '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>

        <Card title={t('daily_breakdown')}>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data?.daily_breakdown || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="balance" stroke="#8884d8" name={t('balance')} />
              <Line type="monotone" dataKey="inflow" stroke="#82ca9d" name={t('inflow')} />
              <Line type="monotone" dataKey="outflow" stroke="#ff7875" name={t('outflow')} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </Space>
    </div>
  );
};

export default CashflowForecast;
