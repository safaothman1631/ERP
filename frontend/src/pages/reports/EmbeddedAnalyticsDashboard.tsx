import React, { useEffect, useState } from 'react';
import { Button, List, message } from 'antd';
import { PlusOutlined, BuildOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, SectionCard } from '../../design-system';

interface SavedReport {
  id: string;
  name: string;
  source: string;
  columns: string[];
  created_at: string;
}

const EmbeddedAnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadReports = async () => {
      try {
        setLoading(true);
        const response = await api.get('/api/custom-reports');
        setReports(response.data.items || []);
      } catch (error) {
        message.error(t('custom_reports.error_loading'));
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [t]);

  return (
    <div>
      <PageHeader
        title={t('custom_reports.analytics_title', 'Analytics Dashboard')}
        subtitle={t(
          'custom_reports.analytics_subtitle',
          'Saved custom reports built from your operational data.',
        )}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/reports/custom')}
          >
            {t('custom_reports.new_report')}
          </Button>
        }
      />

      <SectionCard>
        <List
          loading={loading}
          dataSource={reports}
          locale={{ emptyText: t('custom_reports.no_reports', 'No saved reports yet.') }}
          renderItem={(report) => (
            <List.Item
              actions={[
                <Button
                  key="open"
                  type="link"
                  icon={<BuildOutlined />}
                  onClick={() => navigate(`/reports/custom?id=${report.id}`)}
                >
                  {t('custom_reports.open_builder', 'Open builder')}
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={report.name}
                description={`${report.source} · ${t('custom_reports.columns_count', {
                  count: report.columns.length,
                })} · ${new Date(report.created_at).toLocaleDateString()}`}
              />
            </List.Item>
          )}
        />
      </SectionCard>
    </div>
  );
};

export default EmbeddedAnalyticsDashboard;
