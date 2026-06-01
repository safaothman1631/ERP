import { useEffect, useState } from 'react';
import { Card, Row, Col, Empty } from 'antd';
import type { TableProps } from 'antd';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, KpiCard, StatusTag, LoadingSkeleton } from '../../design-system';
import { space } from '../../theme/tokens';
import type { StatusKind } from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { InlineError } from '../../components/feedback/InlineError';
import { useLoadingState } from '../../hooks/useLoadingState';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';

interface Stats {
  total: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  sla_breach: number;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  assigned_to?: string;
}

const COLORS = ['#7B61FF', '#10b981', '#f59e0b', '#ef4444', '#9275FF'];

export default function HelpdeskDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { showSkeleton } = useLoadingState(loading);

  const load = async () => {
    setLoading(true);
    try {
      const [statsRes, ticketsRes] = await Promise.all([
        api.get('/api/helpdesk/stats'),
        api.get('/api/helpdesk/tickets', { params: { limit: 10 } }),
      ]);
      setStats(statsRes.data);
      setRecentTickets(ticketsRes.data.items || []);
    } catch (err) {
      console.error('Failed to load helpdesk dashboard:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const statusData = stats
    ? Object.entries(stats.by_status).map(([name, value]) => ({ name, value }))
    : [];

  const columns: TableProps<Ticket>['columns'] = [
    {
      title: t('helpdesk.subject'),
      dataIndex: 'subject',
      key: 'subject',
      render: (text, rec) => (
        <a onClick={() => navigate(`/helpdesk/tickets/${rec.id}`)}>{text}</a>
      ),
    },
    {
      title: t('helpdesk.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const kind: StatusKind =
          status === 'closed'
            ? 'success'
            : status === 'resolved'
            ? 'info'
            : status === 'pending'
            ? 'warning'
            : 'default';
        return <StatusTag status={kind} label={t(`helpdesk.status_${status}`)} />;
      },
    },
    {
      title: t('helpdesk.priority'),
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => t(`helpdesk.priority_${priority}`),
    },
    {
      title: t('created_at'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => (val ? new Date(val).toLocaleDateString() : '—'),
    },
  ];

  if (error) return <InlineError onRetry={load} />;
  if (showSkeleton) {
    return <LoadingSkeleton variant="card" />;
  }

  const openTickets = stats?.by_status.open || 0;
  const avgResolution = '—'; // Placeholder

  return (
    <div style={{ padding: space.lg }}>
      <PageHeader
        title={t('helpdesk.dashboard')}
        subtitle={t('helpdesk.dashboard_subtitle')}
      />
      <Row gutter={[16, 16]} style={{ marginTop: space.md }}>
        <Col xs={24} sm={12} md={6}>
          <KpiCard
            title={t('helpdesk.open_tickets')}
            value={openTickets.toString()}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <KpiCard
            title={t('helpdesk.sla_breached')}
            value={(stats?.sla_breach || 0).toString()}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <KpiCard
            title={t('helpdesk.avg_resolution_time')}
            value={avgResolution}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <KpiCard
            title={t('helpdesk.total_tickets')}
            value={(stats?.total || 0).toString()}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: space.md }}>
        <Col xs={24} md={12}>
          <Card title={t('helpdesk.recent_tickets')}>
            <ResponsiveTableAdapter
              dataSource={recentTickets}
              columns={columns}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: <Empty description={t('no_data')} /> }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={t('helpdesk.by_status')}>
            {statusData.length > 0 ? (
              <ResponsiveChart legendItems={[]} minMobileBlockSize={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.name}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveChart>
            ) : (
              <Empty description={t('no_data')} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
