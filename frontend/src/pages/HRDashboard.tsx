import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin } from 'antd';
import { TeamOutlined, FileProtectOutlined, CalendarOutlined, CheckCircleOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';

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

  useEffect(() => {
    api.get('/api/hr/dashboard')
      .then(res => setStats(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin style={{ display: 'block', margin: 80 }} />;

  const cards = [
    { title: t('employees_total'), value: stats?.employees_total ?? 0, icon: <TeamOutlined />, color: '#1677ff', go: '/hr/employees' },
    { title: t('employees_active'), value: stats?.employees_active ?? 0, icon: <UserOutlined />, color: '#16a34a', go: '/hr/employees?status=active' },
    { title: t('active_contracts'), value: stats?.active_contracts ?? 0, icon: <FileProtectOutlined />, color: '#8b5cf6', go: '/hr/contracts' },
    { title: t('pending_time_off'), value: stats?.pending_time_off ?? 0, icon: <CalendarOutlined />, color: '#f59e0b', go: '/hr/time-off' },
    { title: t('checked_in_today'), value: stats?.checked_in_today ?? 0, icon: <CheckCircleOutlined />, color: '#16a34a', go: '/hr/attendance' },
  ];

  return (
    <div style={{ padding: 16 }}>
      <h2>{t('hr_dashboard')}</h2>
      <Row gutter={[16, 16]}>
        {cards.map((c, i) => (
          <Col xs={24} sm={12} lg={6} xl={4} key={i}>
            <Card hoverable onClick={() => navigate(c.go)} style={{ cursor: 'pointer' }}>
              <Statistic title={c.title} value={c.value} prefix={<span style={{ color: c.color }}>{c.icon}</span>} styles={{ content: { color: c.color } }} />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
