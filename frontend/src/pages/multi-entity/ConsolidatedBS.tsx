import { useState, useEffect } from 'react';
import { Select, DatePicker, Button, Row, Col, Space, Divider } from 'antd';
import { BankOutlined, AccountBookOutlined, WalletOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { PageHeader, SectionCard, KpiCard } from '../../design-system';
import { space } from '../../theme/tokens';
import api from '../../api';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

interface Company {
  id: string;
  name: string;
}

interface BSRow {
  company_id: string;
  company_name: string;
  assets: number;
  liabilities: number;
  equity: number;
}

interface BSData {
  rows: BSRow[];
  totals: {
    assets: number;
    liabilities: number;
    equity: number;
  };
}

const ConsolidatedBS = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [asOfDate, setAsOfDate] = useState<dayjs.Dayjs | null>(dayjs());
  const [bsData, setBsData] = useState<BSData | null>(null);

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
      const { data } = await api.get('/api/companies/consolidated/bs');
      
      // Filter by selected companies
      const filtered = {
        ...data,
        rows: data.rows.filter((r: BSRow) => selectedCompanies.includes(r.company_id)),
      };
      filtered.totals = {
        assets: filtered.rows.reduce((sum: number, r: BSRow) => sum + r.assets, 0),
        liabilities: filtered.rows.reduce((sum: number, r: BSRow) => sum + r.liabilities, 0),
        equity: filtered.rows.reduce((sum: number, r: BSRow) => sum + r.equity, 0),
      };
      setBsData(filtered);
    } catch (_err) {
      message.error(t('multi_entity.error_generating_bs'));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    message.info(t('multi_entity.export_pdf_stub'));
  };

  const columns: ColumnsType<BSRow> = [
    {
      title: t('multi_entity.company'),
      dataIndex: 'company_name',
      key: 'company_name',
    },
    {
      title: t('multi_entity.assets'),
      dataIndex: 'assets',
      key: 'assets',
      align: 'right',
      render: (val) => val.toLocaleString(),
    },
    {
      title: t('multi_entity.liabilities'),
      dataIndex: 'liabilities',
      key: 'liabilities',
      align: 'right',
      render: (val) => val.toLocaleString(),
    },
    {
      title: t('multi_entity.equity'),
      dataIndex: 'equity',
      key: 'equity',
      align: 'right',
      render: (val) => val.toLocaleString(),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('multi_entity.consolidated_bs')}
        subtitle={t('multi_entity.consolidated_bs_subtitle')}
      />
      <SectionCard>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Row gutter={16}>
            <Col span={10}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12.5, fontWeight: 500, color: 'var(--ink-700)' }}>{t('multi_entity.select_companies')}</label>
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
            <Col span={8}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12.5, fontWeight: 500, color: 'var(--ink-700)' }}>{t('multi_entity.as_of_date')}</label>
              <DatePicker
                style={{ width: '100%' }}
                value={asOfDate}
                onChange={setAsOfDate}
              />
            </Col>
            <Col span={6}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12.5, visibility: 'hidden' }}>.</label>
              <Button type="primary" block onClick={handleGenerate} loading={loading}>
                {t('multi_entity.generate')}
              </Button>
            </Col>
          </Row>
        </Space>
      </SectionCard>

      {bsData && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: space.md, marginBottom: space.lg }}>
            <KpiCard
              title={t('multi_entity.total_assets')}
              value={bsData.totals.assets}
              icon={<BankOutlined />}
              tone="info"
            />
            <KpiCard
              title={t('multi_entity.total_liabilities')}
              value={bsData.totals.liabilities}
              icon={<AccountBookOutlined />}
              tone="danger"
            />
            <KpiCard
              title={t('multi_entity.total_equity')}
              value={bsData.totals.equity}
              icon={<WalletOutlined />}
              tone="success"
            />
          </div>

          <SectionCard
            title={t('multi_entity.breakdown_by_company')}
            padded={false}
            extra={
              <Button onClick={handleExport}>
                {t('multi_entity.export_pdf')}
              </Button>
            }
          >
            <ResponsiveTableAdapter
              columns={columns}
              dataSource={bsData.rows}
              rowKey="company_id"
              pagination={false}
            />
            <Divider />
            <p style={{ textAlign: 'center', color: 'var(--ink-500)', paddingInline: 'var(--space-lg)', paddingBlockEnd: 'var(--space-lg)' }}>
              {t('multi_entity.accounting_equation')}: {t('multi_entity.assets')} ={' '}
              {t('multi_entity.liabilities')} + {t('multi_entity.equity')}
            </p>
          </SectionCard>
        </>
      )}
    </>
  );
};

export default ConsolidatedBS;
