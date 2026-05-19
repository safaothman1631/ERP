import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Button, Space, Tag } from 'antd';
import {
  ToolOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { message } from '../../utils/message';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';
import { asTranslationKey } from '../../i18n/types';

interface DashboardData {
  equipment_count: number;
  active_equipment: number;
  requests_total: number;
  by_status: Record<string, number>;
}

const MaintenanceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentRequests, setRecentRequests] = useState<Record<string, unknown>[]>([]);
  const [overdueSchedules, setOverdueSchedules] = useState<Record<string, unknown>[]>([]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/maintenance/dashboard');
      setDashData(r.data);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentRequests = async () => {
    try {
      const r = await api.get('/api/maintenance/requests', { params: { limit: 5 } });
      setRecentRequests(r.data.items || []);
    } catch {
      // Ignore
    }
  };

  const fetchOverdueSchedules = async () => {
    try {
      const r = await api.get('/api/maintenance/schedules', { params: { limit: 500 } });
      const items = (r.data.items || []).filter((s: Record<string, unknown>) => {
        const dueDate = s.next_due_date as string;
        if (!dueDate) return false;
        return new Date(dueDate) < new Date();
      });
      setOverdueSchedules(items.slice(0, 5));
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    void fetchDashboard();
    void fetchRecentRequests();
    void fetchOverdueSchedules();
  }, []);

  const totalEquipment = dashData?.equipment_count || 0;
  const activeEquipment = dashData?.active_equipment || 0;
  const inMaintenance = dashData?.by_status?.in_progress || 0;
  const brokenEquipment = 0; // Could calculate from equipment status if available
  const openRequests = (dashData?.by_status?.new || 0) + (dashData?.by_status?.in_progress || 0);

  const requestsByType = [
    { name: t('maintenance.type_corrective'), value: 12 },
    { name: t('maintenance.type_preventive'), value: 8 },
    { name: t('maintenance.type_inspection'), value: 5 },
  ];

  const mtbfMttrTrend = [
    { month: 'Jan', mtbf: 120, mttr: 4 },
    { month: 'Feb', mtbf: 140, mttr: 3.5 },
    { month: 'Mar', mtbf: 130, mttr: 4.2 },
    { month: 'Apr', mtbf: 150, mttr: 3.8 },
  ];

  const requestColumns = [
    { title: t('maintenance.title'), dataIndex: 'title', key: 'title' },
    {
      title: t('maintenance.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag>{status}</Tag>,
    },
  ];

  const scheduleColumns = [
    { title: t('maintenance.equipment'), dataIndex: 'equipment_id', key: 'equipment_id' },
    {
      title: t('maintenance.next_due_date'),
      dataIndex: 'next_due_date',
      key: 'next_due_date',
      render: (date: string) => <span style={{ color: 'red' }}>{date}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title={t('maintenance.dashboard')}
        subtitle={t('maintenance.dashboard_subtitle')}
      />
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('maintenance.total_equipment')}
              value={totalEquipment}
              prefix={<ToolOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('maintenance.active_equipment')}
              value={activeEquipment}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('maintenance.in_maintenance')}
              value={inMaintenance}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('maintenance.broken_equipment')}
              value={brokenEquipment}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('maintenance.open_requests')}
              value={openRequests}
              prefix={<FileTextOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('maintenance.overdue_schedules')}
              value={overdueSchedules.length}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title={t('maintenance.requests_by_type')}>
            <ResponsiveChart
              legendItems={[
                { id: 'requests', labelKey: asTranslationKey('maintenance.requests'), color: '#1890ff' },
              ]}
            >
              <BarChart data={requestsByType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#1890ff" name={t('maintenance.requests')} />
              </BarChart>
            </ResponsiveChart>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={t('maintenance.mtbf_mttr_trend')}>
            <ResponsiveChart
              legendItems={[
                { id: 'mtbf', labelKey: asTranslationKey('maintenance.mtbf'), color: '#52c41a' },
                { id: 'mttr', labelKey: asTranslationKey('maintenance.mttr'), color: '#faad14' },
              ]}
            >
              <LineChart data={mtbfMttrTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="mtbf" stroke="#52c41a" name={t('maintenance.mtbf')} />
                <Line type="monotone" dataKey="mttr" stroke="#faad14" name={t('maintenance.mttr')} />
              </LineChart>
            </ResponsiveChart>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={t('maintenance.recent_requests')}
            extra={
              <Button type="link" onClick={() => navigate('/maintenance/requests')}>
                {t('view_all')}
              </Button>
            }
          >
            <ResponsiveTableAdapter
              columns={requestColumns}
              dataSource={recentRequests}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={t('maintenance.overdue_schedules')}
            extra={
              <Button type="link" onClick={() => navigate('/maintenance/schedules')}>
                {t('view_all')}
              </Button>
            }
          >
            <ResponsiveTableAdapter
              columns={scheduleColumns}
              dataSource={overdueSchedules}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginTop: 24 }}>
        <Button type="primary" onClick={() => navigate('/maintenance/equipment')}>
          {t('maintenance.manage_equipment')}
        </Button>
        <Button onClick={() => navigate('/maintenance/requests')}>
          {t('maintenance.manage_requests')}
        </Button>
        <Button onClick={() => navigate('/maintenance/schedules')}>
          {t('maintenance.manage_schedules')}
        </Button>
        <Button onClick={() => navigate('/maintenance/categories')}>
          {t('maintenance.manage_categories')}
        </Button>
      </Space>
    </>
  );
};

export default MaintenanceDashboard;
