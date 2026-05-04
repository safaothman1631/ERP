import type React from 'react';
import { Card, Button, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { ThunderboltOutlined, RocketOutlined } from '@ant-design/icons';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';

const AutomationFromStudio: React.FC = () => {
  const { t } = useTranslation();
  const { entity } = useParams<{ entity: string }>();
  const navigate = useNavigate();

  const handleLaunchWorkflowBuilder = () => {
    navigate(`/automation/workflows/new?entity=${entity}`);
  };

  return (
    <div>
      <PageHeader
        title={t('studio.automation', 'Automation')}
        subtitle={t('studio.entity_automation', { entity: t(entity || '') })}
        breadcrumb={[
          { label: t('home'), to: '/' },
          { label: t('studio.title'), to: '/studio' },
          { label: t(entity || ''), to: `/studio/${entity}/fields` },
          { label: t('studio.automation', 'Automation') },
        ]}
        extra={
          <Button onClick={() => navigate(`/studio/${entity}/fields`)}>
            {t('studio.back_to_fields', 'Back to Fields')}
          </Button>
        }
      />

      <Card style={{ textAlign: 'center', padding: space.xl }}>
        <Space direction="vertical" size={space.lg} style={{ width: '100%' }}>
          <ThunderboltOutlined style={{ fontSize: 64, color: '#6366f1' }} />
          <div>
            <h2>{t('studio.create_workflows', 'درووستکردنی Workflow')}</h2>
            <p style={{ fontSize: 16, color: '#64748b', maxWidth: 500, margin: '0 auto' }}>
              {t(
                'studio.workflows_desc',
                'خۆکارکردنی ئەرکەکان بۆ ئەم entity، وەک ناردنی ئیمەیڵ، گۆڕینی status، یان درووستکردنی بەڵگەی پەیوەست'
              )}
            </p>
          </div>

          <Button type="primary" size="large" icon={<RocketOutlined />} onClick={handleLaunchWorkflowBuilder}>
            {t('studio.launch_workflow_builder', 'کردنەوەی Workflow Builder')}
          </Button>

          <div style={{ marginTop: space.lg, textAlign: 'left', maxWidth: 600, margin: '0 auto' }}>
            <h4>{t('studio.what_you_can_automate', 'چی دەکرێت خۆکار بکرێت؟')}</h4>
            <ul style={{ paddingInlineStart: 24 }}>
              <li>{t('studio.auto_email', 'ناردنی ئیمەیڵ کاتێک بەڵگە درووست دەکرێت')}</li>
              <li>{t('studio.auto_status', 'گۆڕینی status بە پێی مەرج')}</li>
              <li>{t('studio.auto_notification', 'ناردنی ئاگادارکردنەوە بۆ تیم')}</li>
              <li>{t('studio.auto_webhook', 'ناردنی webhook بۆ سیستەمی دەرەکی')}</li>
              <li>{t('studio.auto_schedule', 'ئەرکی دووبارە (Scheduled)')}</li>
            </ul>
          </div>
        </Space>
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <h4>{t('studio.existing_workflows', 'Workflow ـە هەنووکەییەکان')}</h4>
        <p style={{ color: '#64748b' }}>
          {t('studio.existing_workflows_desc', 'بۆ بینین و دەستکاری، بڕۆ بۆ')}
          {' '}
          <Button type="link" onClick={() => navigate('/automation/workflows')} style={{ padding: 0 }}>
            {t('automation.workflows', 'Workflows')}
          </Button>
        </p>
      </Card>
    </div>
  );
};

export default AutomationFromStudio;
