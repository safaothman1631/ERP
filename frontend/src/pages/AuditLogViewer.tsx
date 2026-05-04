import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Select, DatePicker, Input, message, Card, Tag } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader } from '../design-system';
import { space } from '../theme/tokens';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

const AuditLogViewer: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/audit', {
        params: {
          page,
          page_size: 50,
          entity_type: entityType || undefined,
          action: action || undefined,
          user_id: userId || undefined,
          date_from: dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
          date_to: dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
        },
      });
      setLogs(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (error) {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
  }, [page, entityType, action, userId, dateRange]);

  const handleReset = () => {
    setEntityType('');
    setAction('');
    setUserId('');
    setDateRange([null, null]);
    setPage(1);
  };

  const actionColors: Record<string, string> = {
    create: 'green',
    update: 'blue',
    delete: 'red',
    view: 'default',
  };

  const columns = [
    {
      title: t('audit_log.timestamp'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t('audit_log.user'),
      dataIndex: 'user_email',
      key: 'user_email',
      render: (v: string, record: any) => v || record.user_name || record.user_id || '-',
    },
    {
      title: t('audit_log.action'),
      dataIndex: 'action',
      key: 'action',
      render: (v: string) => <Tag color={actionColors[v] || 'default'}>{v?.toUpperCase()}</Tag>,
    },
    {
      title: t('audit_log.entity'),
      dataIndex: 'entity_type',
      key: 'entity_type',
      render: (v: string, record: any) => `${v || '-'} ${record.entity_id ? `#${record.entity_id.substring(0, 8)}` : ''}`,
    },
    {
      title: t('audit_log.summary'),
      dataIndex: 'summary',
      key: 'summary',
      render: (v: string) => v || '-',
    },
    {
      title: t('audit_log.ip'),
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: (v: string) => v || '-',
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('audit_log.title')}
        subtitle={t('audit_log.subtitle')}
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void fetchLogs()}>
            {t('refresh')}
          </Button>
        }
      />
      <Card style={{ marginTop: space.md }}>
        <Space style={{ marginBottom: space.md }} wrap>
          <Select
            placeholder={t('audit_log.entity_type')}
            allowClear
            style={{ width: 180 }}
            value={entityType || undefined}
            onChange={(v) => setEntityType(v || '')}
          >
            <Select.Option value="invoice">{t('invoice')}</Select.Option>
            <Select.Option value="bill">{t('bill')}</Select.Option>
            <Select.Option value="contact">{t('contact')}</Select.Option>
            <Select.Option value="item">{t('item')}</Select.Option>
            <Select.Option value="project">{t('project')}</Select.Option>
          </Select>
          <Select
            placeholder={t('audit_log.action')}
            allowClear
            style={{ width: 150 }}
            value={action || undefined}
            onChange={(v) => setAction(v || '')}
          >
            <Select.Option value="create">{t('audit_log.action_create')}</Select.Option>
            <Select.Option value="update">{t('audit_log.action_update')}</Select.Option>
            <Select.Option value="delete">{t('audit_log.action_delete')}</Select.Option>
          </Select>
          <Input
            placeholder={t('audit_log.user_id')}
            allowClear
            style={{ width: 180 }}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            prefix={<SearchOutlined />}
          />
          <RangePicker
            value={dateRange as any}
            onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null])}
            format="YYYY-MM-DD"
          />
          <Button onClick={handleReset}>{t('reset')}</Button>
        </Space>
        <Table
          dataSource={logs}
          columns={columns}
          loading={loading}
          rowKey="id"
          pagination={{
            current: page,
            pageSize: 50,
            total,
            onChange: (p) => setPage(p),
            showTotal: (total) => t('audit_log.total_logs', { count: total }),
          }}
        />
      </Card>
    </div>
  );
};

export default AuditLogViewer;
