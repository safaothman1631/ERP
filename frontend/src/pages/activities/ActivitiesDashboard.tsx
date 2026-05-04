import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Tag, message, Row, Col } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import api from '../../api';
import { PageHeader, KpiCard } from '../../design-system';

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

const activityTypeColor: Record<string, string> = {
  todo: 'blue',
  call: 'green',
  meeting: 'purple',
  email: 'orange',
  upload: 'cyan',
};

const activityTypeLabel: Record<string, string> = {
  todo: 'مەرام',
  call: 'پەیوەندی',
  meeting: 'کۆبوونەوە',
  email: 'ئیمەیڵ',
  upload: 'بارکردن',
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

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

  const columns: ColumnsType<any> = [
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
      render: (val: number) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: t('activities.done'),
      dataIndex: 'done',
      key: 'done',
      align: 'center',
      render: (val: number) => <Tag color="green">{val}</Tag>,
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

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title={t('activities.by_user')} style={{ marginBottom: 16 }}>
            <Table
              dataSource={userRows}
              columns={columns}
              rowKey="userId"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={t('activities.by_type')} style={{ marginBottom: 16 }}>
            {typeData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>{t('activities.no_data')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
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
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
