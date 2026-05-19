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
            <h2>{t('studio.create_workflows', 'Create Workflows')}</h2>
            <p style={{ fontSize: 16, color: '#64748b', maxWidth: 500, margin: '0 auto' }}>
              {t('studio.workflows_desc', 'Automate tasks for this entity, like sending emails, changing status, or creating related documents')}
            </p>
          </div>

          <Button type="primary" size="large" icon={<RocketOutlined />} onClick={handleLaunchWorkflowBuilder}>
            {t('studio.launch_workflow_builder', 'Launch Workflow Builder')}
          </Button>

          <div style={{ marginTop: space.lg, textAlign: 'left', maxWidth: 600, margin: '0 auto' }}>
            <h4>{t('studio.what_you_can_automate', 'What can you automate?')}</h4>
            <ul style={{ paddingInlineStart: 24 }}>
              <li>{t('studio.auto_email', 'Send email when document is created')}</li>
              <li>{t('studio.auto_status', 'Change status based on conditions')}</li>
              <li>{t('studio.auto_notification', 'Send notifications to team')}</li>
              <li>{t('studio.auto_webhook', 'Send webhook to external system')}</li>
              <li>{t('studio.auto_schedule', 'Scheduled recurring tasks')}</li>
            </ul>
          </div>
        </Space>
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <h4>{t('studio.existing_workflows', 'Existing Workflows')}</h4>
        <p style={{ color: '#64748b' }}>
          {t('studio.existing_workflows_desc', 'To view and edit workflows, go to')}
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
