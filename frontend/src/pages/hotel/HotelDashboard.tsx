import React, { useEffect, useState, useCallback } from 'react';
import { Row, Col, Card, Button, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, BankOutlined, LoginOutlined, LogoutOutlined, DollarOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { TooltipProps } from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, KpiCard, LoadingSkeleton } from '../../design-system';
import { InlineError } from '../../components/feedback/InlineError';
import { useLoadingState } from '../../hooks/useLoadingState';
import { space, radius } from '../../theme/tokens';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';
import { asTranslationKey } from '../../i18n/types';

const { Text } = Typography;

interface DashboardData {
  total_rooms: number;
  occupied_rooms: number;
  occupancy_rate: number;
  today_checkins: number;
  today_checkouts: number;
  revenue_today: number;
  daily_occupancy: Array<{ date: string; occupancy: number }>;
}

const HotelDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { showSkeleton } = useLoadingState(loading);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [roomsRes, reservationsRes] = await Promise.all([
        api.get('/api/hotel/rooms'),
        api.get('/api/hotel/reservations'),
      ]);
      const rooms = roomsRes.data.items || [];
      const reservations = reservationsRes.data.items || [];
      
      const totalRooms = rooms.length;
      const occupiedRooms = rooms.filter((r: any) => r.status === 'occupied').length;
      const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
      
      const today = new Date().toISOString().substring(0, 10);
      const todayCheckins = reservations.filter((r: any) => r.check_in_date === today).length;
      const todayCheckouts = reservations.filter((r: any) => r.check_out_date === today).length;
      
      const revenueToday = reservations
        .filter((r: any) => r.check_in_date === today)
        .reduce((sum: number, r: any) => sum + (r.rate || 0), 0);
      
      // Generate daily occupancy for last 7 days
      const dailyOccupancy = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().substring(0, 10);
        const dayOccupied = rooms.filter((r: any) => {
          const res = reservations.find((rv: any) => 
            rv.room_id === r.id && 
            rv.check_in_date <= dateStr && 
            rv.check_out_date >= dateStr &&
            rv.status === 'checked_in'
          );
          return res !== undefined;
        }).length;
        const dayRate = totalRooms > 0 ? (dayOccupied / totalRooms) * 100 : 0;
        dailyOccupancy.push({ date: dateStr, occupancy: Math.round(dayRate) });
      }
      
      setData({
        total_rooms: totalRooms,
        occupied_rooms: occupiedRooms,
        occupancy_rate: occupancyRate,
        today_checkins: todayCheckins,
        today_checkouts: todayCheckouts,
        revenue_today: revenueToday,
        daily_occupancy: dailyOccupancy,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  if (error) return <InlineError onRetry={fetchDashboard} />;
  if (showSkeleton || !data) return <LoadingSkeleton variant="card" />;

  const occupancyPct = data.occupancy_rate || 0;
  const fmtIQD = (v: number) => new Intl.NumberFormat('en-US').format(v || 0);

  const CustomTooltip = (props: TooltipProps<number, string>) => {
    const { active, payload } = props as any;
    if (!active || !payload || !payload.length) return null;
    const pl = payload[0];
    return (
      <Card size="small" style={{ border: '1px solid var(--border)' }}>
        <Text strong>{pl.payload.date}</Text>
        <br />
        <Text>{t('hotel.occupancy')}: {pl.value}%</Text>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader
        title={t('hotel.dashboard')}
        subtitle={t('hotel.dashboard_subtitle')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/hotel/rooms')}>
            {t('hotel.new_reservation')}
          </Button>
        }
      />

      <Row gutter={[space.md, space.md]}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('hotel.occupancy_rate')}
            value={occupancyPct.toFixed(1)}
            suffix="%"
            icon={<BankOutlined />}
            tone="primary"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('hotel.today_checkins')}
            value={data.today_checkins.toString()}
            icon={<LoginOutlined />}
            tone="success"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('hotel.today_checkouts')}
            value={data.today_checkouts.toString()}
            icon={<LogoutOutlined />}
            tone="warning"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('hotel.revenue_today')}
            value={fmtIQD(data.revenue_today)}
            suffix=" IQD"
            icon={<DollarOutlined />}
            tone="success"
          />
        </Col>
      </Row>

      <Card
        title={t('hotel.daily_occupancy_trend')}
        style={{ marginTop: space.lg, borderRadius: radius.lg }}
      >
        {data.daily_occupancy && data.daily_occupancy.length > 0 ? (
          <ResponsiveChart
            legendItems={[
              { id: 'occupancy', labelKey: asTranslationKey('hotel.occupancy'), color: 'var(--accent-500)' },
            ]}
          >
            <LineChart data={data.daily_occupancy}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="occupancy"
                stroke="var(--accent-500)"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveChart>
        ) : (
          <Text type="secondary">{t('no_data')}</Text>
        )}
      </Card>
    </div>
  );
};

export default HotelDashboard;
