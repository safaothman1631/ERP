import { useEffect, useState } from 'react';
import { Button, DatePicker, Modal, Select, Space, Tag, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import GlassCard from '../components/GlassCard';
import PlatformPageHeader from '../components/PlatformPageHeader';
import { BUNDLES, type BundleId } from '../../onboarding/bundles';
import { MODULES, type ModuleKey } from '../../onboarding/industries';

const { Text } = Typography;

interface Props {
  orgIdProp?: string;
  embedded?: boolean;
}

export default function LicenseEditorPage({ orgIdProp, embedded }: Props) {
  const { t } = useTranslation();
  const [orgId, setOrgId] = useState(orgIdProp || '');
  const [bundleId, setBundleId] = useState<BundleId>('full_core');
  const [modules, setModules] = useState<ModuleKey[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => { if (orgIdProp) setOrgId(orgIdProp); }, [orgIdProp]);

  const loadLicense = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<{ license: { bundle_id?: string; allowed_modules?: ModuleKey[]; expires_at?: string } }>(
        `/api/platform/orgs/${id}/license`,
      );
      const lic = res.data.license || {};
      setBundleId((lic.bundle_id as BundleId) || 'custom');
      setModules(lic.allowed_modules || []);
      setExpiresAt(lic.expires_at || null);
    } catch {
      message.error(t('platform_license_load_err', 'Could not load license'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (orgId) void loadLicense(orgId); }, [orgId]);

  const onBundleChange = (id: BundleId) => {
    setBundleId(id);
    const b = BUNDLES.find(x => x.id === id);
    if (b && id !== 'custom') setModules(b.modules);
  };

  const save = async () => {
    if (!orgId.trim()) {
      message.warning(t('platform_org_required', 'Enter organization ID'));
      return;
    }
    setLoading(true);
    try {
      await api.put(`/api/platform/orgs/${orgId.trim()}/license`, {
        bundle_id: bundleId,
        allowed_modules: bundleId === 'custom' ? modules : undefined,
        expires_at: expiresAt,
      });
      message.success(t('platform_license_saved', 'License saved'));
      setConfirmOpen(false);
    } catch {
      message.error(t('platform_license_save_err', 'Save failed'));
    } finally {
      setLoading(false);
    }
  };

  const body = (
    <GlassCard>
      {!embedded && (
        <Space style={{ marginBottom: 16 }}>
          <input
            value={orgId}
            onChange={e => setOrgId(e.target.value)}
            placeholder={t('platform.org_id', 'Organization ID')}
            style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc', minWidth: 280 }}
          />
          <Button onClick={() => loadLicense(orgId)} loading={loading}>{t('load', 'Load')}</Button>
        </Space>
      )}
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Text type="secondary">{t('platform.bundle', 'Bundle')}</Text>
          <Select
            style={{ width: '100%', marginTop: 8 }}
            value={bundleId}
            onChange={onBundleChange}
            options={BUNDLES.map(b => ({ value: b.id, label: b.id }))}
          />
        </div>
        {bundleId === 'custom' && (
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            value={modules}
            onChange={setModules}
            options={MODULES.map(m => ({ value: m.key, label: m.key }))}
          />
        )}
        <DatePicker
          style={{ width: '100%' }}
          value={expiresAt ? dayjs(expiresAt) : null}
          onChange={d => setExpiresAt(d ? d.toISOString() : null)}
        />
        <Space wrap>
          {modules.slice(0, 8).map(m => <Tag key={m}>{m}</Tag>)}
        </Space>
        <Button type="primary" loading={loading} onClick={() => setConfirmOpen(true)}>
          {t('save', 'Save')}
        </Button>
      </Space>
    </GlassCard>
  );

  if (embedded) return body;

  return (
    <>
      <PlatformPageHeader title={t('platform.license.title', 'License editor')} />
      {body}
      <Modal
        open={confirmOpen}
        title={t('platform.license.confirm', 'Confirm license change')}
        onCancel={() => setConfirmOpen(false)}
        onOk={save}
      >
        <p>{t('platform.license.confirm_body', 'Apply bundle {{bundle}} to org {{org}}?', { bundle: bundleId, org: orgId })}</p>
      </Modal>
    </>
  );
}
