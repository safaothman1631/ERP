import React, { useEffect, useState } from 'react';
import { Table, Card, Button, Space, DatePicker } from 'antd';
import { message } from '../utils/message';
import { MailOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { PageHeader } from '../design-system';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const CustomerStatements: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const contactId = searchParams.get('contact_id');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const fetchData = async () => {
    if (!contactId) return;
    setLoading(true);
    try {
      const params: any = {};
      if (dateRange) {
        params.date_from = dateRange[0].format('YYYY-MM-DD');
        params.date_to = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await api.get(`/api/customer-statements/${contactId}`, { params });
      setData(res.data);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [contactId, dateRange]);

  const handleEmail = async () => {
    try {
      const params: any = {};
      if (dateRange) {
        params.date_from = dateRange[0].format('YYYY-MM-DD');
        params.date_to = dateRange[1].format('YYYY-MM-DD');
      }
      await api.post(`/api/customer-statements/${contactId}/email`, null, { params });
      message.success(t('email_sent'));
    } catch {
      message.error(t('error'));
    }
  };

  const handleDownloadPdf = async () => {
    if (!contactId) return;
    try {
      const params: any = {};
      if (dateRange) {
        params.date_from = dateRange[0].format('YYYY-MM-DD');
        params.date_to = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await api.get(`/api/customer-statements/${contactId}/pdf`, { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `statement-${contactId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error(t('error'));
    }
  };

  const columns = [
    { title: t('date'), dataIndex: 'date', key: 'date' },
    { title: t('type'), dataIndex: 'type', key: 'type' },
    { title: t('reference'), dataIndex: 'reference', key: 'reference' },
    { title: t('description'), dataIndex: 'description', key: 'description' },
    { title: t('debit'), dataIndex: 'debit', key: 'debit', render: (v: number) => (v || 0).toLocaleString() },
    { title: t('credit'), dataIndex: 'credit', key: 'credit', render: (v: number) => (v || 0).toLocaleString() },
    { title: t('balance'), dataIndex: 'balance', key: 'balance', render: (v: number) => (v || 0).toLocaleString() },
  ];

  return (
    <div>
      <PageHeader
        title={t('customer_statement')}
        subtitle={data?.contact_name || t('customer_statement_subtitle', 'رێکەوتی کڕیار')}
        helpKey="statements"
        extra={
          <Space>
            <RangePicker onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)} />
            <Button icon={<MailOutlined />} onClick={handleEmail}>{t('send_email')}</Button>
            <Button icon={<FilePdfOutlined />} onClick={handleDownloadPdf}>{t('download_pdf')}</Button>
          </Space>
        }
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space size="large">
            <div>
              <strong>{t('opening_balance')}:</strong> {(data?.opening_balance || 0).toLocaleString()}
            </div>
            <div>
              <strong>{t('closing_balance')}:</strong> {(data?.closing_balance || 0).toLocaleString()}
            </div>
          </Space>
        </Card>

        <Card>
          <Table
            dataSource={data?.transactions || []}
            columns={columns}
            rowKey={(r: any, idx) => `${r.date}_${idx}`}
            loading={loading}
            pagination={{ pageSize: 50 }}
          />
        </Card>
      </Space>
    </div>
  );
};

export default CustomerStatements;
