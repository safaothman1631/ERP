import React, { useState } from 'react';
import { Card, DatePicker, Button, Space, Alert, Empty } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import dayjs, { Dayjs } from 'dayjs';
import { PageHeader, LoadingSkeleton } from '../../design-system';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

interface RunResult {
  processed: number;
  failed: number;
  total_amount: number;
  errors: { asset_id: string; asset_name: string; error: string }[];
}

const DepreciationRun: React.FC = () => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Dayjs | null>(dayjs().subtract(1, 'month'));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const handleRun = async () => {
    if (!period) {
      message.error(t('assets.select_period'));
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const periodStr = period.format('YYYY-MM');
      const r = await api.post('/api/fixed-assets/assets/run-monthly', null, { params: { period: periodStr } });
      setResult(r.data);
      message.success(t('success'));
    } catch (err: unknown) {
      const errorDetail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      message.error(errorDetail || t('error'));
    } finally {
      setRunning(false);
    }
  };

  const errorColumns = [
    { title: t('assets.asset_code'), dataIndex: 'asset_id', key: 'id', width: 150 },
    { title: t('name'), dataIndex: 'asset_name', key: 'name' },
    { title: t('error'), dataIndex: 'error', key: 'error' },
  ];

  return (
    <>
      <PageHeader title={t('assets.run_depreciation')} />
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <label style={{ marginRight: 8 }}>{t('assets.period')}:</label>
            <DatePicker picker="month" value={period} onChange={setPeriod} format="YYYY-MM" style={{ width: 200 }} />
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleRun} loading={running} style={{ marginLeft: 16 }}>
              {t('assets.run_for_period')}
            </Button>
          </div>

          {running && <LoadingSkeleton variant="row" rows={2} />}

          {result && (
            <>
              <Alert
                type={result.failed === 0 ? 'success' : 'warning'}
                message={t('assets.depreciation_complete')}
                description={
                  <>
                    <p>{t('assets.processed')}: {result.processed}</p>
                    <p>{t('assets.failed')}: {result.failed}</p>
                    <p>{t('assets.total_amount')}: {result.total_amount.toLocaleString()}</p>
                  </>
                }
              />
              {result.errors.length > 0 && (
                <div>
                  <h4>{t('errors')}</h4>
                  <ResponsiveTableAdapter columns={errorColumns} dataSource={result.errors} rowKey="asset_id" pagination={false} />
                </div>
              )}
            </>
          )}

          {!result && !running && (
            <Empty description={t('assets.select_period_and_run')} />
          )}
        </Space>
      </Card>
    </>
  );
};

export default DepreciationRun;
