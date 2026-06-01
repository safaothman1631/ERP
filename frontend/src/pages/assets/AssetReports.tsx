import React, { useEffect, useState } from 'react';
import { Row, Col, Spin } from 'antd';
import { DollarOutlined, FallOutlined, RiseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import api from '../../api';
import { PageHeader, KpiCard, SectionCard } from '../../design-system';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';

interface Summary {
  total_cost: number;
  total_accumulated_depreciation: number;
  net_book_value: number;
  by_category: CategorySummary[];
}

interface CategorySummary {
  category_id: string;
  category_name: string;
  count: number;
  cost: number;
  accumulated: number;
  nbv: number;
}

// Categorical data-viz palette — kit tokens that auto-flip for dark mode.
const COLORS = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-4)', 'var(--viz-5)', 'var(--viz-6)', 'var(--viz-7)'];

const AssetReports: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/fixed-assets/assets/reports/summary');
      setSummary(r.data);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loading) return <Spin />;
  if (!summary) return null;

  const categoryColumns = [
    { title: t('assets.category'), dataIndex: 'category_name', key: 'name' },
    { title: t('assets.count'), dataIndex: 'count', key: 'count' },
    { title: t('assets.total_cost'), dataIndex: 'cost', key: 'cost', render: (v: number) => v.toLocaleString() },
    { title: t('assets.accumulated'), dataIndex: 'accumulated', key: 'acc', render: (v: number) => v.toLocaleString() },
    { title: t('assets.nbv'), dataIndex: 'nbv', key: 'nbv', render: (v: number) => v.toLocaleString() },
  ];

  const pieData = summary.by_category.map((c) => ({
    name: c.category_name,
    value: c.nbv,
  }));

  return (
    <>
      <PageHeader title={t('assets.reports')} />
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <KpiCard title={t('assets.total_cost')} value={summary.total_cost} icon={<DollarOutlined />} tone="primary" />
        </Col>
        <Col span={8}>
          <KpiCard title={t('assets.accumulated_depreciation')} value={summary.total_accumulated_depreciation} icon={<FallOutlined />} tone="danger" />
        </Col>
        <Col span={8}>
          <KpiCard title={t('assets.net_book_value')} value={summary.net_book_value} icon={<RiseOutlined />} tone="success" />
        </Col>
      </Row>

      <SectionCard title={t('assets.by_category')} style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <ResponsiveChart legendItems={[]} minMobileBlockSize={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveChart>
          </Col>
          <Col span={12}>
            <ResponsiveTableAdapter columns={categoryColumns} dataSource={summary.by_category} rowKey="category_id" pagination={false} />
          </Col>
        </Row>
      </SectionCard>
    </>
  );
};

export default AssetReports;
