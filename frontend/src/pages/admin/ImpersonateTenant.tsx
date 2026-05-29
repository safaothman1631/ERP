/**
 * ImpersonateTenant — admin starts a 30-minute read-only impersonation
 * session (G2 / R2.3).
 *
 * Flow:
 *  1. Admin picks a tenant and types a reason (≥ 10 chars).
 *  2. Confirmation modal warns: "Read-only. Every action audited. 30-min cap."
 *  3. Backend issues a token; we stash it in sessionStorage and reload into
 *     the tenant's dashboard.
 *
 * Access: super-admin only (server enforces; nav hides for everyone else).
 */
import React, { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Typography,
  message,
} from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { storeImpersonationToken } from '../../utils/impersonation';

const { Title, Paragraph, Text } = Typography;

interface StartResponse {
  access_token: string;
  expires_in: number;
  expires_at: string;
  audit_id: string;
  tenant_id: string;
  target_user_id: string | null;
  read_only: boolean;
}

interface FormValues {
  tenant_id: string;
  target_user_id?: string;
  reason: string;
}

export const ImpersonateTenant: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState<FormValues | null>(null);

  const promptConfirm = (values: FormValues) => {
    setPending(values);
    setConfirmOpen(true);
  };

  const startImpersonation = async () => {
    if (!pending) return;
    setLoading(true);
    try {
      const res = await api.post<StartResponse>(
        '/api/admin/impersonate/start',
        pending,
      );
      const data = res.data;
      storeImpersonationToken(data.access_token, {
        audit_id: data.audit_id,
        tenant_id: data.tenant_id,
        expires_at: data.expires_at,
      });
      message.success(
        t(
          'impersonation.started',
          'Impersonation session started — redirecting…',
        ),
      );
      // Hand off to the regular app shell as the new (read-only) user.
      window.location.assign('/');
    } catch (e: any) {
      message.error(
        e?.response?.data?.detail ||
          t('impersonation.startFailed', 'Could not start impersonation'),
      );
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  return (
    <Card style={{ maxWidth: 720, margin: '24px auto' }}>
      <Title level={3}>{t('impersonation.title', 'Impersonate tenant')}</Title>
      <Paragraph type="secondary">
        {t(
          'impersonation.intro',
          'Start a 30-minute read-only session as a tenant for debugging. Every action is logged and visible in the audit trail.',
        )}
      </Paragraph>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('impersonation.warningTitle', 'Audited — proceed carefully')}
        description={t(
          'impersonation.warningBody',
          'You will see the tenant exactly as they do, but cannot modify data. Every screen visit and API call is written to the impersonation_audit log and retained for 18 months.',
        )}
      />

      <Form<FormValues>
        layout="vertical"
        form={form}
        onFinish={promptConfirm}
        disabled={loading}
      >
        <Form.Item
          name="tenant_id"
          label={t('impersonation.tenantId', 'Tenant ID')}
          rules={[{ required: true, min: 1, max: 128 }]}
        >
          <Input placeholder="tenant-XYZ" autoComplete="off" />
        </Form.Item>

        <Form.Item
          name="target_user_id"
          label={t('impersonation.targetUser', 'Specific user (optional)')}
          tooltip={t(
            'impersonation.targetUserHelp',
            "Leave blank to impersonate the tenant's primary admin.",
          )}
        >
          <Input placeholder="user-id-here" autoComplete="off" />
        </Form.Item>

        <Form.Item
          name="reason"
          label={t('impersonation.reason', 'Reason (visible to auditors)')}
          rules={[
            {
              required: true,
              min: 10,
              max: 500,
              message: t(
                'impersonation.reasonRequired',
                'Reason is required and must be at least 10 characters',
              ),
            },
          ]}
        >
          <Input.TextArea
            rows={3}
            placeholder={t(
              'impersonation.reasonPlaceholder',
              'e.g. Debugging stuck invoice for ticket #1234',
            )}
          />
        </Form.Item>

        <Space>
          <Button type="primary" htmlType="submit" loading={loading} danger>
            {t('impersonation.start', 'Start impersonation')}
          </Button>
        </Space>
      </Form>

      <Modal
        title={t('impersonation.confirmTitle', 'Confirm impersonation')}
        open={confirmOpen}
        onOk={startImpersonation}
        confirmLoading={loading}
        onCancel={() => setConfirmOpen(false)}
        okText={t('impersonation.confirmOk', 'Yes, start session')}
        cancelText={t('impersonation.confirmCancel', 'Cancel')}
        okType="danger"
      >
        <Paragraph>
          {t(
            'impersonation.confirmBody',
            'You are about to view tenant {{tenant}} as one of their users. The session is read-only and lasts 30 minutes.',
            { tenant: pending?.tenant_id },
          )}
        </Paragraph>
        <Paragraph>
          <Text strong>{t('impersonation.reason', 'Reason')}:</Text>{' '}
          <Text italic>{pending?.reason}</Text>
        </Paragraph>
      </Modal>
    </Card>
  );
};

export default ImpersonateTenant;
