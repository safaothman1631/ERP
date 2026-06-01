import React, { useEffect, useState } from 'react';
import { Button, message, Row, Col } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import api from '../../api';
import { PageHeader, SectionCard, DataTable, KpiCard, StatusTag } from '../../design-system';
import type { ColumnDef } from '../../design-system/DataTable';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';

interface Activity {
  id: string;
  activity_type: string;
  summary: string;
  due_date?: string;
  assignee_id?: string;
  assignee_name?: string;
  status: string;
  created_at?: string;
}

const activityTypeLabel: Record<string, string> = {
  todo: 'مەرام',
  call: 'پەیوەندی',
  meeting: 'کۆبوونەوە',
  email: 'ئیمەیڵ',
  upload: 'بارکردن',
};

// Kit data-viz palette — CSS-var tokens that auto-flip for dark mode.
const COLORS = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-4)', 'var(--viz-5)'];

export default function ActivitiesDashboard() {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // Get all activities (admin view)
      // Backend doesn't have an org-wide endpoint yet, so we'll use the existing endpoint
      // In production, you'd want /api/chatter/activities (org-wide)
      const res = await api.get('/api/chatter/activities/my-due');
      setActivities(res.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // KPIs
  const totalActivities = activities.length;
  const pendingActivities = activities.filter((a) => a.status === 'pending').length;
  const doneActivities = activities.filter((a) => a.status === 'done').length;
  const today = dayjs().format('YYYY-MM-DD');
  const overdueActivities = activities.filter(
    (a) => a.status === 'pending' && a.due_date && a.due_date < today
  ).length;

  // Group by assignee
  const byUser: Record<string, { name: string; pending: number; done: number }> = {};
  activities.forEach((act) => {
    const userId = act.assignee_id || 'unassigned';
    const userName = act.assignee_name || t('activities.unassigned');
    if (!byUser[userId]) {
      byUser[userId] = { name: userName, pending: 0, done: 0 };
    }
    if (act.status === 'done') {
      byUser[userId].done += 1;
    } else {
      byUser[userId].pending += 1;
    }
  });

  const userRows = Object.entries(byUser).map(([userId, data]) => ({
    userId,
    userName: data.name,
    pending: data.pending,
    done: data.done,
    total: data.pending + data.done,
  }));

  // Group by type
  const byType: Record<string, number> = {};
  activities.forEach((act) => {
    byType[act.activity_type] = (byType[act.activity_type] || 0) + 1;
  });

  const typeData = Object.entries(byType).map(([type, count]) => ({
    name: activityTypeLabel[type] || type,
    value: count,
  }));

  const columns: ColumnDef<{ userId: string; userName: string; pending: number; done: number; total: number }>[] = [
    {
      title: t('activities.user'),
      dataIndex: 'userName',
      key: 'userName',
    },
    {
      title: t('activities.pending'),
      dataIndex: 'pending',
      key: 'pending',
      align: 'center',
      render: (val: number) => <StatusTag status="info" label={val} />,
    },
    {
      title: t('activities.done'),
      dataIndex: 'done',
      key: 'done',
      align: 'center',
      render: (val: number) => <StatusTag status="success" label={val} />,
    },
    {
      title: t('activities.total'),
      dataIndex: 'total',
      key: 'total',
      align: 'center',
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('activities.dashboard')}
        subtitle={t('activities.dashboard_subtitle')}
        extra={
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            {t('refresh')}
          </Button>
        }
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('activities.total_activities')}
            value={totalActivities}
            prefix=""
            suffix=""
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('activities.pending')}
            value={pendingActivities}
            prefix=""
            suffix=""
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('activities.done')}
            value={doneActivities}
            prefix=""
            suffix=""
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('activities.overdue')}
            value={overdueActivities}
            prefix=""
            suffix=""
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SectionCard title={t('activities.by_user')} padded={false} style={{ marginBottom: 0 }}>
            <DataTable
              dataSource={userRows}
              columns={columns}
              rowKey="userId"
              stickyHeader={false}
              pagination={false}
              style={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}
            />
          </SectionCard>
        </Col>

        <Col xs={24} lg={12}>
          <SectionCard title={t('activities.by_type')} style={{ marginBottom: 0 }}>
            {typeData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-500)' }}>{t('activities.no_data')}</div>
            ) : (
              <ResponsiveChart legendItems={[]} minMobileBlockSize={300}>
                <PieChart>
                  <Pie
                    data={typeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveChart>
            )}
          </SectionCard>
        </Col>
      </Row>
    </div>
  );
}
