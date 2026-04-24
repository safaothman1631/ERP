import React, { useEffect, useState } from 'react';
import { Card, Form, DatePicker, Button, Space, Table, Statistic, Row, Col, Divider, Select} from 'antd';
import { message } from '../utils/message';
import { FilePdfOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { PageHeader } from '../design-system';

const Reports: React.FC = () => {
  const { t } = useTranslation();
  const [reportType, setReportType] = useState<string>('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<{label: string; value: string}[]>([]);
  const [reportDates, setReportDates] = useState<{start?: string; end?: string; as_of?: string}>({});

  useEffect(() => {
    api.get('/api/accounts').then(r => {
      setAccounts((r.data.items || []).map((a: {id: string; code: string; name: string}) => ({ label: `${a.code} - ${a.name}`, value: a.id })));
    }).catch(() => {});
  }, []);

  const fetchProfitLoss = async (values: any) => {
    setLoading(true);
    try {
      const res = await api.get('/api/reports/profit-loss', {
        params: { start_date: values.start.format('YYYY-MM-DD'), end_date: values.end.format('YYYY-MM-DD') },
      });
      setData(res.data); setReportType('pl');
      setReportDates({ start: values.start.format('YYYY-MM-DD'), end: values.end.format('YYYY-MM-DD') });
    } catch { message.error(t('error')); } finally { setLoading(false); }
  };

  const fetchBalanceSheet = async (values: any) => {
    setLoading(true);
    try {
      const res = await api.get('/api/reports/balance-sheet', { params: { as_of_date: values.date.format('YYYY-MM-DD') } });
      setData(res.data); setReportType('bs');
      setReportDates({ as_of: values.date.format('YYYY-MM-DD') });
    } catch { message.error(t('error')); } finally { setLoading(false); }
  };

  const fetchTrialBalance = async (values: any) => {
    setLoading(true);
    try {
      const res = await api.get('/api/reports/trial-balance', {
        params: { start_date: '2000-01-01', end_date: values.date.format('YYYY-MM-DD') },
      });
      setData(res.data); setReportType('tb');
      setReportDates({ as_of: values.date.format('YYYY-MM-DD') });
    } catch { message.error(t('error')); } finally { setLoading(false); }
  };

  const fetchAccountTransactions = async (values: {account_id: string; start: dayjs.Dayjs; end: dayjs.Dayjs}) => {
    setLoading(true);
    try {
      const res = await api.get('/api/reports/account-transactions', {
        params: { account_id: values.account_id, start_date: values.start.format('YYYY-MM-DD'), end_date: values.end.format('YYYY-MM-DD') },
      });
      setData(res.data); setReportType('at');
      setReportDates({ start: values.start.format('YYYY-MM-DD'), end: values.end.format('YYYY-MM-DD') });
    } catch { message.error(t('error')); } finally { setLoading(false); }
  };

  const exportReport = async (format: 'pdf' | 'excel') => {
    const typeMap: Record<string, string> = { pl: 'profit-loss', bs: 'balance-sheet', tb: 'trial-balance', at: 'account-transactions' };
    const rType = typeMap[reportType];
    if (!rType) return;
    try {
      const params: Record<string, string | undefined> = {};
      if (reportType === 'pl' || reportType === 'at') {
        params.start_date = reportDates.start;
        params.end_date = reportDates.end;
      }
      if (reportType === 'bs' || reportType === 'tb') {
        params.as_of = reportDates.as_of;
      }
      const res = await api.get(`/api/reports/${rType}/${format}`, { responseType: 'blob', params });
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url; link.download = `${rType}.${ext}`; link.click();
      window.URL.revokeObjectURL(url);
    } catch { message.error(t('error')); }
  };

  const accountCols = [
    { title: t('account'), dataIndex: 'account_code', key: 'account_code' },
    { title: t('name'), dataIndex: 'account_name', key: 'account_name' },
    { title: t('amount'), dataIndex: 'amount', key: 'amount', render: (v: number) => v?.toLocaleString() },
  ];

  const tbCols = [
    { title: t('account'), dataIndex: 'account_code', key: 'account_code' },
    { title: t('name'), dataIndex: 'account_name', key: 'account_name' },
    { title: t('debit'), dataIndex: 'debit', key: 'debit', render: (v: number) => v?.toLocaleString() },
    { title: t('credit'), dataIndex: 'credit', key: 'credit', render: (v: number) => v?.toLocaleString() },
  ];

  return (
    <div>
      <PageHeader title={t('reports')} subtitle={t('reports_subtitle', 'راپۆرتە داراییەکان')} helpKey="reports" />
      <Row gutter={16}>
        {/* Profit & Loss */}
        <Col xs={24} md={8}>
          <Card title={t('profit_loss')} size="small">
            <Form onFinish={fetchProfitLoss} layout="vertical"
              initialValues={{ start: dayjs().startOf('year'), end: dayjs() }}>
              <Form.Item label={t('from_date')} name="start"><DatePicker style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('to_date')} name="end"><DatePicker style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>{t('generate')}</Button>
            </Form>
          </Card>
        </Col>

        {/* Balance Sheet */}
        <Col xs={24} md={8}>
          <Card title={t('balance_sheet')} size="small">
            <Form onFinish={fetchBalanceSheet} layout="vertical" initialValues={{ date: dayjs() }}>
              <Form.Item label={t('date')} name="date"><DatePicker style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>{t('generate')}</Button>
            </Form>
          </Card>
        </Col>

        {/* Trial Balance */}
        <Col xs={24} md={8}>
          <Card title={t('trial_balance')} size="small">
            <Form onFinish={fetchTrialBalance} layout="vertical" initialValues={{ date: dayjs() }}>
              <Form.Item label={t('date')} name="date"><DatePicker style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>{t('generate')}</Button>
            </Form>
          </Card>
        </Col>

        {/* Account Transactions */}
        <Col xs={24} md={8} style={{ marginTop: 16 }}>
          <Card title={t('account_transactions') || 'مامەڵەکانی هەژمار'} size="small">
            <Form onFinish={fetchAccountTransactions} layout="vertical">
              <Form.Item label={t('account')} name="account_id" rules={[{ required: true }]}>
                <Select options={accounts} showSearch optionFilterProp="label" placeholder={t('select')} />
              </Form.Item>
              <Form.Item label={t('from_date')} name="start" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('to_date')} name="end" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>{t('generate')}</Button>
            </Form>
          </Card>
        </Col>
      </Row>

      {/* Report Results */}
      {reportType === 'pl' && data && (
        <Card style={{ marginTop: 24 }} title={t('profit_loss')} extra={<Space><Button icon={<FilePdfOutlined />} size="small" onClick={() => exportReport('pdf')}>PDF</Button><Button icon={<FileExcelOutlined />} size="small" onClick={() => exportReport('excel')}>Excel</Button></Space>}>
          <Row gutter={16}>
            <Col span={8}><Statistic title={t('income')} value={data.total_revenue} precision={0} suffix="IQD" styles={{ content: { color: '#3f8600' } }} /></Col>
            <Col span={8}><Statistic title={t('expenses')} value={data.total_expenses} precision={0} suffix="IQD" styles={{ content: { color: '#cf1322' } }} /></Col>
            <Col span={8}><Statistic title={t('net_profit')} value={data.net_profit} precision={0} suffix="IQD" styles={{ content: { color: data.net_profit >= 0 ? '#3f8600' : '#cf1322' } }} /></Col>
          </Row>
          <Divider>{t('income')}</Divider>
          <Table dataSource={data.revenue || []} columns={accountCols} rowKey="account_id" pagination={false} size="small" />
          <Divider>{t('expenses')}</Divider>
          <Table dataSource={data.expenses || []} columns={accountCols} rowKey="account_id" pagination={false} size="small" />
        </Card>
      )}

      {reportType === 'bs' && data && (
        <Card style={{ marginTop: 24 }} title={t('balance_sheet')} extra={<Space><Button icon={<FilePdfOutlined />} size="small" onClick={() => exportReport('pdf')}>PDF</Button><Button icon={<FileExcelOutlined />} size="small" onClick={() => exportReport('excel')}>Excel</Button></Space>}>
          <Row gutter={16}>
            <Col span={8}><Statistic title="Assets" value={data.total_assets} precision={0} suffix="IQD" /></Col>
            <Col span={8}><Statistic title="Liabilities" value={data.total_liabilities} precision={0} suffix="IQD" /></Col>
            <Col span={8}><Statistic title="Equity" value={data.total_equity} precision={0} suffix="IQD" /></Col>
          </Row>
        </Card>
      )}

      {reportType === 'tb' && data && (
        <Card style={{ marginTop: 24 }} title={t('trial_balance')} extra={<Space><Button icon={<FilePdfOutlined />} size="small" onClick={() => exportReport('pdf')}>PDF</Button><Button icon={<FileExcelOutlined />} size="small" onClick={() => exportReport('excel')}>Excel</Button></Space>}>
          <Table dataSource={data.accounts || []} columns={tbCols} rowKey="account_id" pagination={false} size="small" />
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}><Statistic title={t('debit')} value={data.total_debit} precision={0} suffix="IQD" /></Col>
            <Col span={12}><Statistic title={t('credit')} value={data.total_credit} precision={0} suffix="IQD" /></Col>
          </Row>
        </Card>
      )}

      {reportType === 'at' && data && (
        <Card style={{ marginTop: 24 }} title={t('account_transactions') || 'مامەڵەکانی هەژمار'} extra={<Space><Button icon={<FilePdfOutlined />} size="small" onClick={() => exportReport('pdf')}>PDF</Button><Button icon={<FileExcelOutlined />} size="small" onClick={() => exportReport('excel')}>Excel</Button></Space>}>
          <Table
            dataSource={data.transactions || []}
            columns={[
              { title: t('date'), dataIndex: 'date', key: 'date' },
              { title: '#', dataIndex: 'entry_number', key: 'entry_number' },
              { title: t('description'), dataIndex: 'description', key: 'description' },
              { title: t('debit'), dataIndex: 'debit', key: 'debit', render: (v: number) => v > 0 ? v.toLocaleString() : '-' },
              { title: t('credit'), dataIndex: 'credit', key: 'credit', render: (v: number) => v > 0 ? v.toLocaleString() : '-' },
              { title: t('running_balance') || 'باڵانس', dataIndex: 'running_balance', key: 'running_balance', render: (v: number) => v?.toLocaleString() },
            ]}
            rowKey={(_, i) => String(i)}
            pagination={false}
            size="small"
            summary={() => (
              <Table.Summary>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3}><strong>{t('closing_balance') || 'کۆتایی'}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={3}><strong>{data.closing_balance?.toLocaleString()}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} colSpan={2} />
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default Reports;
