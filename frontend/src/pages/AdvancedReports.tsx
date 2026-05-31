import React, { useState } from 'react';
import { Card, Form, DatePicker, Button, Row, Col, Statistic, Tabs, Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../api';
import { message } from '../utils/message';
import ExportButton from '../components/ExportButton';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
const { RangePicker } = DatePicker;

type AnyRow = Record<string, any>;

interface DateRangeValues {
  range: [dayjs.Dayjs, dayjs.Dayjs];
}

const numberFmt = (v: number | undefined) =>
  (typeof v === 'number' ? v : 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const periodCols = [
  { title: 'Month', dataIndex: 'month', key: 'month' },
  { title: 'Inflows', dataIndex: 'inflows', key: 'inflows', render: numberFmt, align: 'right' as const },
  { title: 'Outflows', dataIndex: 'outflows', key: 'outflows', render: numberFmt, align: 'right' as const },
  { title: 'Net', dataIndex: 'net', key: 'net', render: numberFmt, align: 'right' as const },
];

const agingCols = (idField: string, nameField: string) => [
  { title: '#', dataIndex: idField, key: idField },
  { title: 'Party', dataIndex: nameField, key: nameField },
  { title: 'Due Date', dataIndex: 'due_date', key: 'due_date' },
  { title: 'Days Overdue', dataIndex: 'days_overdue', key: 'days_overdue' },
  { title: 'Bucket', dataIndex: 'bucket', key: 'bucket' },
  { title: 'Balance', dataIndex: 'balance_due', key: 'balance_due', render: numberFmt, align: 'right' as const },
];

const customerCols = [
  { title: 'Customer', dataIndex: 'customer', key: 'customer' },
  { title: 'Invoices', dataIndex: 'count', key: 'count', align: 'right' as const },
  { title: 'Total', dataIndex: 'total', key: 'total', render: numberFmt, align: 'right' as const },
  { title: 'Paid', dataIndex: 'paid', key: 'paid', render: numberFmt, align: 'right' as const },
  { title: 'Outstanding', dataIndex: 'outstanding', key: 'outstanding', render: numberFmt, align: 'right' as const },
];

const itemCols = [
  { title: 'Product', dataIndex: 'item', key: 'item' },
  { title: 'Qty', dataIndex: 'quantity', key: 'quantity', render: numberFmt, align: 'right' as const },
  { title: 'Revenue', dataIndex: 'revenue', key: 'revenue', render: numberFmt, align: 'right' as const },
];

interface DateRangeFormProps {
  initial?: { start?: dayjs.Dayjs; end?: dayjs.Dayjs };
  loading?: boolean;
  onSubmit: (start: string, end: string) => void;
}

const DateRangeForm: React.FC<DateRangeFormProps> = ({ initial, loading, onSubmit }) => {
  const { t } = useTranslation();
  return (
    <Form
      layout="inline"
      initialValues={{
        range: [initial?.start ?? dayjs().startOf('month'), initial?.end ?? dayjs()],
      }}
      onFinish={(v: DateRangeValues) => {
        if (!v.range || v.range.length !== 2) return;
        onSubmit(v.range[0].format('YYYY-MM-DD'), v.range[1].format('YYYY-MM-DD'));
      }}
    >
      <Form.Item name="range" rules={[{ required: true }]}>
        <RangePicker />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          {t('generate')}
        </Button>
      </Form.Item>
</Form>
  );
};

const AdvancedReports: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('cash-flow');
  const [loading, setLoading] = useState(false);

  const [cashFlow, setCashFlow] = useState<AnyRow | null>(null);
  const [cashFlowDates, setCashFlowDates] = useState<{ start: string; end: string } | null>(null);

  const [arAging, setArAging] = useState<AnyRow | null>(null);
  const [apAging, setApAging] = useState<AnyRow | null>(null);

  const [salesCustomer, setSalesCustomer] = useState<AnyRow | null>(null);
  const [salesItem, setSalesItem] = useState<AnyRow | null>(null);
  const [salesDates, setSalesDates] = useState<{ start: string; end: string } | null>(null);

  const [taxSummary, setTaxSummary] = useState<AnyRow | null>(null);
  const [taxDates, setTaxDates] = useState<{ start: string; end: string } | null>(null);

  const fetch = async <T,>(url: string, params: Record<string, string>, setter: (v: T) => void) => {
    setLoading(true);
    try {
      const res = await api.get(url, { params });
      setter(res.data as T);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const loadCashFlow = (start: string, end: string) => {
    setCashFlowDates({ start, end });
    fetch('/api/reports/cash-flow', { start_date: start, end_date: end }, setCashFlow);
  };
  const loadArAging = () => fetch('/api/reports/receivable-aging', {}, setArAging);
  const loadApAging = () => fetch('/api/reports/payable-aging', {}, setApAging);
  const loadSales = (start: string, end: string) => {
    setSalesDates({ start, end });
    fetch('/api/reports/sales-by-customer', { start_date: start, end_date: end }, setSalesCustomer);
    fetch('/api/reports/sales-by-item', { start_date: start, end_date: end }, setSalesItem);
  };
  const loadTax = (start: string, end: string) => {
    setTaxDates({ start, end });
    fetch('/api/reports/tax-summary', { start_date: start, end_date: end }, setTaxSummary);
  };

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'cash-flow',
            label: t('cash_flow'),
            children: (
              <Card
                title={t('cash_flow')}
                extra={
                  <ExportButton
                    endpoint="/api/export/cash-flow"
                    filename="cash_flow"
                    params={cashFlowDates ?? undefined}
                    disabled={!cashFlowDates}
                  />
                }
              >
                <DateRangeForm loading={loading} onSubmit={loadCashFlow} />
                {cashFlow ? (
                  <>
                    <Row gutter={16} style={{ marginTop: 24 }}>
                      <Col span={8}><Statistic title={t('inflows')} value={cashFlow.total_inflows} precision={0} suffix="IQD" styles={{ content: { color: '#3f8600' } }} /></Col>
                      <Col span={8}><Statistic title={t('outflows')} value={cashFlow.total_outflows} precision={0} suffix="IQD" styles={{ content: { color: '#cf1322' } }} /></Col>
                      <Col span={8}><Statistic title={t('net_cash_flow')} value={cashFlow.net_cash_flow} precision={0} suffix="IQD" /></Col>
                    </Row>
                    <ResponsiveTableAdapter
                      style={{ marginTop: 16 }}
                      dataSource={cashFlow.periods}
                      columns={periodCols}
                      rowKey="month"
                      pagination={false}
                      size="small"
                    />
                  </>
                ) : <Empty style={{ marginTop: 24 }} />}
              </Card>
            ),
          },
          {
            key: 'aging',
            label: t('aging_report'),
            children: (
              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  <Card
                    title={t('receivable_aging')}
                    extra={
                      <span style={{ display: 'inline-flex', gap: 8 }}>
                        <Button onClick={loadArAging} loading={loading}>{t('generate')}</Button>
                        <ExportButton endpoint="/api/export/aging-receivables" filename="aging_receivables" disabled={!arAging} />
                      </span>
                    }
                  >
                    {arAging ? (
                      <>
                        <Row gutter={8}>
                          {Object.entries(arAging.buckets || {}).map(([k, v]) => (
                            <Col span={8} key={k} style={{ marginBottom: 12 }}>
                              <Statistic title={k} value={v as number} precision={0} suffix="IQD" />
                            </Col>
                          ))}
                        </Row>
                        <ResponsiveTableAdapter
                          dataSource={arAging.details}
                          columns={agingCols('invoice_number', 'contact_name')}
                          rowKey="invoice_id"
                          pagination={{ pageSize: 10 }}
                          size="small"
                          style={{ marginTop: 12 }}
                        />
                      </>
                    ) : <Empty />}
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card
                    title={t('payable_aging')}
                    extra={
                      <span style={{ display: 'inline-flex', gap: 8 }}>
                        <Button onClick={loadApAging} loading={loading}>{t('generate')}</Button>
                        <ExportButton endpoint="/api/export/aging-payables" filename="aging_payables" disabled={!apAging} />
                      </span>
                    }
                  >
                    {apAging ? (
                      <>
                        <Row gutter={8}>
                          {Object.entries(apAging.buckets || {}).map(([k, v]) => (
                            <Col span={8} key={k} style={{ marginBottom: 12 }}>
                              <Statistic title={k} value={v as number} precision={0} suffix="IQD" />
                            </Col>
                          ))}
                        </Row>
                        <ResponsiveTableAdapter
                          dataSource={apAging.details}
                          columns={agingCols('bill_number', 'vendor_name')}
                          rowKey="bill_id"
                          pagination={{ pageSize: 10 }}
                          size="small"
                          style={{ marginTop: 12 }}
                        />
                      </>
                    ) : <Empty />}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'sales-analytics',
            label: t('sales_analytics'),
            children: (
              <Card
                title={t('sales_analytics')}
                extra={
                  <span style={{ display: 'inline-flex', gap: 8 }}>
                    <ExportButton endpoint="/api/export/sales-by-customer" filename="sales_by_customer" params={salesDates ?? undefined} disabled={!salesDates} />
                    <ExportButton endpoint="/api/export/sales-by-item" filename="sales_by_item" params={salesDates ?? undefined} disabled={!salesDates} />
                  </span>
                }
              >
                <DateRangeForm loading={loading} onSubmit={loadSales} />
                <Row gutter={16} style={{ marginTop: 24 }}>
                  <Col xs={24} lg={12}>
                    <h4>{t('top_customers')}</h4>
                    <ResponsiveTableAdapter
                      dataSource={salesCustomer?.customers || []}
                      columns={customerCols}
                      rowKey="customer"
                      pagination={{ pageSize: 10 }}
                      size="small"
                    />
                  </Col>
                  <Col xs={24} lg={12}>
                    <h4>{t('top_products')}</h4>
                    <ResponsiveTableAdapter
                      dataSource={salesItem?.items || []}
                      columns={itemCols}
                      rowKey="item"
                      pagination={{ pageSize: 10 }}
                      size="small"
                    />
                  </Col>
                </Row>
              </Card>
            ),
          },
          {
            key: 'tax-summary',
            label: t('tax_summary'),
            children: (
              <Card
                title={t('tax_summary')}
                extra={
                  <ExportButton
                    endpoint="/api/export/tax-summary"
                    filename="tax_summary"
                    params={taxDates ?? undefined}
                    disabled={!taxDates}
                  />
                }
              >
                <DateRangeForm loading={loading} onSubmit={loadTax} />
                {taxSummary ? (
                  <Row gutter={16} style={{ marginTop: 24 }}>
                    <Col span={8}><Statistic title={t('output_tax')} value={taxSummary.output_tax} precision={2} suffix="IQD" styles={{ content: { color: '#3f8600' } }} /></Col>
                    <Col span={8}><Statistic title={t('input_tax')} value={taxSummary.input_tax} precision={2} suffix="IQD" styles={{ content: { color: '#cf1322' } }} /></Col>
                    <Col span={8}><Statistic title={t('net_tax')} value={taxSummary.net_tax} precision={2} suffix="IQD" /></Col>
                  </Row>
                ) : <Empty style={{ marginTop: 24 }} />}
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default AdvancedReports;
