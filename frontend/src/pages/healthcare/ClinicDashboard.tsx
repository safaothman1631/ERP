import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Button, Space, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CalendarOutlined, UserOutlined, DollarOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader, KpiCard, StatusTag, LoadingSkeleton } from '../../design-system';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { InlineError } from '../../components/feedback/InlineError';
import { useLoadingState } from '../../hooks/useLoadingState';

const { Text } = Typography;

interface AppointmentRow {
  id: string;
  patient_id: string;
  patient_name?: string;
  scheduled_at: string;
  status: string;
  doctor_id?: string;
  reason?: string;
}

interface DashboardData {
  appointments_today: number;
  waiting_patients: number;
  completed_today: number;
  revenue_today: number;
  recent_appointments: AppointmentRow[];
}

const ClinicDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);
  const { showSkeleton } = useLoadingState(loading);

  useEffect(() => {
    void fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      // Fetch appointments
      const appointmentsRes = await api.get('/api/healthcare/appointments', { params: { limit: 100 } });
      const appointments = appointmentsRes.data.items as AppointmentRow[];

      // Fetch patients to resolve names
      const patientsRes = await api.get('/api/healthcare/patients', { params: { limit: 500 } });
      const patients = patientsRes.data.items as Array<{ id: string; name: string }>;
      const patientMap = new Map(patients.map((p) => [p.id, p.name]));

      const today = new Date().toISOString().split('T')[0];
      const appointmentsToday = appointments.filter((a) => a.scheduled_at?.startsWith(today));
      const waiting = appointmentsToday.filter((a) => a.status === 'scheduled');
      const completed = appointmentsToday.filter((a) => a.status === 'completed');

      // Enrich with patient names
      const enriched = appointmentsToday.map((a) => ({
        ...a,
        patient_name: patientMap.get(a.patient_id) || t('healthcare.unknown_patient'),
      }));

      setData({
        appointments_today: appointmentsToday.length,
        waiting_patients: waiting.length,
        completed_today: completed.length,
        revenue_today: 0, // Placeholder
        recent_appointments: enriched.slice(0, 10),
      });
    } catch (error) {
      console.error(error);
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<AppointmentRow> = [
    {
      title: t('healthcare.patient'),
      dataIndex: 'patient_name',
      key: 'patient_name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: t('healthcare.time'),
      dataIndex: 'scheduled_at',
      key: 'scheduled_at',
      render: (time: string) => time?.substring(11, 16) || '—',
    },
    {
      title: t('healthcare.reason'),
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusTag status={status} label={t(`healthcare.status_${status}`)} />,
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: AppointmentRow) => (
        <Button size="small" onClick={() => navigate(`/healthcare/appointments`)}>
          {t('view')}
        </Button>
      ),
    },
  ];

  if (error) return <InlineError onRetry={fetchDashboard} />;
  if (showSkeleton) {
    return <LoadingSkeleton variant="card" />;
  }

  return (
    <div>
      <PageHeader
        title={t('healthcare.clinic_dashboard')}
        subtitle={t('healthcare.dashboard_subtitle')}
        extra={
          <Space>
            <Button type="primary" icon={<CalendarOutlined />} onClick={() => navigate('/healthcare/appointments')}>
              {t('healthcare.new_appointment')}
            </Button>
            <Button icon={<UserOutlined />} onClick={() => navigate('/healthcare/patients')}>
              {t('healthcare.patients')}
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('healthcare.appointments_today')}
            value={data?.appointments_today ?? 0}
            icon={<CalendarOutlined />}
            tone="primary"
            onClick={() => navigate('/healthcare/appointments')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('healthcare.waiting_patients')}
            value={data?.waiting_patients ?? 0}
            icon={<ClockCircleOutlined />}
            tone="warning"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('healthcare.completed_today')}
            value={data?.completed_today ?? 0}
            icon={<CheckCircleOutlined />}
            tone="success"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('healthcare.revenue_today')}
            value={data?.revenue_today ?? 0}
            suffix=" IQD"
            icon={<DollarOutlined />}
            tone="info"
          />
        </Col>
      </Row>

      <Card title={t('healthcare.recent_appointments')} style={{ marginTop: 24 }}>
        <ResponsiveTableAdapter
          dataSource={data?.recent_appointments ?? []}
          columns={columns}
          rowKey="id"
          pagination={false}
          loading={loading}
        />
      </Card>
    </div>
  );
};

export default ClinicDashboard;
