/**
 * SystemHealthPage — /settings/system-health
 *
 * Displays a real-time health dashboard for all system components.
 * Accessible only to users with role "admin" or "owner".
 *
 * Sub-components:
 *   - OverallStatusBanner   — Ant Design Alert with dynamic type/icon
 *   - ComponentCard         — Card per component with status badge/tag
 *   - RecommendationsPanel  — List of actionable recommendations
 *   - LastCheckedTimestamp  — Human-readable checked_at timestamp
 *   - BackupHistoryTable    — Backup records table with run/download actions
 *
 * Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.11
 */
import React from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  List,
  message,
  Row,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloudDownloadOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import api from '../../api';
import { usePermission } from '../../hooks/usePermission';

dayjs.extend(relativeTime);

const { Text, Title } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time_ms: number;
  message: string;
  checked_at: string;
}

export interface FullHealthReport {
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  checked_at: string;
  components: HealthCheckResult[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

type StatusColor = 'success' | 'warning' | 'error';

function statusToAlertType(status: 'healthy' | 'degraded' | 'unhealthy'): StatusColor {
  if (status === 'healthy') return 'success';
  if (status === 'degraded') return 'warning';
  return 'error';
}

function statusToTagColor(status: 'healthy' | 'degraded' | 'unhealthy'): string {
  if (status === 'healthy') return 'success';
  if (status === 'degraded') return 'warning';
  return 'error';
}

function statusToBadgeStatus(
  status: 'healthy' | 'degraded' | 'unhealthy',
): 'success' | 'warning' | 'error' {
  if (status === 'healthy') return 'success';
  if (status === 'degraded') return 'warning';
  return 'error';
}

function statusToIcon(status: 'healthy' | 'degraded' | 'unhealthy'): React.ReactNode {
  if (status === 'healthy') return <CheckCircleOutlined />;
  if (status === 'degraded') return <WarningOutlined />;
  return <ExclamationCircleOutlined />;
}

// ---------------------------------------------------------------------------
// OverallStatusBanner
// ---------------------------------------------------------------------------

interface OverallStatusBannerProps {
  /** null means API call failed */
  status: 'healthy' | 'degraded' | 'unhealthy' | null;
  apiError: boolean;
}

/**
 * Displays the overall system status as an Ant Design Alert.
 *
 * - "healthy"   → type="success", green, checkmark icon
 * - "degraded"  → type="warning", yellow, caution icon
 * - "unhealthy" → type="error",   red,   warning icon
 * - API failure → type="error",   "Health check unavailable" (overrides any cached state)
 *
 * Requirements: 2.4, 2.5, 2.6, 2.7
 */
export const OverallStatusBanner: React.FC<OverallStatusBannerProps> = ({
  status,
  apiError,
}) => {
  const { t } = useTranslation();

  if (apiError || status === null) {
    return (
      <Alert
        type="error"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message={t('system_health.unavailable', 'Health check unavailable')}
        description={t(
          'system_health.unavailable_desc',
          'Unable to retrieve system health data. Please retry.',
        )}
        style={{ marginBottom: 24 }}
      />
    );
  }

  const labelMap: Record<string, string> = {
    healthy: t('system_health.status_healthy', 'All Systems Operational'),
    degraded: t('system_health.status_degraded', 'System Degraded'),
    unhealthy: t('system_health.status_unhealthy', 'System Unhealthy'),
  };

  return (
    <Alert
      type={statusToAlertType(status)}
      showIcon
      icon={statusToIcon(status)}
      message={labelMap[status] ?? status}
      style={{ marginBottom: 24 }}
    />
  );
};

// ---------------------------------------------------------------------------
// ComponentCard
// ---------------------------------------------------------------------------

interface ComponentCardProps {
  result: HealthCheckResult;
}

/**
 * Displays a single component's health status as an Ant Design Card.
 * Shows: component name, status badge/tag, response time in ms, status message.
 *
 * Requirements: 2.3
 */
export const ComponentCard: React.FC<ComponentCardProps> = ({ result }) => {
  const { t } = useTranslation();

  const componentLabel = t(
    `system_health.component_${result.component}`,
    result.component.charAt(0).toUpperCase() + result.component.slice(1),
  );

  return (
    <Card
      size="small"
      title={
        <Space>
          <Badge status={statusToBadgeStatus(result.status)} />
          <Text strong>{componentLabel}</Text>
        </Space>
      }
      extra={
        <Tag color={statusToTagColor(result.status)}>
          {result.status.toUpperCase()}
        </Tag>
      }
      style={{ height: '100%' }}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('system_health.response_time', 'Response time')}:{' '}
          <Text strong>{result.response_time_ms.toFixed(1)} ms</Text>
        </Text>
        <Text style={{ fontSize: 13 }}>{result.message}</Text>
      </Space>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// RecommendationsPanel
// ---------------------------------------------------------------------------

interface RecommendationsPanelProps {
  recommendations: string[];
}

/**
 * Displays actionable recommendations as an Ant Design List.
 * Hidden when the recommendations array is empty.
 *
 * Requirements: 2.8
 */
export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  recommendations,
}) => {
  const { t } = useTranslation();

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <Card
      title={
        <Space>
          <WarningOutlined style={{ color: '#faad14' }} />
          <span>{t('system_health.recommendations', 'Recommendations')}</span>
        </Space>
      }
      style={{ marginBottom: 24 }}
    >
      <List
        size="small"
        dataSource={recommendations}
        renderItem={(item) => (
          <List.Item>
            <Text>{item}</Text>
          </List.Item>
        )}
      />
    </Card>
  );
};

// ---------------------------------------------------------------------------
// LastCheckedTimestamp
// ---------------------------------------------------------------------------

interface LastCheckedTimestampProps {
  checkedAt: string | null;
}

/**
 * Displays the last successful health check timestamp in human-readable format.
 * Uses dayjs for formatting.
 *
 * Requirements: 2.11
 */
export const LastCheckedTimestamp: React.FC<LastCheckedTimestampProps> = ({
  checkedAt,
}) => {
  const { t } = useTranslation();

  if (!checkedAt) return null;

  const formatted = dayjs(checkedAt).format('YYYY-MM-DD HH:mm:ss');
  const relative = dayjs(checkedAt).fromNow();

  return (
    <Text type="secondary" style={{ fontSize: 12 }}>
      {t('system_health.last_checked', 'Last checked')}: {formatted} ({relative})
    </Text>
  );
};

// ---------------------------------------------------------------------------
// BackupHistoryTable
// ---------------------------------------------------------------------------

export interface BackupRecord {
  id: string;
  org_id: string;
  filename: string;
  storage_path: string;
  created_at: string;
  status: 'success' | 'failed';
  integrity_status: 'verified' | 'failed' | 'pending';
  total_documents: number;
  collections_backed_up: string[];
  file_size_bytes: number;
  checksum_sha256: string;
  error_message: string | null;
}

/** Format bytes to a human-readable string (KB / MB / GB). */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Displays the backup history table with run/download actions.
 *
 * - Fetches `GET /api/system/backup/list` via React Query
 * - "Run Backup Now" button calls `POST /api/system/backup/run`
 * - Download button calls `GET /api/system/backup/{id}/download` and opens the signed URL
 * - Failed rows get a red background; error message shown in tooltip on status badge
 * - Tooltips on successful status badges show metadata
 * - Every row is always rendered regardless of visual indicator render success
 *
 * Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 8.7
 */
export const BackupHistoryTable: React.FC = () => {
  const { t } = useTranslation();
  const [runLoading, setRunLoading] = React.useState(false);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const {
    data: backups,
    isLoading,
    refetch,
  } = useQuery<BackupRecord[]>({
    queryKey: ['backup-list'],
    queryFn: async () => {
      const response = await api.get<BackupRecord[]>('/api/system/backup/list');
      return response.data;
    },
    retry: 1,
  });

  const handleRunBackup = async () => {
    setRunLoading(true);
    try {
      await api.post('/api/system/backup/run');
      // Refresh the table after queuing the backup
      void refetch();
    } catch {
      void message.error(t('backup.run_failed', 'Failed to start backup. Please try again.'));
    } finally {
      setRunLoading(false);
    }
  };

  const handleDownload = async (record: BackupRecord) => {
    setDownloadingId(record.id);
    try {
      // Endpoint now streams the file directly — fetch as blob with auth header
      const response = await api.get(
        `/api/system/backup/${record.id}/download`,
        { responseType: 'blob' },
      );
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = record.filename || 'backup.json.gz';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      void message.error(
        t('backup.download_failed', 'Failed to download backup. Please try again.'),
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const columns: ColumnsType<BackupRecord> = [
    {
      title: t('backup.col_datetime', 'Date / Time'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: t('backup.col_status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: BackupRecord['status'], record: BackupRecord) => {
        const isSuccess = status === 'success';
        const badge = (
          <Badge
            status={isSuccess ? 'success' : 'error'}
            text={
              <Tag color={isSuccess ? 'success' : 'error'}>
                {isSuccess
                  ? t('backup.status_success', 'Success')
                  : t('backup.status_failed', 'Failed')}
              </Tag>
            }
          />
        );

        if (!isSuccess && record.error_message) {
          return (
            <Tooltip title={record.error_message} color="red">
              {badge}
            </Tooltip>
          );
        }

        if (isSuccess) {
          const meta = `${t('backup.checksum', 'SHA-256')}: ${record.checksum_sha256.slice(0, 16)}…`;
          return <Tooltip title={meta}>{badge}</Tooltip>;
        }

        return badge;
      },
    },
    {
      title: t('backup.col_integrity', 'Integrity'),
      dataIndex: 'integrity_status',
      key: 'integrity_status',
      width: 140,
      render: (integrityStatus: BackupRecord['integrity_status']) => {
        if (integrityStatus === 'verified') {
          return (
            <Tooltip title={t('backup.integrity_verified_tip', 'Document count and checksum verified')}>
              <Tag color="success" icon={<CheckCircleOutlined />}>
                {t('backup.integrity_verified', 'Verified')}
              </Tag>
            </Tooltip>
          );
        }
        if (integrityStatus === 'failed') {
          return (
            <Tooltip
              title={t(
                'backup.integrity_failed_tip',
                'Integrity verification failed — document count mismatch or decompression error',
              )}
              color="red"
            >
              <Tag color="error" icon={<WarningOutlined />}>
                {t('backup.integrity_failed', 'Failed')}
              </Tag>
            </Tooltip>
          );
        }
        // pending
        return (
          <Tag color="processing">
            {t('backup.integrity_pending', 'Pending')}
          </Tag>
        );
      },
    },
    {
      title: t('backup.col_total_docs', 'Total Docs'),
      dataIndex: 'total_documents',
      key: 'total_documents',
      width: 110,
      align: 'right',
      render: (val: number) => val.toLocaleString(),
    },
    {
      title: t('backup.col_file_size', 'File Size'),
      dataIndex: 'file_size_bytes',
      key: 'file_size_bytes',
      width: 100,
      align: 'right',
      render: (val: number) => formatBytes(val),
    },
    {
      title: t('backup.col_storage_path', 'Storage Path'),
      dataIndex: 'storage_path',
      key: 'storage_path',
      ellipsis: true,
      render: (val: string) => (
        <Tooltip title={val}>
          <Text style={{ fontSize: 12 }} type="secondary">
            {val}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: t('backup.col_download', 'Download'),
      key: 'download',
      width: 110,
      align: 'center',
      render: (_: unknown, record: BackupRecord) => (
        <Button
          size="small"
          icon={<CloudDownloadOutlined />}
          loading={downloadingId === record.id}
          onClick={() => void handleDownload(record)}
          disabled={record.status === 'failed'}
        >
          {t('backup.download', 'Download')}
        </Button>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <span>{t('backup.history_title', 'Backup History')}</span>
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={runLoading}
          onClick={() => void handleRunBackup()}
        >
          {t('backup.run_now', 'Run Backup Now')}
        </Button>
      }
      style={{ marginTop: 24 }}
    >
      <Table<BackupRecord>
        dataSource={backups ?? []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: false }}
        rowClassName={(record) =>
          record.status === 'failed' ? 'backup-row-failed' : ''
        }
        onRow={(record) => ({
          style:
            record.status === 'failed'
              ? { backgroundColor: '#fff2f0' }
              : undefined,
        })}
        locale={{
          emptyText: t('backup.no_records', 'No backup records found'),
        }}
      />
    </Card>
  );
};

// ---------------------------------------------------------------------------
// SystemHealthPage (main page component)
// ---------------------------------------------------------------------------

/**
 * Main page component for the System Health Dashboard.
 *
 * - Route: /settings/system-health
 * - Access: admin and owner roles only (redirects others to /dashboard)
 * - Auto-refreshes every 60 seconds
 * - Supports RTL/LTR via existing i18n infrastructure
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13
 */
const SystemHealthPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasSettingsAccess } = usePermission();

  // Tracks whether the next fetch should bypass the server-side cache (Requirement 2.9, 9.3)
  const [forceRefresh, setForceRefresh] = React.useState(false);

  // Role guard — redirect non-admin/non-owner users (Requirement 2.1)
  React.useEffect(() => {
    if (!hasSettingsAccess) {
      navigate('/dashboard', { replace: true });
    }
  }, [hasSettingsAccess, navigate]);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery<FullHealthReport>({
    // Include forceRefresh in the query key so changing it triggers a new fetch
    queryKey: ['system-health', forceRefresh],
    queryFn: async () => {
      // When forceRefresh is true, pass force=true to bypass the 30-second server cache
      const response = await api.get<FullHealthReport>('/api/system/health/full', {
        params: forceRefresh ? { force: true } : undefined,
      });
      // Reset force flag after a forced fetch so subsequent auto-refreshes are normal
      if (forceRefresh) {
        setForceRefresh(false);
      }
      return response.data;
    },
    // Auto-refresh every 60 seconds (Requirement 2.13)
    refetchInterval: 60_000,
    // Don't retry on error — show error state immediately
    retry: 1,
  });

  const handleRefresh = () => {
    // Set force=true so the next query call bypasses the server-side cache (Requirement 2.9, 9.3)
    setForceRefresh(true);
  };

  if (!hasSettingsAccess) {
    return null;
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          {t('system_health.title', 'System Health')}
        </Title>
        <Space>
          {data && <LastCheckedTimestamp checkedAt={data.checked_at} />}
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={isLoading}
          >
            {t('system_health.refresh', 'Refresh')}
          </Button>
        </Space>
      </div>

      {/* Loading skeleton — hidden immediately on error (Requirement 2.2) */}
      {isLoading && !isError && (
        <div>
          <Skeleton active style={{ marginBottom: 24 }} />
          <Row gutter={[16, 16]}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Col key={i} xs={24} sm={12} md={8} lg={6}>
                <Card size="small">
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* Error state — show when API call fails (Requirement 2.10) */}
      {isError && (
        <Alert
          type="error"
          showIcon
          message={t('system_health.error_title', 'Health check failed')}
          description={t(
            'system_health.error_desc',
            'Could not load system health data. Please try again.',
          )}
          action={
            <Button size="small" onClick={() => refetch()}>
              {t('system_health.retry', 'Retry')}
            </Button>
          }
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Main content — rendered when data is available */}
      {!isLoading && (
        <>
          {/* Overall status banner (Requirements 2.4–2.7) */}
          <OverallStatusBanner
            status={data?.overall_status ?? null}
            apiError={isError}
          />

          {/* Component cards grid (Requirement 2.3) */}
          {data && data.components.length > 0 && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {data.components.map((component) => (
                <Col key={component.component} xs={24} sm={12} md={8} lg={6}>
                  <ComponentCard result={component} />
                </Col>
              ))}
            </Row>
          )}

          {/* Recommendations panel (Requirement 2.8) */}
          {data && (
            <RecommendationsPanel recommendations={data.recommendations} />
          )}

          {/* Backup history table (Requirements 8.1–8.7) */}
          <BackupHistoryTable />
        </>
      )}
    </div>
  );
};

export default SystemHealthPage;
