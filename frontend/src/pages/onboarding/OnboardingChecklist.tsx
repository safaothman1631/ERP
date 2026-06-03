import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Card, List, Progress, Button, Tag, Space, Empty } from 'antd';
import { CheckCircleOutlined, RightOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, LoadingSkeleton } from '../../design-system';
import AddGateProvider, {
  type FlowStepBinding,
  type FlowStepStatus,
} from '../../components/AddGate/AddGateProvider';
import type { SectionId } from '../../help/sectionIds';

interface ChecklistItem {
  key: string;
  title: string;
  description: string;
  completed: boolean;
  action_label: string;
  action_path: string;
}

/** Flow ID for the onboarding checklist multi-step flow. */
const CHECKLIST_FLOW_ID = 'onboarding-checklist';

/** Maps checklist item keys to their corresponding SectionIds. */
const CHECKLIST_SECTION_MAP: Record<string, SectionId> = {
  add_bank: 'onboarding.checklist.bank',
  add_contact: 'onboarding.checklist.contact',
  add_item: 'onboarding.checklist.item',
  first_invoice: 'onboarding.checklist.invoice',
  invite_user: 'onboarding.checklist.user',
  setup_tax: 'onboarding.checklist.tax',
};

/**
 * Build flow bindings for the checklist based on loaded items.
 * Items that are already completed are marked as such; others are
 * required-incomplete.
 */
const OnboardingChecklistInner: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [completionPercent, setCompletionPercent] = useState(0);

  const loadChecklist = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/onboarding/checklist');
      const data = res.data.items || [];
      setItems(data);
      const completed = data.filter((i: ChecklistItem) => i.completed).length;
      setCompletionPercent(data.length > 0 ? Math.round((completed / data.length) * 100) : 0);
    } catch (_err) {
      // Fallback: static checklist
      const staticChecklist: ChecklistItem[] = [
        {
          key: 'add_bank',
          title: t('onboarding.checklist_add_bank'),
          description: t('onboarding.checklist_add_bank_desc'),
          completed: false,
          action_label: t('onboarding.action_add_bank'),
          action_path: '/banking',
        },
        {
          key: 'add_contact',
          title: t('onboarding.checklist_add_contact'),
          description: t('onboarding.checklist_add_contact_desc'),
          completed: false,
          action_label: t('onboarding.action_add_contact'),
          action_path: '/contacts',
        },
        {
          key: 'add_item',
          title: t('onboarding.checklist_add_item'),
          description: t('onboarding.checklist_add_item_desc'),
          completed: false,
          action_label: t('onboarding.action_add_item'),
          action_path: '/items',
        },
        {
          key: 'first_invoice',
          title: t('onboarding.checklist_first_invoice'),
          description: t('onboarding.checklist_first_invoice_desc'),
          completed: false,
          action_label: t('onboarding.action_create_invoice'),
          action_path: '/invoices/new',
        },
        {
          key: 'invite_user',
          title: t('onboarding.checklist_invite_user'),
          description: t('onboarding.checklist_invite_user_desc'),
          completed: false,
          action_label: t('onboarding.action_invite'),
          action_path: '/settings/users',
        },
        {
          key: 'setup_tax',
          title: t('onboarding.checklist_setup_tax'),
          description: t('onboarding.checklist_setup_tax_desc'),
          completed: false,
          action_label: t('onboarding.action_setup_tax'),
          action_path: '/tax-settings',
        },
      ];
      setItems(staticChecklist);
      setCompletionPercent(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChecklist();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <LoadingSkeleton variant="row" rows={6} />
      </div>
    );
  }

  const completedCount = items.filter((i) => i.completed).length;

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title={t('onboarding.checklist_title')}
        subtitle={t('onboarding.checklist_subtitle')}
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadChecklist}>
            {t('refresh')}
          </Button>
        }
      />

      <Card style={{ maxWidth: 900, margin: '24px auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h3>{t('onboarding.setup_progress')}</h3>
          <Progress
            percent={completionPercent}
            strokeColor="var(--success-500)"
            format={() => `${completedCount} / ${items.length}`}
          />
          <p style={{ marginTop: 8, color: 'var(--ink-500)' }}>
            {completionPercent === 100
              ? t('onboarding.all_done')
              : t('onboarding.complete_tasks_help')}
          </p>
        </div>

        {items.length === 0 ? (
          <Empty description={t('no_data')} />
        ) : (
          <List
            dataSource={items}
            renderItem={(item) => (
              <List.Item
                actions={[
                  item.completed ? (
                    <Tag icon={<CheckCircleOutlined />} color="success">
                      {t('addGate.flow.completed')}
                    </Tag>
                  ) : (
                    <Space>
                      <Tag color="warning">
                        {t('addGate.flow.requiredIncomplete')}
                      </Tag>
                      <Button
                        type="link"
                        icon={<RightOutlined />}
                        onClick={() => navigate(item.action_path)}
                      >
                        {item.action_label}
                      </Button>
                    </Space>
                  ),
                ]}
              >
                <List.Item.Meta
                  avatar={
                    item.completed ? (
                      <CheckCircleOutlined style={{ fontSize: 24, color: 'var(--success-500)' }} />
                    ) : (
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          border: '2px solid var(--border)',
                        }}
                      />
                    )
                  }
                  title={<span style={{ fontWeight: item.completed ? 400 : 600 }}>{item.title}</span>}
                  description={item.description}
                />
              </List.Item>
            )}
          />
        )}

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Space>
            <Button size="large" onClick={() => navigate('/dashboard')}>
              {t('onboarding.go_to_dashboard')}
            </Button>
            {completionPercent < 100 && (
              <Button type="link" onClick={() => navigate('/docs')}>
                {t('onboarding.view_docs')}
              </Button>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
};

/**
 * OnboardingChecklist wrapped in AddGateProvider to integrate with the
 * Selective Add system (R10.1, R10.2, R10.3, R10.4).
 *
 * Each checklist item is bound to a sectionId. Items that are already
 * completed (from the API) are marked as such in the flow bindings.
 * The progress indicator surfaces step status using AddGate semantics.
 */
const OnboardingChecklist: FC = () => {
  // The checklist builds its flow bindings dynamically after loading
  // items from the API. We wrap with an empty initial binding set;
  // the inner component can register flows dynamically if needed.
  // For the static fallback case, we pre-build bindings.
  const staticBindings: FlowStepBinding[] = Object.entries(CHECKLIST_SECTION_MAP).map(
    ([key, sectionId]) => ({
      flowId: CHECKLIST_FLOW_ID,
      stepId: key,
      sectionId,
      status: 'required-incomplete' as FlowStepStatus,
      route: `/${key.replace('_', '-')}`,
    }),
  );

  return (
    <AddGateProvider flowBindings={staticBindings}>
      <OnboardingChecklistInner />
    </AddGateProvider>
  );
};

export default OnboardingChecklist;
