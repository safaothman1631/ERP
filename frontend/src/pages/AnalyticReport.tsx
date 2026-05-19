import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Select, Space } from 'antd';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader } from '../design-system';
import dayjs from 'dayjs';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';

const { RangePicker } = DatePicker;
const { Option } = Select;

const AnalyticReport: React.FC = () => {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/api/analytic/accounts').then(r => setAccounts(Array.isArray(r.data) ? r.data : [])).catch(() => message.error(t('error')));
  }, []);

  const fetchSummary = async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const params: any = {};
      if (dateRange) {
        params.date_from = dateRange[0].format('YYYY-MM-DD');
        params.date_to = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await api.get(`/api/analytic/summary/${selectedAccount}`, { params });
      setSummary(res.data);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSummary();
  }, [selectedAccount, dateRange]);

  const columns = [
    { title: t('date'), dataIndex: 'date', key: 'date' },
    { title: t('description'), dataIndex: 'description', key: 'description' },
    { title: t('amount'), dataIndex: 'amount', key: 'amount', render: (v: number) => (v || 0).toLocaleString() },
    { title: t('reference'), dataIndex: 'ref_doc', key: 'ref_doc' },
  ];

  return (
    <div>
      <PageHeader
        title={t('analytic_report')}
        subtitle={t('analytic_report_subtitle', 'Analytic report')}
        helpKey="analytic"
      />
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space>
            <Select
              placeholder={t('select_account')}
              style={{ width: 300 }}
              onChange={(v) => setSelectedAccount(v)}
              showSearch
              optionFilterProp="children"
            >
              {accounts.map(acc => (
                <Option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</Option>
              ))}
            </Select>
            <RangePicker onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)} />
          </Space>
        </Card>

        {summary && (
          <>
            <Row gutter={16}>
              <Col span={8}>
                <Card>
                  <Statistic title={t('total_amount')} value={summary.total_amount} precision={2} />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic title={t('line_count')} value={summary.line_count} />
                </Card>
              </Col>
            </Row>

            <Card>
              <ResponsiveTableAdapter
                dataSource={summary.lines || []}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 20 }}
              />
            </Card>
          </>
        )}
      </Space>
    </div>
  );
};

export default AnalyticReport;
