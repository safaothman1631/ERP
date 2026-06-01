import { useState, useEffect } from 'react';
import { Steps, Timeline, Button } from 'antd';
import { message } from '../../utils/message';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckOutlined, CloseOutlined, ClockCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../api';
import { DetailLayout, SectionCard, KeyValueGrid, StatusTag } from '../../design-system';
import type { StatusKind } from '../../design-system/StatusTag';
import { LoadingSkeleton } from '../../design-system/LoadingSkeleton';
import { useLoadingState } from '../../hooks/useLoadingState';

interface ApprovalRequest {
  id: string;
  doc_type: string;
  doc_id: string;
  doc_summary: {
    number: string;
    total: number;
    currency: string;
    contact_name?: string;
  };
  requested_by: string;
  current_step: number;
  total_steps: number;
  status: string;
  created_at: string;
  completed_at?: string;
  steps: Array<{
    step: number;
    approver_id: string;
    approver_type: string;
    status: string;
    acted_at?: string;
    acted_by?: string;
    comments?: string;
    delegated_to?: string;
    can_delegate: boolean;
  }>;
  rule_id: string;
}

export default function ApprovalDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const { showSkeleton } = useLoadingState(loading);
  const [users, setUsers] = useState<Record<string, any>>({});

  useEffect(() => {
    if (id) {
      fetchRequest();
      fetchUsers();
    }
  }, [id]);

  const fetchRequest = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/approvals/approval-requests/${id}`);
      setRequest(res.data);
    } catch {
      message.error(t('error'));
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/users');
      const userMap: Record<string, any> = {};
      (res.data.items || []).forEach((u: any) => {
        userMap[u.id] = u;
      });
      setUsers(userMap);
    } catch {
      // Silently fail
    }
  };

  const statusKind = (status: string): StatusKind => {
    const map: Record<string, StatusKind> = {
      pending: 'pending',
      approved: 'approved',
      rejected: 'rejected',
      cancelled: 'cancelled',
    };
    return map[status] || 'default';
  };
  const getStatusTag = (status: string) => (
    <StatusTag status={statusKind(status)} label={t(`approvals.status_${status}`)} />
  );

  const getStepStatus = (step: any, currentStep: number, overallStatus: string): 'finish' | 'error' | 'wait' | 'process' => {
    if (step.status === 'approved') return 'finish';
    if (step.status === 'rejected') return 'error';
    if (overallStatus !== 'pending') return 'wait';
    if (step.step === currentStep) return 'process';
    if (step.step < currentStep) return 'finish';
    return 'wait';
  };

  if (showSkeleton) {
    return (
      <SectionCard>
        <LoadingSkeleton variant="card" />
      </SectionCard>
    );
  }

  if (!request) {
    return (
      <SectionCard>
        <p style={{ color: 'var(--ink-500)' }}>{t('approvals.not_found')}</p>
      </SectionCard>
    );
  }

  const stepsItems = request.steps.map((step) => {
    const approverName = users[step.approver_id]?.name || users[step.approver_id]?.email || step.approver_id;
    const delegatedName = step.delegated_to ? users[step.delegated_to]?.name || users[step.delegated_to]?.email : null;
    
    return {
      title: `${t('approvals.step')} ${step.step}`,
      description: (
        <div>
          <div>
            {t('approvals.approver')}: {approverName}
            {delegatedName && ` (${t('approvals.delegated_to')} ${delegatedName})`}
          </div>
          <div>{getStatusTag(step.status)}</div>
          {step.comments && <div style={{ marginTop: 8 }}>{t('approvals.comments')}: {step.comments}</div>}
        </div>
      ),
      status: getStepStatus(step, request.current_step, request.status),
    };
  });

  return (
    <DetailLayout
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink-900)' }}>
            {t('approvals.request_detail')}
          </span>
          {getStatusTag(request.status)}
        </div>
      }
      toolbar={
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/my-approvals')}>{t('back')}</Button>
      }
      side={
        <SectionCard title={t('approvals.timeline')} style={{ marginBottom: 0 }}>
          <Timeline>
            <Timeline.Item color="var(--accent-500)">
              <strong>{t('approvals.created')}</strong>
              <div>{new Date(request.created_at).toLocaleString()}</div>
              <div>
                {t('approvals.by')} {users[request.requested_by]?.name || users[request.requested_by]?.email || request.requested_by}
              </div>
            </Timeline.Item>

            {request.steps
              .filter((s) => s.acted_at)
              .map((step, idx) => {
                const actorName = users[step.acted_by!]?.name || users[step.acted_by!]?.email || step.acted_by;
                return (
                  <Timeline.Item
                    key={idx}
                    color={step.status === 'approved' ? 'var(--success-500)' : 'var(--danger-500)'}
                    dot={step.status === 'approved' ? <CheckOutlined /> : <CloseOutlined />}
                  >
                    <strong>
                      {t('approvals.step')} {step.step} - {t(`approvals.status_${step.status}`)}
                    </strong>
                    <div>{new Date(step.acted_at!).toLocaleString()}</div>
                    <div>
                      {t('approvals.by')} {actorName}
                    </div>
                    {step.comments && <div style={{ marginTop: 4 }}>{step.comments}</div>}
                  </Timeline.Item>
                );
              })}

            {request.status === 'pending' && (
              <Timeline.Item color="var(--ink-300)" dot={<ClockCircleOutlined />}>
                <strong>{t('approvals.pending_approval')}</strong>
              </Timeline.Item>
            )}

            {request.completed_at && (
              <Timeline.Item color={request.status === 'approved' ? 'var(--success-500)' : 'var(--danger-500)'}>
                <strong>{t(`approvals.status_${request.status}`)}</strong>
                <div>{new Date(request.completed_at).toLocaleString()}</div>
              </Timeline.Item>
            )}
          </Timeline>
        </SectionCard>
      }
    >
      <SectionCard title={t('approvals.request_detail')}>
        <KeyValueGrid
          columns={2}
          items={[
            { label: t('approvals.doc_type'), value: t(`approvals.doc_type_${request.doc_type}`) },
            { label: t('approvals.document_number'), value: request.doc_summary.number },
            { label: t('approvals.amount'), value: `${request.doc_summary.total.toLocaleString()} ${request.doc_summary.currency}` },
            { label: t('approvals.contact'), value: request.doc_summary.contact_name || '—' },
            { label: t('status'), value: getStatusTag(request.status) },
            { label: t('approvals.current_step'), value: `${request.current_step} / ${request.total_steps}` },
            { label: t('approvals.requested_by'), value: users[request.requested_by]?.name || users[request.requested_by]?.email || request.requested_by },
            { label: t('approvals.created_at'), value: new Date(request.created_at).toLocaleString() },
            ...(request.completed_at
              ? [{ label: t('approvals.completed_at'), value: new Date(request.completed_at).toLocaleString() }]
              : []),
          ]}
        />
      </SectionCard>

      <SectionCard title={t('approvals.approval_flow')} style={{ marginBottom: 0 }}>
        <Steps
          current={request.current_step - 1}
          items={stepsItems}
          direction="vertical"
        />
      </SectionCard>
    </DetailLayout>
  );
}
