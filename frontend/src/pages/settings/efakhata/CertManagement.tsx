/**
 * Settings → e-Fakhata → Certificate management (growth-to-100 § R4 / G4a).
 *
 * Admins upload the tenant's PKCS#12 signing cert + password here; the
 * password is *never* echoed back from the backend and the field is
 * cleared on submit. Past versions are listed for audit; an admin can
 * revoke the active version (and is then expected to upload a fresh one).
 */
import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Popconfirm, Table, Tag, Typography, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useTranslation } from 'react-i18next';
import api from '../../../api';

const { Title, Paragraph: _Paragraph, Text } = Typography;

interface CertVersion {
  version: string;
  uploaded_at: string;
  fingerprint: string;
  revoked: boolean;
  revoked_reason?: string | null;
}

const CertManagementPage: React.FC = () => {
  const { t } = useTranslation('efakhata');
  const [form] = Form.useForm();
  const [versions, setVersions] = useState<CertVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [file, setFile] = useState<UploadFile | null>(null);

  const fetchVersions = async (tid: string) => {
    if (!tid) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/tenants/${tid}/efakhata/cert`);
      setVersions(res.data.items || []);
    } catch (_err) {
      // Allow 404 (no cert yet) silently.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Resolve tenant id from the current session — uses orgStore persist.
    try {
      const raw = localStorage.getItem('org.store.v1');
      const parsed = raw ? JSON.parse(raw) : {};
      const tid =
        parsed?.state?.currentCompany?.id || parsed?.state?.activeOrgId || '';
      setTenantId(tid);
      if (tid) void fetchVersions(tid);
    } catch {
      /* no-op */
    }
  }, []);

  const handleUpload = async () => {
    if (!file?.originFileObj) {
      message.error(t('cert_file_required', 'Select a .p12 / .pfx file first'));
      return;
    }
    const values = form.getFieldsValue();
    if (!values.password) {
      message.error(t('cert_password_required', 'Password is required'));
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('cert_file', file.originFileObj);
      fd.append('password', values.password);
      const res = await api.post(`/api/tenants/${tenantId}/efakhata/cert`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(
        t('uploaded_ok', 'Certificate uploaded') +
          ` — fp: ${res.data.fingerprint.slice(0, 12)}…`,
      );
      // Clear the password field aggressively — it must not linger.
      form.resetFields(['password']);
      setFile(null);
      void fetchVersions(tenantId);
    } catch (_err) {
      message.error(t('upload_failed', 'Upload failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!tenantId) return;
    try {
      await api.delete(`/api/tenants/${tenantId}/efakhata/cert`, {
        params: { reason: 'admin_revocation' },
      });
      message.success(t('revoked_ok', 'Certificate revoked'));
      void fetchVersions(tenantId);
    } catch (_err) {
      message.error(t('revoke_failed', 'Revoke failed'));
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>{t('cert_title', 'e-Fakhata signing certificate')}</Title>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message={t(
          'cert_warning',
          'PKCS#12 file is encrypted at rest in Secret Manager. The password is held in memory only and never logged.',
        )}
      />

      <Card title={t('upload', 'Upload new certificate')} style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleUpload}>
          <Form.Item label={t('cert_file', 'PKCS#12 file (.p12 / .pfx)')}>
            <Upload
              accept=".p12,.pfx"
              maxCount={1}
              beforeUpload={(f) => {
                setFile({
                  uid: f.uid,
                  name: f.name,
                  status: 'done',
                  originFileObj: f as any,
                });
                return false; // prevent auto-upload
              }}
              onRemove={() => {
                setFile(null);
                return true;
              }}
              fileList={file ? [file] : []}
            >
              <Button>{t('select_file', 'Select file')}</Button>
            </Upload>
          </Form.Item>
          <Form.Item
            label={t('password_label', 'PKCS#12 password')}
            name="password"
            rules={[{ required: true }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {t('upload_button', 'Upload')}
          </Button>
        </Form>
      </Card>

      <Card title={t('history', 'Version history')}>
        <Table
          rowKey="version"
          loading={loading}
          dataSource={versions}
          pagination={false}
          columns={[
            { title: 'Version', dataIndex: 'version' },
            { title: 'Uploaded', dataIndex: 'uploaded_at' },
            {
              title: 'Fingerprint',
              dataIndex: 'fingerprint',
              render: (fp: string) =>
                fp ? <Text code>{fp.slice(0, 16)}…</Text> : '—',
            },
            {
              title: 'Status',
              dataIndex: 'revoked',
              render: (rev: boolean) =>
                rev ? <Tag color="red">revoked</Tag> : <Tag color="green">active</Tag>,
            },
          ]}
        />
        {versions.some((v) => !v.revoked) && (
          <Popconfirm
            title={t(
              'revoke_confirm',
              'Revoke the active certificate? You must immediately upload a replacement.',
            )}
            onConfirm={handleRevoke}
          >
            <Button danger style={{ marginTop: 16 }}>
              {t('revoke_button', 'Revoke active')}
            </Button>
          </Popconfirm>
        )}
      </Card>
    </div>
  );
};

export default CertManagementPage;
