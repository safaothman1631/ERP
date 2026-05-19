import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, DatePicker, Space, Tag, Typography, Divider } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function IraqLocalization() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<any[]>([]);
  const [whRules, setWhRules] = useState<any[]>([]);
  const [currency, setCurrency] = useState<any>(null);
  const [vatReport, setVatReport] = useState<any>(null);
  const [whSummary, setWhSummary] = useState<any>(null);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs().endOf('month')]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, r, cur] = await Promise.all([
          api.get('/api/l10n/iq/tax-categories'),
          api.get('/api/l10n/iq/withholding-rules'),
          api.get('/api/l10n/iq/currency-info'),
        ]);
        setCategories(c.data);
        setWhRules(r.data);
        setCurrency(cur.data);
      } catch { message.error(t('error')); }
    })();
  }, [t]);

  const runSetup = async () => {
    setBusy(true);
    try {
      const res = await api.post('/api/l10n/iq/setup');
      message.success(`${t('saved')} (+${res.data.taxes_created} taxes)`);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || t('error'));
    }
    setBusy(false);
  };

  const loadReports = async () => {
    const params = {
      period_from: range[0].format('YYYY-MM-DD'),
      period_to: range[1].format('YYYY-MM-DD'),
    };
    try {
      const [v, w] = await Promise.all([
        api.get('/api/l10n/iq/vat-return', { params }),
        api.get('/api/l10n/iq/withholding-summary', { params }),
      ]);
      setVatReport(v.data);
      setWhSummary(w.data);
    } catch { message.error(t('error')); }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>🇮🇶 Iraq Localization — ناوچەگەریکردنی عێراق</Title>

      <Card title="Quick Setup" style={{ marginTop: 16 }} extra={
        <Button type="primary" icon={<CheckCircleOutlined />} onClick={runSetup} loading={busy}>
          Apply Iraq Defaults
        </Button>
      }>
        {currency && (
          <Row gutter={16}>
            <Col span={6}><Statistic title="Base Currency" value={currency.base} /></Col>
            <Col span={6}><Statistic title="Symbol" value={currency.symbol} /></Col>
            <Col span={6}><Statistic title="Decimals" value={currency.decimals} /></Col>
            <Col span={6}><Statistic title="Format" value={currency.format} /></Col>
          </Row>
        )}
      </Card>

      <Card title="Tax Categories" style={{ marginTop: 16 }}>
        <ResponsiveTableAdapter
          dataSource={categories}
          rowKey="code"
          pagination={false}
          size="small"
          columns={[
            { title: 'Code', dataIndex: 'code', render: (v) => <Tag color="blue">{v}</Tag> },
            { title: 'Name (EN)', dataIndex: 'name' },
            { title: 'ناو (کوردی)', dataIndex: 'name_ku' },
            { title: 'Default Rate %', dataIndex: 'default_rate' },
          ]}
        />
      </Card>

      <Card title="Withholding Tax Rules" style={{ marginTop: 16 }}>
        <ResponsiveTableAdapter
          dataSource={whRules}
          rowKey="applies_to"
          pagination={false}
          size="small"
          columns={[
            { title: 'Applies To', dataIndex: 'applies_to' },
            { title: 'Rate %', dataIndex: 'rate', render: (v) => <Tag color="orange">{v}%</Tag> },
            { title: 'Description', dataIndex: 'description' },
          ]}
        />
      </Card>

      <Card title="Compliance Reports" style={{ marginTop: 16 }} extra={
        <Space>
          <RangePicker value={range} onChange={(v) => v && setRange(v as any)} />
          <Button type="primary" onClick={loadReports}>Generate</Button>
        </Space>
      }>
        {vatReport && (
          <>
            <Divider titlePlacement="start">VAT Return</Divider>
            <Row gutter={16}>
              <Col span={6}><Statistic title="Taxable Sales" value={vatReport.taxable_sales} /></Col>
              <Col span={6}><Statistic title="Output VAT" value={vatReport.output_vat} styles={{ content: { color: '#3f8600' } }} /></Col>
              <Col span={6}><Statistic title="Input VAT" value={vatReport.input_vat} styles={{ content: { color: '#cf1322' } }} /></Col>
              <Col span={6}><Statistic title="Net Payable" value={vatReport.net_vat_payable} /></Col>
            </Row>
          </>
        )}
        {whSummary && (
          <>
            <Divider titlePlacement="start">Withholding Tax Summary</Divider>
            <Row gutter={16}>
              <Col span={8}><Statistic title="Total Withheld" value={whSummary.total_withheld} /></Col>
              <Col span={8}><Statistic title="Transactions" value={whSummary.rows_count} /></Col>
              <Col span={8}><Statistic title="Vendors" value={whSummary.by_vendor?.length || 0} /></Col>
            </Row>
          </>
        )}
      </Card>
    </div>
  );
}
