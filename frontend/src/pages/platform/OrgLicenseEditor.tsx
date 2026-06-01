import { useEffect, useState } from 'react';
import {
  Button, DatePicker, Form, Input, Select, Space, Typography, message, Alert,
} from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, SectionCard, StatusTag } from '../../design-system';
import { BUNDLES, type BundleId } from '../../onboarding/bundles';
import { MODULES, type ModuleKey } from '../../onboarding/industries';

const { Text } = Typography;

interface OrgRow {
  id: string;
  name?: string;
}

export default function OrgLicenseEditor() {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [orgId, setOrgId] = useState<string>('');
  const [bundleId, setBundleId] = useState<BundleId>('full_core');
  const [modules, setModules] = useState<ModuleKey[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ items: OrgRow[] }>('/api/companies');
        setOrgs(res.data.items || []);
      } catch {
        /* platform may use manual org id */
      }
    })();
  }, []);

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
    setSaving(true);
    try {
      await api.put(`/api/platform/orgs/${orgId.trim()}/license`, {
        bundle_id: bundleId,
        allowed_modules: bundleId === 'custom' ? modules : undefined,
        expires_at: expiresAt,
      });
      message.success(t('platform_license_saved', 'License saved'));
    } catch {
      message.error(t('platform_license_save_err', 'Save failed — check platform.manage permission'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('platform_license_title', 'Organization licenses')}
        subtitle={t('platform_license_sub', 'Vendor provisioning — cap modules per customer org.')}
      />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('platform_license_hint', 'Requires platform.manage and PLATFORM_ADMIN_USER_IDS allowlist.')}
      />
      <SectionCard title={t('platform_license_editor', 'License editor')}>
        <Form layout="vertical" style={{ maxWidth: 640 }}>
          <Form.Item label={t('platform_org_id', 'Organization ID')}>
            <Space.Compact style={{ width: '100%' }}>
              <Select
                showSearch
                allowClear
                placeholder={t('platform_org_select', 'Select or type org ID')}
                style={{ flex: 1 }}
                value={orgId || undefined}
                onChange={v => { setOrgId(v); loadLicense(v); }}
                options={orgs.map(o => ({ value: o.id, label: o.name ? `${o.name} (${o.id})` : o.id }))}
                dropdownRender={menu => (
                  <>
                    {menu}
                    <div style={{ padding: 8 }}>
                      <Input
                        placeholder={t('platform_org_manual', 'Manual org ID')}
                        onPressEnter={e => {
                          const v = (e.target as HTMLInputElement).value.trim();
                          if (v) { setOrgId(v); loadLicense(v); }
                        }}
                      />
                    </div>
                  </>
                )}
              />
              <Button onClick={() => loadLicense(orgId)} disabled={!orgId} loading={loading}>{t('load', 'Load')}</Button>
            </Space.Compact>
          </Form.Item>

          <Form.Item label={t('platform_bundle', 'Bundle')}>
            <Select
              value={bundleId}
              onChange={onBundleChange}
              options={BUNDLES.map(b => ({
                value: b.id,
                label: t(b.titleKey, b.title),
              }))}
            />
          </Form.Item>

          {bundleId === 'custom' && (
            <Form.Item label={t('platform_modules', 'Allowed modules')}>
              <Select
                mode="multiple"
                value={modules}
                onChange={setModules}
                options={MODULES.map(m => ({
                  value: m.key,
                  label: `${m.icon} ${t(m.labelKey, m.title)}`,
                }))}
              />
            </Form.Item>
          )}

          {bundleId !== 'custom' && modules.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">{t('platform_modules_preview', 'Modules in bundle')}</Text>
              <div style={{ marginTop: 8 }}>
                <Space wrap>
                  {modules.map(k => {
                    const m = MODULES.find(x => x.key === k);
                    return m ? <StatusTag key={k} status="default" icon={<span aria-hidden>{m.icon}</span>} label={t(m.labelKey, m.title)} /> : null;
                  })}
                </Space>
              </div>
            </div>
          )}

          <Form.Item label={t('platform_expires', 'Expires at (optional)')}>
            <DatePicker
              style={{ width: '100%' }}
              value={expiresAt ? dayjs(expiresAt) : null}
              onChange={d => setExpiresAt(d ? d.toISOString() : null)}
            />
          </Form.Item>

          <Button type="primary" loading={saving} onClick={save}>
            {t('save', 'Save license')}
          </Button>
        </Form>
      </SectionCard>
    </div>
  );
}
