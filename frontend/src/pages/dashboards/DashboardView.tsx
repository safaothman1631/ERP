import React, { useEffect, useState } from 'react';
import { Card, Button, DatePicker, Space, Statistic, Typography, message } from 'antd';
import { ReloadOutlined, EditOutlined, DollarOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import api from '../../api';
import { PageHeader, LoadingSkeleton } from '../../design-system';
import dayjs, { Dayjs } from 'dayjs';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
// react-grid-layout uses CommonJS namespace export — import as default and destructure
import RGL from 'react-grid-layout';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';
import { InlineError } from '../../components/feedback/InlineError';
import { useLoadingState } from '../../hooks/useLoadingState';
const { Responsive, WidthProvider } = RGL as any;
type Layout = { i: string; x: number; y: number; w: number; h: number };

const { RangePicker } = DatePicker;
const { Text, Title: _Title } = Typography;
const ResponsiveGridLayout = WidthProvider(Responsive);

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const DashboardView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [widgetData, setWidgetData] = useState<Record<string, any>>({});
  const { showSkeleton } = useLoadingState(loading);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()]);

  useEffect(() => {
    if (id) {
      fetchDashboard();
    }
  }, [id]);

  useEffect(() => {
    if (dashboard?.widgets) {
      refreshAllWidgets();
    }
  }, [dashboard, dateRange]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/dashboards/${id}`);
      setDashboard(res.data.data);
    } catch (_err) {
      message.error(t('load_error'));
    } finally {
      setLoading(false);
    }
  };

  const refreshAllWidgets = async () => {
    if (!dashboard?.widgets) return;
    for (const widget of dashboard.widgets) {
      fetchWidgetData(widget.id);
    }
  };

  const fetchWidgetData = async (widgetId: string) => {
    try {
      const params = new URLSearchParams({
        widget_id: widgetId,
        date_from: dateRange[0].format('YYYY-MM-DD'),
        date_to: dateRange[1].format('YYYY-MM-DD')
      });
      const res = await api.get(`/api/dashboards/${id}/data?${params}`);
      setWidgetData((prev) => ({ ...prev, [widgetId]: res.data.data }));
    } catch (err) {
      console.error(`Widget ${widgetId} load error:`, err);
    }
  };

  const _formatNumber = (val: number | undefined, unit?: string) => {
    if (val === undefined || val === null) return '-';
    const formatted = new Intl.NumberFormat('en-US').format(val);
    return unit ? `${formatted} ${unit}` : formatted;
  };

  const renderWidget = (widget: any) => {
    const data = widgetData[widget.id];
    const config = widget.config || {};
    const value = data?.value;

    if (widget.type === 'kpi') {
      return (
        <Card style={{ height: '100%' }}>
          <Statistic
            title={widget.title}
            value={value}
            prefix={config.icon ? <DollarOutlined /> : undefined}
            suffix={config.unit}
            valueStyle={{ color: config.color || '#3f8600' }}
          />
        </Card>
      );
    }

    if (widget.type === 'bar') {
      const items = data?.raw?.data?.items || [];
      const chartData = items.map((item: any) => ({
        name: item.name,
        value: item.total || item.quantity || 0
      }));
      return (
        <Card title={widget.title} style={{ height: '100%' }}>
          <ResponsiveChart legendItems={[]} minMobileBlockSize={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill={config.color || '#8884d8'} />
            </BarChart>
          </ResponsiveChart>
        </Card>
      );
    }

    if (widget.type === 'line') {
      const items = data?.raw?.data?.items || [];
      return (
        <Card title={widget.title} style={{ height: '100%' }}>
          <ResponsiveChart legendItems={[]} minMobileBlockSize={250}>
            <LineChart data={items}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke={config.color || '#8884d8'} />
            </LineChart>
          </ResponsiveChart>
        </Card>
      );
    }

    if (widget.type === 'pie') {
      const items = data?.raw?.data?.items || [];
      return (
        <Card title={widget.title} style={{ height: '100%' }}>
          <ResponsiveChart legendItems={[]} minMobileBlockSize={250}>
            <PieChart>
              <Pie data={items} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {items.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveChart>
        </Card>
      );
    }

    if (widget.type === 'table') {
      const items = data?.raw?.data?.items || [];
      const columns = items.length > 0 ? Object.keys(items[0]).map((key) => ({
        title: key,
        dataIndex: key,
        key
      })) : [];
      return (
        <Card title={widget.title} style={{ height: '100%' }}>
          <ResponsiveTableAdapter dataSource={items} columns={columns} pagination={false} size="small" scroll={{ y: 200 }} />
        </Card>
      );
    }

    if (widget.type === 'progress') {
      return (
        <Card title={widget.title} style={{ height: '100%' }}>
          <Text>Progress: {value}%</Text>
        </Card>
      );
    }

    if (widget.type === 'iframe') {
      return (
        <Card title={widget.title} style={{ height: '100%' }}>
          <iframe src={config.url} style={{ width: '100%', height: 300, border: 0 }} />
        </Card>
      );
    }

    return <Card title={widget.title}>Unknown widget type</Card>;
  };

  const layouts: Layout[] = dashboard?.widgets?.map((w: any) => ({
    i: w.id,
    x: w.layout.x,
    y: w.layout.y,
    w: w.layout.w,
    h: w.layout.h,
    static: true
  })) || [];

  if (showSkeleton) return <LoadingSkeleton variant="card" />;

  if (!dashboard) return <InlineError messageKey="error_loading_dashboard" onRetry={() => window.location.reload()} />;

  return (
    <div>
      <PageHeader
        title={dashboard.name}
        subtitle={t('dashboard_view')}
        extra={
          <Space>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])}
              format="YYYY-MM-DD"
            />
            <Button icon={<ReloadOutlined />} onClick={refreshAllWidgets}>
              {t('refresh')}
            </Button>
            <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/dashboards/${id}/edit`)}>
              {t('edit')}
            </Button>
          </Space>
        }
      />

      <div style={{ marginTop: 24 }}>
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layouts }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={100}
          isDraggable={false}
          isResizable={false}
        >
          {dashboard.widgets?.map((widget: any) => (
            <div key={widget.id}>
              {renderWidget(widget)}
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
};

export default DashboardView;
