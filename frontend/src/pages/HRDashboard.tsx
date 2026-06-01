import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { Row, Col } from 'antd';
import { TeamOutlined, FileProtectOutlined, CalendarOutlined, CheckCircleOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { PageHeader, KpiCard, type KpiCardProps } from '../design-system';
import { LoadingSkeleton } from '../design-system/LoadingSkeleton';
import { InlineError } from '../components/feedback/InlineError';
import { useLoadingState } from '../hooks/useLoadingState';

interface HRStats {
  employees_total?: number;
  employees_active?: number;
  active_contracts?: number;
  pending_time_off?: number;
  checked_in_today?: number;
}

export default function HRDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<HRStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { showSkeleton } = useLoadingState(loading);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(false);
    api.get('/api/hr/dashboard')
      .then(res => setStats(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (error) return <InlineError onRetry={fetchData} />;
  if (showSkeleton) return <LoadingSkeleton variant="card" />;

  const cards: { title: string; value: number; icon: ReactNode; tone: KpiCardProps['tone']; go: string }[] = [
    { title: t('employees_total'), value: stats?.employees_total ?? 0, icon: <TeamOutlined />, tone: 'primary', go: '/hr/employees' },
    { title: t('employees_active'), value: stats?.employees_active ?? 0, icon: <UserOutlined />, tone: 'success', go: '/hr/employees?status=active' },
    { title: t('active_contracts'), value: stats?.active_contracts ?? 0, icon: <FileProtectOutlined />, tone: 'info', go: '/hr/contracts' },
    { title: t('pending_time_off'), value: stats?.pending_time_off ?? 0, icon: <CalendarOutlined />, tone: 'warning', go: '/hr/time-off' },
    { title: t('checked_in_today'), value: stats?.checked_in_today ?? 0, icon: <CheckCircleOutlined />, tone: 'success', go: '/hr/attendance' },
  ];

  return (
    <div>
      <PageHeader title={t('hr_dashboard')} />
      <Row gutter={[16, 16]}>
        {cards.map((c, i) => (
          <Col xs={24} sm={12} lg={6} xl={4} key={i}>
            <KpiCard title={c.title} value={c.value} icon={c.icon} tone={c.tone} onClick={() => navigate(c.go)} />
          </Col>
        ))}
      </Row>
    </div>
  );
}
