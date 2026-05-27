import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Empty, List, Space, Tag, Typography } from 'antd';
import { CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import api from '../../api';
import { HelpIcon } from '../../help/HelpIcon';
import { message } from '../../utils/message';
import { radius, space } from '../../theme/tokens';

const { Text, Title } = Typography;

interface Activity {
  id: string;
  title: string;
  status: string;
  due_at?: string;
  entity_type?: string;
  entity_id?: string;
}

export default function MyActivitiesWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/activities', { params: { assignee: 'me', status: 'open' } });
      setActivities(res.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const now = dayjs();
  const { overdueCount, dueTodayCount } = useMemo(() => {
    let overdue = 0;
    let dueToday = 0;
    for (const act of activities) {
      if (!act.due_at) continue;
      const due = dayjs(act.due_at);
      if (due.isBefore(now, 'day')) overdue += 1;
      else if (due.isSame(now, 'day')) dueToday += 1;
    }
    return { overdueCount: overdue, dueTodayCount: dueToday };
  }, [activities, now]);

  const badgeCount = overdueCount + dueTodayCount;
  const preview = activities.slice(0, 5);

  const handleMarkDone = async (id: string) => {
    try {
      await api.patch(`/api/activities/${id}`, { status: 'done' });
      message.success(t('activities.marked_done'));
      void load();
    } catch {
      message.error(t('error'));
    }
  };

  return (
    <Card
      style={{ borderRadius: radius.lg, marginTop: space.lg }}
      title={
        <Space align="center">
          <Title level={5} style={{ margin: 0 }}>{t('activities.my_activities')}</Title>
          {badgeCount > 0 && (
            <Badge
              count={badgeCount}
              style={{ backgroundColor: overdueCount > 0 ? '#f5222d' : '#faad14' }}
            />
          )}
          <HelpIcon sectionId="dashboard.activities" />
        </Space>
      }
      extra={
        <Space>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => void load()} loading={loading} />
          <Button size="small" type="link" onClick={() => navigate('/activities/my')}>
            {t('view_all', 'View all')}
          </Button>
        </Space>
      }
      data-section-id="dashboard.activities"
    >
      {preview.length === 0 ? (
        <Empty description={t('activities.none')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          dataSource={preview}
          renderItem={(act) => {
            const overdue = act.due_at && dayjs(act.due_at).isBefore(now, 'day');
            const dueToday = act.due_at && dayjs(act.due_at).isSame(now, 'day');
            return (
              <List.Item
                actions={[
                  <Button
                    key="done"
                    size="small"
                    type="text"
                    icon={<CheckOutlined />}
                    onClick={() => void handleMarkDone(act.id)}
                    aria-label={t('done')}
                  />,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size="small" wrap>
                      <Text strong={Boolean(overdue)}>{act.title}</Text>
                      {overdue && <Tag color="red">{t('activities.overdue')}</Tag>}
                      {!overdue && dueToday && <Tag color="orange">{t('activities.today')}</Tag>}
                    </Space>
                  }
                  description={
                    act.due_at ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(act.due_at).format('MMM D, YYYY')}
                        {act.entity_type ? ` · ${act.entity_type}` : ''}
                      </Text>
                    ) : (
                      act.entity_type && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {act.entity_type}
                        </Text>
                      )
                    )
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );
}
