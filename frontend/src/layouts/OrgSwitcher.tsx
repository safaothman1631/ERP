import React from 'react';
import { Tooltip, Button, Dropdown, Spin, message } from 'antd';
import { BankOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuthStore } from '../store';
import { palette } from '../theme/tokens';

interface OrgItem {
  id: string;
  name: string;
  is_current: boolean;
  role: string;
  logo_url?: string | null;
}

interface OrgSwitcherProps {
  isRTL: boolean;
}

/**
 * OrgSwitcher — Sprint 3 — backend-aware multi-org dropdown.
 * Fetches /api/system/organizations on first open. If only one org, shows
 * read-only label with "Manage settings" action. If multi-org, allows switching.
 */
export const OrgSwitcher: React.FC<OrgSwitcherProps> = ({ isRTL }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const orgId = useAuthStore((s) => s.orgId);
  const [orgs, setOrgs] = React.useState<OrgItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadOnce = React.useCallback(async () => {
    if (orgs !== null || loading) return;
    setLoading(true);
    try {
      const res = await api.get('/api/system/organizations');
      setOrgs(res.data?.organizations || []);
    } catch {
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, [orgs, loading]);

  const switchTo = (target: OrgItem) => {
    if (target.is_current) return;
    // Multi-org switching not implemented in backend yet; signal future support.
    message.info(t('org_switcher.switch_unavailable', 'Multi-org switching coming soon'));
  };

  const items = React.useMemo(() => {
    if (loading) {
      return [{ key: 'loading', label: <Spin size="small" />, disabled: true }];
    }
    const list: any[] = [];
    list.push({
      key: 'header',
      label: (
        <span style={{ fontWeight: 600, fontSize: 12, color: palette.ink500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {t('org_switcher.your_organizations', 'Your organizations')}
        </span>
      ),
      disabled: true,
    });
    (orgs ?? []).forEach((o) => {
      list.push({
        key: o.id,
        icon: o.is_current ? <CheckOutlined style={{ color: palette.success }} /> : <BankOutlined />,
        label: (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
            <span style={{ fontWeight: 500 }}>{o.name}</span>
            <span style={{ fontSize: 11, color: palette.ink500 }}>
              {o.role}{o.is_current ? ` · ${t('org_switcher.current', 'Current')}` : ''}
            </span>
          </div>
        ),
        onClick: () => switchTo(o),
      });
    });
    list.push({ type: 'divider' });
    list.push({
      key: 'manage',
      icon: <BankOutlined />,
      label: t('org_switcher.manage', 'Manage organization'),
      onClick: () => navigate('/settings'),
    });
    return list;
  }, [orgs, loading, navigate, t]);

  return (
    <Dropdown
      menu={{ items }}
      placement={isRTL ? 'bottomLeft' : 'bottomRight'}
      trigger={['click']}
      onOpenChange={(open) => { if (open) void loadOnce(); }}
    >
      <Tooltip title={t('topbar.org_switcher', 'Organization')}>
        <Button type="text" shape="circle" icon={<BankOutlined />} aria-label={t('topbar.org_switcher', 'Organization')} />
      </Tooltip>
    </Dropdown>
  );
};

export default OrgSwitcher;
