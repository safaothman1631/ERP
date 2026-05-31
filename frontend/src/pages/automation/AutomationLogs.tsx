import React, { useEffect, useState } from 'react';
import { Tag, Card, Select, DatePicker, Space, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import dayjs from 'dayjs';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const { RangePicker } = DatePicker;

const AutomationLogs: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<any>({
    workflow_id: null,
    status: null,
    date_range: null,
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/automation/logs', { params: { limit: 200 } });
      let filtered = res.data.items || [];
      
      // Client-side filtering (since backend doesn't have complex query)
      if (filters.workflow_id) {
        filtered = filtered.filter((log: any) => log.workflow_id === filters.workflow_id);
      }
      if (filters.status) {
        filtered = filtered.filter((log: any) => log.status === filters.status);
      }
      if (filters.date_range && filters.date_range.length === 2) {
        const [start, end] = filters.date_range;
        filtered = filtered.filter((log: any) => {
          const logDate = dayjs(log.ran_at);
          return logDate.isAfter(start) && logDate.isBefore(end);
        });
      }
      
      setLogs(filtered);
    } catch {
      // message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const res = await api.get('/api/automation/workflows');
      setWorkflows(res.data.items || []);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    void fetchLogs();
    void fetchWorkflows();
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [filters]);

  const columns = [
    {
      title: t('automation.workflow'),
      dataIndex: 'workflow_name',
      key: 'workflow_name',
      render: (v: string, record: any) => v || record.job_name || 'N/A',
    },
    {
      title: t('automation.ran_at'),
      dataIndex: 'ran_at',
      key: 'ran_at',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: t('automation.trigger'),
      dataIndex: 'trigger',
      key: 'trigger',
      render: (v: string) => <Tag color="blue">{v || 'auto'}</Tag>,
    },
    {
      title: t('automation.status'),
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={v === 'ok' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: t('automation.result'),
      dataIndex: 'result',
      key: 'result',
      render: (v: string) => v || '-',
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('automation.logs')}
        subtitle={t('automation.logs_subtitle')}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchLogs}>
            {t('refresh')}
          </Button>
        }
      />
      
      <Card style={{ marginTop: space.md, marginBottom: space.md }}>
        <Space wrap>
          <Select
            placeholder={t('automation.filter_workflow')}
            style={{ width: 200 }}
            allowClear
            onChange={(v) => setFilters({ ...filters, workflow_id: v })}
          >
            {workflows.map((wf) => (
              <Select.Option key={wf.id} value={wf.id}>{wf.name}</Select.Option>
            ))}
          </Select>
          
          <Select
            placeholder={t('automation.filter_status')}
            style={{ width: 150 }}
            allowClear
            onChange={(v) => setFilters({ ...filters, status: v })}
          >
            <Select.Option value="ok">{t('automation.status_ok')}</Select.Option>
            <Select.Option value="error">{t('automation.status_error')}</Select.Option>
          </Select>
          
          <RangePicker
            onChange={(dates) => setFilters({ ...filters, date_range: dates })}
          />
        </Space>
      </Card>
      
      <Card>
        <ResponsiveTableAdapter dataSource={logs} columns={columns} loading={loading} rowKey={(r) => `${r.id || r.ran_at}`} />
      </Card>
    </div>
  );
};

export default AutomationLogs;
