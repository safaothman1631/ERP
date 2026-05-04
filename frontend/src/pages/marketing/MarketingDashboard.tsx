import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Spin, Empty } from 'antd';
import type { TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../design-system';
import api from '../../api';
import { message } from '../../utils/message';
import { MailOutlined, SendOutlined, EyeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDate } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';

const MarketingDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    campaignsSentThisMonth: 0,
    totalReach: 0,
    avgOpenRate: 0,
    activeAutomations: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [campRes, autoRes] = await Promise.all([
        api.get('/api/marketing/campaigns', { params: { limit: 10 } }),
        api.get('/api/marketing/automations'),
      ]);

      const allCampaigns = campRes.data.items || [];
      setCampaigns(allCampaigns.slice(0, 5));

      // Compute KPIs
      const now = new Date();
      const thisMonth = allCampaigns.filter((c: any) => {
        if (!c.sent_at) return false;
        const sent = new Date(c.sent_at);
        return sent.getMonth() === now.getMonth() && sent.getFullYear() === now.getFullYear();
      });

      const totalReach = allCampaigns.reduce((sum: number, c: any) => sum + (c.recipient_count || 0), 0);
      const activeAuto = (autoRes.data.items || []).filter((a: any) => a.active).length;

      setKpis({
        campaignsSentThisMonth: thisMonth.length,
        totalReach,
        avgOpenRate: 0, // Stub for now
        activeAutomations: activeAuto,
      });

      // Generate chart data (stub — last 7 days)
      const chartStub = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return {
          date: date.toISOString().split('T')[0],
          sent: Math.floor(Math.random() * 100),
        };
      });
      setChartData(chartStub);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const columns: TableColumnsType<any> = [
    { title: t('marketing.name'), dataIndex: 'name', key: 'name' },
    { title: t('marketing.subject'), dataIndex: 'subject', key: 'subject' },
    { title: t('marketing.status'), dataIndex: 'status', key: 'status' },
    {
      title: t('marketing.sent_at'),
      dataIndex: 'sent_at',
      key: 'sent_at',
      render: (val: string) => (val ? formatDate(val) : '—'),
    },
    {
      title: t('marketing.recipients'),
      dataIndex: 'recipient_count',
      key: 'recipient_count',
      render: (val: number) => val || 0,
    },
  ];

  return (
    <div>
      <PageHeader title={t('marketing.dashboard')} subtitle={t('marketing.dashboard_subtitle')} />

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={t('marketing.campaigns_sent_this_month')}
                value={kpis.campaignsSentThisMonth}
                prefix={<MailOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={t('marketing.total_reach')}
                value={kpis.totalReach}
                prefix={<SendOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={t('marketing.avg_open_rate')}
                value={kpis.avgOpenRate}
                suffix="%"
                prefix={<EyeOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={t('marketing.active_automations')}
                value={kpis.activeAutomations}
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Card title={t('marketing.sends_per_day')} style={{ marginBottom: 24 }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="sent" stroke="#1890ff" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Empty description={t('no_data')} />
          )}
        </Card>

        <Card title={t('marketing.recent_campaigns')}>
          <Table
            columns={columns}
            dataSource={campaigns}
            rowKey="id"
            pagination={false}
            onRow={(rec) => ({ onClick: () => navigate(`/marketing/campaigns/email`) })}
            style={{ cursor: 'pointer' }}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default MarketingDashboard;
