import { Button, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../../api';
import GlassCard from '../components/GlassCard';
import KpiStat from '../components/KpiStat';
import PlatformPageHeader from '../components/PlatformPageHeader';
import styles from '../theme/PlatformGlass.module.css';

interface Stats {
  organizations: { active: number; suspended: number; total: number };
  users: { active: number; locked: number };
  pending_module_requests: number;
  expiring_licenses_30d: number;
}

export default function PlatformDashboard() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'stats'],
    queryFn: async () => (await api.get<Stats>('/api/platform/stats')).data,
  });

  return (
    <>
      <PlatformPageHeader
        title={t('platform.dashboard.title', 'Platform Dashboard')}
        subtitle={t('platform.dashboard.subtitle', 'Overview of tenants and operations')}
        actions={(
          <Space>
            <Link to="/platform/orgs"><Button>{t('platform.nav.orgs', 'Organizations')}</Button></Link>
            <Link to="/platform/requests"><Button type="primary">{t('platform.nav.requests', 'Module requests')}</Button></Link>
          </Space>
        )}
      />
      {isLoading ? (
        <GlassCard>{t('loading', 'Loading…')}</GlassCard>
      ) : (
        <>
          <div className={styles.kpiGrid}>
            <KpiStat label={t('platform.kpi.active_orgs', 'Active orgs')} value={data?.organizations.active ?? 0} />
            <KpiStat label={t('platform.kpi.suspended_orgs', 'Suspended')} value={data?.organizations.suspended ?? 0} />
            <KpiStat label={t('platform.kpi.active_users', 'Active users')} value={data?.users.active ?? 0} />
            <KpiStat label={t('platform.kpi.pending_requests', 'Pending requests')} value={data?.pending_module_requests ?? 0} />
            <KpiStat label={t('platform.kpi.expiring_licenses', 'Expiring (30d)')} value={data?.expiring_licenses_30d ?? 0} />
            <KpiStat label={t('platform.kpi.locked_users', 'Locked users')} value={data?.users.locked ?? 0} />
          </div>
          <GlassCard>
            <h3>{t('platform.dashboard.quick_actions', 'Quick actions')}</h3>
            <Space wrap style={{ marginTop: 12 }}>
              <Link to="/platform/orgs"><Button>{t('platform.create_org', 'Create organization')}</Button></Link>
              <Link to="/platform/users"><Button>{t('platform.nav.users', 'Users')}</Button></Link>
              <Link to="/platform/audit"><Button>{t('platform.nav.audit', 'Audit log')}</Button></Link>
            </Space>
          </GlassCard>
        </>
      )}
    </>
  );
}
