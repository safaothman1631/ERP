import React, { useEffect, useState } from 'react';
import { Card, Button, Space, Empty, Tag, Popconfirm, message, Row, Col } from 'antd';
import { ReloadOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader } from '../../design-system';

interface Activity {
  id: string;
  activity_type: string;
  summary: string;
  notes?: string;
  due_date?: string;
  entity_type?: string;
  entity_id?: string;
  status: string;
  created_by_name?: string;
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

export default function MyActivities() {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
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

  const handleMarkDone = async (id: string) => {
    try {
      await api.post(`/api/chatter/activities/${id}/done`);
      message.success(t('activities.marked_done'));
      load();
    } catch {
      message.error(t('error'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/chatter/activities/${id}`);
      message.success(t('deleted'));
      load();
    } catch {
      message.error(t('error'));
    }
  };

  const today = dayjs().format('YYYY-MM-DD');
  const overdue = activities.filter((a) => a.due_date && a.due_date < today);
  const todayItems = activities.filter((a) => a.due_date === today);
  const upcoming = activities.filter((a) => a.due_date && a.due_date > today);
  const noDueDate = activities.filter((a) => !a.due_date);

  const renderActivityCard = (act: Activity) => (
    <Card
      key={act.id}
      size="small"
      style={{ marginBottom: 8 }}
      extra={
        <Space>
          <Button
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleMarkDone(act.id)}
          >
            {t('done')}
          </Button>
          <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(act.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Tag color={activityTypeColor[act.activity_type] || 'default'}>
            {activityTypeLabel[act.activity_type] || act.activity_type}
          </Tag>
        </div>
        <div style={{ fontWeight: 600 }}>{act.summary}</div>
        {act.notes && <div style={{ color: '#888', fontSize: 13 }}>{act.notes}</div>}
        {act.due_date && (
          <div style={{ fontSize: 12, color: '#888' }}>
            {t('activities.due')}: {dayjs(act.due_date).format('MMM D, YYYY')}
          </div>
        )}
        {act.entity_type && (
          <div style={{ fontSize: 12, color: '#aaa' }}>
            {t('activities.related_to')}: {act.entity_type} ({act.entity_id})
          </div>
        )}
      </Space>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title={t('activities.my_activities')}
        subtitle={t('activities.my_activities_subtitle')}
        extra={
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            {t('refresh')}
          </Button>
        }
      />

      <Row gutter={16}>
        <Col xs={24} md={12} lg={6}>
          <Card
            title={
              <span style={{ color: '#f5222d' }}>
                {t('activities.overdue')} ({overdue.length})
              </span>
            }
            style={{ marginBottom: 16 }}
          >
            {overdue.length === 0 ? (
              <Empty description={t('activities.no_overdue')} />
            ) : (
              overdue.map(renderActivityCard)
            )}
          </Card>
        </Col>

        <Col xs={24} md={12} lg={6}>
          <Card
            title={
              <span style={{ color: '#faad14' }}>
                {t('activities.today')} ({todayItems.length})
              </span>
            }
            style={{ marginBottom: 16 }}
          >
            {todayItems.length === 0 ? (
              <Empty description={t('activities.no_today')} />
            ) : (
              todayItems.map(renderActivityCard)
            )}
          </Card>
        </Col>

        <Col xs={24} md={12} lg={6}>
          <Card
            title={
              <span style={{ color: '#1890ff' }}>
                {t('activities.upcoming')} ({upcoming.length})
              </span>
            }
            style={{ marginBottom: 16 }}
          >
            {upcoming.length === 0 ? (
              <Empty description={t('activities.no_upcoming')} />
            ) : (
              upcoming.map(renderActivityCard)
            )}
          </Card>
        </Col>

        <Col xs={24} md={12} lg={6}>
          <Card
            title={
              <span>
                {t('activities.no_due_date')} ({noDueDate.length})
              </span>
            }
            style={{ marginBottom: 16 }}
          >
            {noDueDate.length === 0 ? (
              <Empty description={t('activities.none')} />
            ) : (
              noDueDate.map(renderActivityCard)
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
