import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Table, Button, Typography, Space, Tag, Empty } from 'antd';
import { message } from '../../utils/message';
import { HistoryOutlined, ArrowLeftOutlined, InboxOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';

const { Text } = Typography;

interface ImportRecord {
  id: string;
  date: string;
  format: string;
  imported_count: number;
  skipped_count: number;
  created_by: string;
}

const BankImportHistory: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { accountId } = useParams<{ accountId: string }>();

  const [data, setData] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [accountId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Note: This endpoint doesn't exist yet in backend, but we can display
      // a placeholder or fetch transactions filtered by created_at
      // For now, show empty state
      setData([]);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t('date'),
      dataIndex: 'date',
      key: 'date',
      render: (d: string) => d?.substring(0, 10)
    },
    {
      title: t('format'),
      dataIndex: 'format',
      key: 'format',
      render: (f: string) => <Tag color="blue">{f.toUpperCase()}</Tag>
    },
    {
      title: t('imported'),
      dataIndex: 'imported_count',
      key: 'imported',
      render: (v: number) => <Text style={{ color: '#52c41a' }}>{v}</Text>
    },
    {
      title: t('skipped'),
      dataIndex: 'skipped_count',
      key: 'skipped',
      render: (v: number) => <Text type="secondary">{v}</Text>
    },
    {
      title: t('created_by'),
      dataIndex: 'created_by',
      key: 'created_by'
    }
  ];

  return (
    <div>
      <PageHeader
        title={t('import_history')}
        subtitle={t('import_history_subtitle', 'مێژووی هێنانەکان')}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/banking/${accountId}/reconciliation`)}>
              {t('back')}
            </Button>
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => navigate(`/banking/${accountId}/import`)}>
              {t('import_new')}
            </Button>
          </Space>
        }
      />

      <Card>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          locale={{
            emptyText: (
              <Empty
                image={<InboxOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
                description={
                  <Space direction="vertical" size={4}>
                    <Text strong>{t('no_import_history')}</Text>
                    <Text type="secondary">{t('no_import_history_hint')}</Text>
                  </Space>
                }
              >
                <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => navigate(`/banking/${accountId}/import`)}>
                  {t('import_first_statement')}
                </Button>
              </Empty>
            )
          }}
        />
      </Card>
    </div>
  );
};

export default BankImportHistory;
