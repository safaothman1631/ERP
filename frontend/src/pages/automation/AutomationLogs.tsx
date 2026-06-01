import React, { useEffect, useState } from 'react';
import { DatePicker, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, FilterBar, SectionCard, StatusTag } from '../../design-system';
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
      render: (v: string) => <StatusTag status="info" label={v || 'auto'} />,
    },
    {
      title: t('automation.status'),
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <StatusTag status={v === 'ok' ? 'success' : 'error'} label={v} />,
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
      
      <FilterBar
        filters={[
          {
            key: 'workflow_id',
            label: t('automation.filter_workflow'),
            options: workflows.map((wf) => ({ label: wf.name, value: wf.id })),
          },
          {
            key: 'status',
            label: t('automation.filter_status'),
            options: [
              { label: t('automation.status_ok'), value: 'ok' },
              { label: t('automation.status_error'), value: 'error' },
            ],
          },
        ]}
        values={{ workflow_id: filters.workflow_id ?? undefined, status: filters.status ?? undefined }}
        onChange={(v) => setFilters({ ...filters, workflow_id: v.workflow_id ?? null, status: v.status ?? null })}
        extra={
          <RangePicker
            onChange={(dates) => setFilters({ ...filters, date_range: dates })}
          />
        }
      />

      <SectionCard padded={false}>
        <ResponsiveTableAdapter dataSource={logs} columns={columns} loading={loading} rowKey={(r) => `${r.id || r.ran_at}`} />
      </SectionCard>
    </div>
  );
};

export default AutomationLogs;
