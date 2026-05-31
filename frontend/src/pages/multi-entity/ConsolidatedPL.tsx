import { useState, useEffect } from 'react';
import { Card, Select, DatePicker, Button, Row, Col, Statistic, Space } from 'antd';
import { FileTextOutlined, DollarOutlined, LineChartOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { PageHeader } from '../../design-system';
import api from '../../api';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

interface Company {
  id: string;
  name: string;
}

interface PLRow {
  company_id: string;
  company_name: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface PLData {
  rows: PLRow[];
  totals: {
    revenue: number;
    expenses: number;
    profit: number;
  };
}

const ConsolidatedPL = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<dayjs.Dayjs | null>(dayjs().startOf('month'));
  const [dateTo, setDateTo] = useState<dayjs.Dayjs | null>(dayjs().endOf('month'));
  const [plData, setPlData] = useState<PLData | null>(null);

  const fetchCompanies = async () => {
    try {
      const { data } = await api.get('/api/companies');
      setCompanies(data);
      setSelectedCompanies(data.map((c: Company) => c.id));
    } catch (_err) {
      message.error(t('multi_entity.error_loading_companies'));
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.date_from = dateFrom.format('YYYY-MM-DD');
      if (dateTo) params.date_to = dateTo.format('YYYY-MM-DD');
      const { data } = await api.get('/api/companies/consolidated/pl', { params });
      
      // Filter by selected companies
      const filtered = {
        ...data,
        rows: data.rows.filter((r: PLRow) => selectedCompanies.includes(r.company_id)),
      };
      filtered.totals = {
        revenue: filtered.rows.reduce((sum: number, r: PLRow) => sum + r.revenue, 0),
        expenses: filtered.rows.reduce((sum: number, r: PLRow) => sum + r.expenses, 0),
        profit: filtered.rows.reduce((sum: number, r: PLRow) => sum + r.profit, 0),
      };
      setPlData(filtered);
    } catch (_err) {
      message.error(t('multi_entity.error_generating_pl'));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    message.info(t('multi_entity.export_pdf_stub'));
  };

  const columns: ColumnsType<PLRow> = [
    {
      title: t('multi_entity.company'),
      dataIndex: 'company_name',
      key: 'company_name',
    },
    {
      title: t('multi_entity.revenue'),
      dataIndex: 'revenue',
      key: 'revenue',
      align: 'right',
      render: (val) => val.toLocaleString(),
    },
    {
      title: t('multi_entity.expenses'),
      dataIndex: 'expenses',
      key: 'expenses',
      align: 'right',
      render: (val) => val.toLocaleString(),
    },
    {
      title: t('multi_entity.profit'),
      dataIndex: 'profit',
      key: 'profit',
      align: 'right',
      render: (val) => (
        <span style={{ color: val >= 0 ? 'green' : 'red' }}>
          {val.toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('multi_entity.consolidated_pl')}
        subtitle={t('multi_entity.consolidated_pl_subtitle')}
      />
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Row gutter={16}>
            <Col span={8}>
              <label>{t('multi_entity.select_companies')}</label>
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                value={selectedCompanies}
                onChange={setSelectedCompanies}
                filterOption={(input, option) =>
                  String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                }
              >
                {companies.map((c) => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.name}
                  </Select.Option>
                ))}
              </Select>
            </Col>
            <Col span={6}>
              <label>{t('multi_entity.date_from')}</label>
              <DatePicker
                style={{ width: '100%' }}
                value={dateFrom}
                onChange={setDateFrom}
              />
            </Col>
            <Col span={6}>
              <label>{t('multi_entity.date_to')}</label>
              <DatePicker
                style={{ width: '100%' }}
                value={dateTo}
                onChange={setDateTo}
              />
            </Col>
            <Col span={4}>
              <label style={{ visibility: 'hidden' }}>.</label>
              <Button type="primary" block onClick={handleGenerate} loading={loading}>
                {t('multi_entity.generate')}
              </Button>
            </Col>
          </Row>
        </Space>
      </Card>

      {plData && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title={t('multi_entity.total_revenue')}
                  value={plData.totals.revenue}
                  precision={0}
                  prefix={<LineChartOutlined />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title={t('multi_entity.total_expenses')}
                  value={plData.totals.expenses}
                  precision={0}
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title={t('multi_entity.total_profit')}
                  value={plData.totals.profit}
                  precision={0}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: plData.totals.profit >= 0 ? '#3f8600' : '#cf1322' }}
                />
              </Card>
            </Col>
          </Row>

          <Card
            title={t('multi_entity.breakdown_by_company')}
            extra={
              <Button onClick={handleExport}>
                {t('multi_entity.export_pdf')}
              </Button>
            }
          >
            <ResponsiveTableAdapter
              columns={columns}
              dataSource={plData.rows}
              rowKey="company_id"
              pagination={false}
            />
          </Card>
        </>
      )}
    </>
  );
};

export default ConsolidatedPL;
