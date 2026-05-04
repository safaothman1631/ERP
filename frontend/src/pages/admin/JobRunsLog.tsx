import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Drawer, Typography, Popconfirm, Row, Col, Statistic, Select } from 'antd';
import { ReloadOutlined, PlayCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { message } from '../../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

interface JobStatus {
  id: string;
  name: string;
  next_run_time: string | null;
  trigger: string;
  last_run?: {
    started_at: string;
    status: string;
    items_processed: number;
    items_failed: number;
    duration_ms: number;
  };
}

interface JobRun {
  id: string;
  job_name: string;
  status: 'success' | 'partial' | 'failed';
  items_processed: number;
  items_failed: number;
  errors: Array<{ item_id?: string; error_msg: string }>;
  started_at: string;
  finished_at: string;
  duration_ms: number;
}

export default function JobRunsLog() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedRun, setSelectedRun] = useState<JobRun | null>(null);
  const [filterJob, setFilterJob] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [schedulerRunning, setSchedulerRunning] = useState(false);

  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await api.get('/api/jobs/status');
      setJobs(res.data.jobs || []);
      setSchedulerRunning(res.data.scheduler_running);
    } catch (err: any) {
      message.error(err.response?.data?.detail || t('jobs.error_loading_status'));
    }
    setStatusLoading(false);
  };

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (filterJob) params.job_name = filterJob;
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/api/jobs/runs', { params });
      setRuns(res.data.items || []);
    } catch (err: any) {
      message.error(err.response?.data?.detail || t('jobs.error_loading_runs'));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    fetchRuns();
    const interval = setInterval(fetchStatus, 60000); // Refresh status every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [filterJob, filterStatus]);

  const handleTrigger = async (jobName: string) => {
    try {
      await api.post(`/api/jobs/${jobName}/trigger`);
      message.success(t('jobs.trigger_success'));
      setTimeout(() => {
        fetchStatus();
        fetchRuns();
      }, 2000);
    } catch (err: any) {
      message.error(err.response?.data?.detail || t('jobs.trigger_error'));
    }
  };

  const handleRowClick = async (record: JobRun) => {
    try {
      const res = await api.get(`/api/jobs/runs/${record.id}`);
      setSelectedRun(res.data);
      setDrawerVisible(true);
    } catch (err: any) {
      message.error(err.response?.data?.detail || t('jobs.error_loading_details'));
    }
  };

  const statusColors: Record<string, string> = {
    success: 'success',
    partial: 'warning',
    failed: 'error',
  };

  const jobColumns = [
    {
      title: t('jobs.job_name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('jobs.next_run'),
      dataIndex: 'next_run_time',
      key: 'next_run_time',
      render: (time: string | null) => time ? (
        <span>
          {dayjs(time).format('YYYY-MM-DD HH:mm')}
          <Text type="secondary" style={{ marginLeft: 8 }}>
            ({dayjs(time).fromNow()})
          </Text>
        </span>
      ) : '-',
    },
    {
      title: t('jobs.last_status'),
      key: 'last_status',
      render: (_: any, record: JobStatus) => record.last_run ? (
        <Space>
          <Tag color={statusColors[record.last_run.status]}>{t(`jobs.status_${record.last_run.status}`)}</Tag>
          <Text type="secondary">{dayjs(record.last_run.started_at).fromNow()}</Text>
        </Space>
      ) : <Text type="secondary">{t('jobs.never_run')}</Text>,
    },
    {
      title: t('jobs.last_run_stats'),
      key: 'last_run_stats',
      render: (_: any, record: JobStatus) => record.last_run ? (
        <Space size="large">
          <Text>
            {t('jobs.processed')}: <strong>{record.last_run.items_processed}</strong>
          </Text>
          {record.last_run.items_failed > 0 && (
            <Text type="danger">
              {t('jobs.failed')}: <strong>{record.last_run.items_failed}</strong>
            </Text>
          )}
          <Text type="secondary">
            {(record.last_run.duration_ms / 1000).toFixed(1)}s
          </Text>
        </Space>
      ) : '-',
    },
    {
      title: t('jobs.actions'),
      key: 'actions',
      render: (_: any, record: JobStatus) => (
        <Popconfirm
          title={t('jobs.confirm_trigger')}
          description={t('jobs.confirm_trigger_desc', { job: record.name })}
          onConfirm={() => handleTrigger(record.id)}
          okText={t('jobs.yes')}
          cancelText={t('jobs.no')}
        >
          <Button size="small" icon={<PlayCircleOutlined />}>
            {t('jobs.trigger_now')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const runsColumns = [
    {
      title: t('jobs.started_at'),
      dataIndex: 'started_at',
      key: 'started_at',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
      width: 170,
    },
    {
      title: t('jobs.job_name'),
      dataIndex: 'job_name',
      key: 'job_name',
      render: (name: string) => {
        const job = jobs.find(j => j.id === name);
        return job ? job.name : name;
      },
    },
    {
      title: t('jobs.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColors[status]}>{t(`jobs.status_${status}`)}</Tag>
      ),
      width: 100,
    },
    {
      title: t('jobs.processed'),
      dataIndex: 'items_processed',
      key: 'items_processed',
      align: 'right' as const,
      width: 100,
    },
    {
      title: t('jobs.failed'),
      dataIndex: 'items_failed',
      key: 'items_failed',
      align: 'right' as const,
      render: (val: number) => val > 0 ? <Text type="danger">{val}</Text> : val,
      width: 80,
    },
    {
      title: t('jobs.duration'),
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      render: (ms: number) => `${(ms / 1000).toFixed(1)}s`,
      width: 100,
      align: 'right' as const,
    },
  ];

  const jobStats = {
    total: jobs.length,
    running: jobs.filter(j => j.last_run?.status === 'success' && dayjs(j.last_run.started_at).isAfter(dayjs().subtract(1, 'hour'))).length,
    failed: jobs.filter(j => j.last_run?.status === 'failed').length,
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            <Title level={4} style={{ margin: 0 }}>{t('jobs.scheduler_title')}</Title>
            {schedulerRunning ? (
              <Tag color="success">{t('jobs.scheduler_running')}</Tag>
            ) : (
              <Tag color="error">{t('jobs.scheduler_stopped')}</Tag>
            )}
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => { fetchStatus(); fetchRuns(); }} loading={statusLoading || loading}>
            {t('refresh')}
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Statistic title={t('jobs.total_jobs')} value={jobStats.total} />
          </Col>
          <Col span={8}>
            <Statistic title={t('jobs.recently_run')} value={jobStats.running} valueStyle={{ color: '#3f8600' }} />
          </Col>
          <Col span={8}>
            <Statistic title={t('jobs.failed_jobs')} value={jobStats.failed} valueStyle={{ color: '#cf1322' }} />
          </Col>
        </Row>

        <Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>{t('jobs.registered_jobs')}</Title>
        <Table
          columns={jobColumns}
          dataSource={jobs}
          rowKey="id"
          loading={statusLoading}
          pagination={false}
          size="small"
        />
      </Card>

      <Card
        title={t('jobs.execution_history')}
        extra={
          <Space>
            <Select
              placeholder={t('jobs.filter_by_job')}
              allowClear
              style={{ width: 200 }}
              value={filterJob}
              onChange={setFilterJob}
            >
              {jobs.map(j => (
                <Select.Option key={j.id} value={j.id}>{j.name}</Select.Option>
              ))}
            </Select>
            <Select
              placeholder={t('jobs.filter_by_status')}
              allowClear
              style={{ width: 150 }}
              value={filterStatus}
              onChange={setFilterStatus}
            >
              <Select.Option value="success">{t('jobs.status_success')}</Select.Option>
              <Select.Option value="partial">{t('jobs.status_partial')}</Select.Option>
              <Select.Option value="failed">{t('jobs.status_failed')}</Select.Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={runsColumns}
          dataSource={runs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 50 }}
          size="small"
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      <Drawer
        title={t('jobs.run_details')}
        width={600}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        {selectedRun && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Text strong>{t('jobs.job_name')}: </Text>
              <Text>{jobs.find(j => j.id === selectedRun.job_name)?.name || selectedRun.job_name}</Text>
            </div>
            <div>
              <Text strong>{t('jobs.status')}: </Text>
              <Tag color={statusColors[selectedRun.status]}>{t(`jobs.status_${selectedRun.status}`)}</Tag>
            </div>
            <div>
              <Text strong>{t('jobs.started_at')}: </Text>
              <Text>{dayjs(selectedRun.started_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
            </div>
            <div>
              <Text strong>{t('jobs.finished_at')}: </Text>
              <Text>{dayjs(selectedRun.finished_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
            </div>
            <div>
              <Text strong>{t('jobs.duration')}: </Text>
              <Text>{(selectedRun.duration_ms / 1000).toFixed(2)}s</Text>
            </div>
            <div>
              <Text strong>{t('jobs.items_processed')}: </Text>
              <Text>{selectedRun.items_processed}</Text>
            </div>
            <div>
              <Text strong>{t('jobs.items_failed')}: </Text>
              <Text type={selectedRun.items_failed > 0 ? 'danger' : undefined}>{selectedRun.items_failed}</Text>
            </div>
            {selectedRun.errors && selectedRun.errors.length > 0 && (
              <div>
                <Text strong>{t('jobs.errors')}: </Text>
                <Card size="small" style={{ marginTop: 8, background: '#fff2e8' }}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    {selectedRun.errors.map((err, idx) => (
                      <div key={idx} style={{ paddingBottom: 8, borderBottom: idx < selectedRun.errors.length - 1 ? '1px solid #ffd8bf' : 'none' }}>
                        {err.item_id && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            ID: {err.item_id}
                          </Text>
                        )}
                        <div>
                          <Text code style={{ fontSize: 12 }}>{err.error_msg}</Text>
                        </div>
                      </div>
                    ))}
                  </Space>
                </Card>
              </div>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
}
