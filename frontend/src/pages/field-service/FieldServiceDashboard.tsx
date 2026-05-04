import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Space } from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { message } from '../../utils/message';
import type { ColumnsType } from 'antd/es/table';

interface DashboardData {
  total_orders: number;
  by_status: Record<string, number>;
  active_workers: number;
}

interface TechnicianSchedule {
  id: string;
  technician_name: string;
  orders_count: number;
  orders: Array<{
    id: string;
    order_number: string;
    customer_name: string;
    scheduled_at: string;
    status: string;
  }>;
}

const FieldServiceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [schedules, setSchedules] = useState<TechnicianSchedule[]>([]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, ordersRes, workersRes] = await Promise.all([
        api.get('/api/field-service/dashboard'),
        api.get('/api/field-service/orders', { params: { limit: 500 } }),
        api.get('/api/field-service/workers', { params: { limit: 100 } }),
      ]);
      
      setDashData(dashRes.data);
      
      // Build today's schedule
      const today = new Date().toISOString().split('T')[0];
      const orders = ordersRes.data.items || [];
      const todayOrders = orders.filter((o: Record<string, unknown>) => {
        const sched = o.scheduled_at as string;
        return sched && sched.startsWith(today);
      });
      
      const workers = workersRes.data.items || [];
      const techSchedules: TechnicianSchedule[] = workers
        .filter((w: Record<string, unknown>) => w.is_active)
        .map((w: Record<string, unknown>) => {
          const techOrders = todayOrders.filter(
            (o: Record<string, unknown>) => o.assigned_worker_id === w.id
          );
          return {
            id: w.id as string,
            technician_name: w.name as string,
            orders_count: techOrders.length,
            orders: techOrders.map((o: Record<string, unknown>) => ({
              id: o.id as string,
              order_number: o.order_number as string,
              customer_name: o.customer_name as string,
              scheduled_at: o.scheduled_at as string,
              status: o.status as string,
            })),
          };
        });
      
      setSchedules(techSchedules);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboard();
  }, []);

  const openOrders = (dashData?.by_status?.draft || 0) + (dashData?.by_status?.scheduled || 0);
  const scheduledToday = schedules.reduce((sum, s) => sum + s.orders_count, 0);
  const inProgress = dashData?.by_status?.in_progress || 0;
  const completedWeek = dashData?.by_status?.done || 0;

  const completionData = [
    { day: 'Mon', completed: 5, total: 7 },
    { day: 'Tue', completed: 8, total: 10 },
    { day: 'Wed', completed: 6, total: 8 },
    { day: 'Thu', completed: 9, total: 11 },
    { day: 'Fri', completed: 7, total: 9 },
  ];

  const scheduleColumns: ColumnsType<TechnicianSchedule> = [
    {
      title: t('field_service.technician'),
      dataIndex: 'technician_name',
      key: 'technician_name',
    },
    {
      title: t('field_service.todays_schedule'),
      dataIndex: 'orders_count',
      key: 'orders_count',
      render: (count: number) => <Tag color="blue">{count}</Tag>,
    },
    {
      title: t('field_service.order_details'),
      key: 'orders',
      render: (_: unknown, record: TechnicianSchedule) => (
        <Space direction="vertical" size="small">
          {record.orders.map((o) => (
            <div key={o.id}>
              <a onClick={() => navigate(`/field-service/orders/${o.id}`)}>
                {o.order_number} - {o.customer_name}
              </a>
              {' '}
              <Tag color={o.status === 'done' ? 'green' : 'orange'}>{t(`field_service.status_${o.status}`)}</Tag>
            </div>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('field_service.dashboard')}
        subtitle={t('field_service.title')}
        breadcrumb={[
          { label: t('dashboard'), to: '/' },
          { label: t('field_service.title') },
        ]}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('field_service.open_orders')}
              value={openOrders}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('field_service.scheduled_today')}
              value={scheduledToday}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('field_service.in_progress')}
              value={inProgress}
              prefix={<SyncOutlined spin />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('field_service.completed_week')}
              value={completedWeek}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title={t('field_service.todays_schedule')} loading={loading}>
            <Table
              dataSource={schedules}
              columns={scheduleColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={t('field_service.completion_rate')}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={completionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="completed" fill="#52c41a" name={t('field_service.status_done')} />
                <Bar dataKey="total" fill="#d9d9d9" name={t('total')} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default FieldServiceDashboard;
