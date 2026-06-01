import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Button, Typography, Space, Progress } from 'antd';
import { DollarOutlined, ShoppingCartOutlined, BarChartOutlined, FileTextOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { posApi } from '../../api';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { ComingSoon } from '../../components/feedback/ComingSoon';
import { palette } from '../../theme/tokens';

const { RangePicker } = DatePicker;
const { Text } = Typography;

export default function POSReports() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ]);
  const [configId] = useState<string | undefined>();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [productData, setProductData] = useState<any[]>([]);
  const [cashierData, setCashierData] = useState<any[]>([]);

  const fetchReports = async () => {
    if (!dateRange) return;
    
    setLoading(true);
    try {
      const params = {
        date_from: dateRange[0].format('YYYY-MM-DD'),
        date_to: dateRange[1].format('YYYY-MM-DD'),
        config_id: configId,
      };

      const [dashboardRes, productRes, cashierRes] = await Promise.all([
        posApi.reports.dashboard(params),
        posApi.reports.salesByProduct(params),
        posApi.reports.salesByCashier(params),
      ]);

      setDashboardData(dashboardRes.data);
      setProductData(productRes.data.items || []);
      setCashierData(cashierRes.data.items || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const productColumns = [
    {
      title: t('product'),
      dataIndex: 'product_name',
      key: 'product_name',
    },
    {
      title: t('qty_sold'),
      dataIndex: 'qty_sold',
      key: 'qty_sold',
      align: 'center' as const,
    },
    {
      title: t('revenue'),
      dataIndex: 'revenue',
      key: 'revenue',
      align: 'right' as const,
      render: (val: number) => `${val?.toLocaleString()} ${t('iqd')}`,
    },
    {
      title: t('avg_price'),
      dataIndex: 'avg_price',
      key: 'avg_price',
      align: 'right' as const,
      render: (val: number) => `${val?.toLocaleString()} ${t('iqd')}`,
    },
    {
      title: t('share'),
      key: 'share',
      align: 'center' as const,
      render: (_: any, record: any) => {
        const total = productData.reduce((sum, p) => sum + (p.revenue || 0), 0);
        const percent = total > 0 ? Math.round((record.revenue / total) * 100) : 0;
        return <Progress percent={percent} size="small" />;
      },
    },
  ];

  const cashierColumns = [
    {
      title: t('cashier'),
      dataIndex: 'cashier_id',
      key: 'cashier_id',
    },
    {
      title: t('sales'),
      dataIndex: 'sales',
      key: 'sales',
      align: 'right' as const,
      render: (val: number) => `${val?.toLocaleString()} ${t('iqd')}`,
      sorter: (a: any, b: any) => a.sales - b.sales,
    },
    {
      title: t('orders'),
      dataIndex: 'orders',
      key: 'orders',
      align: 'center' as const,
      sorter: (a: any, b: any) => a.orders - b.orders,
    },
    {
      title: t('avg_basket'),
      dataIndex: 'avg_basket',
      key: 'avg_basket',
      align: 'right' as const,
      render: (val: number) => `${val?.toLocaleString()} ${t('iqd')}`,
      sorter: (a: any, b: any) => a.avg_basket - b.avg_basket,
    },
  ];

  const paymentMethodData = dashboardData?.by_payment_method || [];
  const topProducts = dashboardData?.top_products || [];

  return (
    <div>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        {/* Filters */}
        <Card>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
                style={{ width: '100%' }}
                format="YYYY-MM-DD"
              />
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={fetchReports}
                loading={loading}
              >
                {t('refresh')}
              </Button>
            </Col>
            <Col>
              <Button icon={<DownloadOutlined />}>
                {t('export_pdf')}
              </Button>
            </Col>
          </Row>
        </Card>

        {/* KPIs */}
        <Row gutter={16}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={t('total_sales')}
                value={dashboardData?.total_sales || 0}
                precision={2}
                suffix={t('iqd')}
                prefix={<DollarOutlined />}
                styles={{ content: { color: '#3f8600' } }}
              />
              {dashboardData?.compared_to_previous && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {dashboardData.compared_to_previous.sales_change_percent > 0 ? '↗' : '↘'}{' '}
                  {Math.abs(dashboardData.compared_to_previous.sales_change_percent).toFixed(1)}%
                </Text>
              )}
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={t('total_orders')}
                value={dashboardData?.total_orders || 0}
                prefix={<ShoppingCartOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
              {dashboardData?.compared_to_previous && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {dashboardData.compared_to_previous.orders_change_percent > 0 ? '↗' : '↘'}{' '}
                  {Math.abs(dashboardData.compared_to_previous.orders_change_percent).toFixed(1)}%
                </Text>
              )}
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={t('average_basket')}
                value={dashboardData?.average_basket || 0}
                precision={2}
                suffix={t('iqd')}
                prefix={<BarChartOutlined />}
                styles={{ content: { color: '#cf1322' } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={t('total_tax')}
                value={dashboardData?.total_tax || 0}
                precision={2}
                suffix={t('iqd')}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* Charts - 2 columns */}
        <Row gutter={16}>
          {/* Top Products */}
          <Col xs={24} lg={12}>
            <Card title={t('top_products')} bordered={false}>
              {topProducts.length > 0 ? (
                <Space orientation="vertical" style={{ width: '100%' }}>
                  {topProducts.map((p: any, idx: number) => (
                    <div key={idx}>
                      <Row justify="space-between">
                        <Col>
                          <Text strong>{p.name}</Text>
                        </Col>
                        <Col>
                          <Text>{p.revenue?.toLocaleString()} {t('iqd')}</Text>
                        </Col>
                      </Row>
                      <Progress
                        percent={Math.round((p.revenue / topProducts[0]?.revenue) * 100)}
                        showInfo={false}
                        strokeColor={palette.success}
                      />
                    </div>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">{t('no_data')}</Text>
              )}
            </Card>
          </Col>

          {/* Payment Methods */}
          <Col xs={24} lg={12}>
            <Card title={t('sales_by_payment_method')} bordered={false}>
              {paymentMethodData.length > 0 ? (
                <Space orientation="vertical" style={{ width: '100%' }}>
                  {paymentMethodData.map((pm: any, idx: number) => {
                    const total = paymentMethodData.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                    const percent = total > 0 ? Math.round((pm.amount / total) * 100) : 0;
                    return (
                      <div key={idx}>
                        <Row justify="space-between">
                          <Col>
                            <Text>{pm.method}</Text>
                          </Col>
                          <Col>
                            <Text strong>{pm.amount?.toLocaleString()} {t('iqd')}</Text>
                          </Col>
                        </Row>
                        <Progress percent={percent} showInfo={false} />
                      </div>
                    );
                  })}
                </Space>
              ) : (
                <Text type="secondary">{t('no_data')}</Text>
              )}
            </Card>
          </Col>
        </Row>

        {/* Detailed Tables */}
        <Card title={t('sales_by_product')} bordered={false}>
          <ResponsiveTableAdapter
            dataSource={productData}
            columns={productColumns}
            rowKey="product_id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>

        <Card title={t('sales_by_cashier')} bordered={false}>
          <ResponsiveTableAdapter
            dataSource={cashierData}
            columns={cashierColumns}
            rowKey="cashier_id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>

        {/* Hourly Heatmap */}
        <Card title={t('hourly_sales_heatmap')} bordered={false}>
          <ComingSoon featureNameKey="hourly_sales_heatmap" />
        </Card>
      </Space>
    </div>
  );
}
