import React from 'react';
import { Tooltip, Button, Dropdown, Spin, Tag } from 'antd';
import { ApartmentOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useOrgStore } from '../stores/orgStore';
import { palette, space } from '../theme/tokens';

interface BranchItem {
  id: string;
  name: string;
  address?: string;
}

interface BranchSwitcherProps {
  isRTL: boolean;
}

/**
 * BranchSwitcher — dropdown selector for branches within the current org.
 * Reads currentOrg and currentBranch from orgStore; allows switching branches.
 * Requirements: 4.9
 */
export const BranchSwitcher: React.FC<BranchSwitcherProps> = ({ isRTL }) => {
  const { t } = useTranslation();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const currentBranch = useOrgStore((s) => s.currentBranch);
  const setCurrentBranch = useOrgStore((s) => s.setCurrentBranch);

  const [branches, setBranches] = React.useState<BranchItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Lazily load branches when dropdown opens
  const loadBranches = React.useCallback(async () => {
    if (branches !== null || loading || !currentOrg) return;
    setLoading(true);
    try {
      // Attempt to fetch from backend; fall back to mock data if unavailable
      const { default: api } = await import('../api');
      const res = await api.get(`/api/system/branches?org_id=${currentOrg.id}`);
      setBranches(res.data?.branches ?? []);
    } catch {
      // Fallback: show a single "Main Branch" entry so the UI is always functional
      setBranches([
        { id: 'main', name: t('branch_switcher.main_branch', 'Main branch'), address: '' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [branches, loading, currentOrg, t]);

  const switchBranch = (branch: BranchItem) => {
    if (!currentOrg) return;
    setCurrentBranch({
      id: branch.id,
      name: branch.name,
      orgId: currentOrg.id,
      address: branch.address,
    });
  };

  const items = React.useMemo(() => {
    if (loading) {
      return [{ key: 'loading', label: <Spin size="small" />, disabled: true }];
    }

    const list: any[] = [
      {
        key: 'header',
        label: (
          <span
            style={{
              fontWeight: 600,
              fontSize: 12,
              color: palette.ink500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('branch_switcher.branches', 'Branches')}
          </span>
        ),
        disabled: true,
      },
    ];

    (branches ?? []).forEach((b) => {
      const isCurrent = currentBranch?.id === b.id;
      list.push({
        key: b.id,
        icon: isCurrent ? (
          <CheckOutlined style={{ color: palette.success }} />
        ) : (
          <ApartmentOutlined />
        ),
        label: (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 160 }}>
            <span style={{ fontWeight: 500 }}>{b.name}</span>
            {b.address && (
              <span style={{ fontSize: 11, color: palette.ink500 }}>{b.address}</span>
            )}
            {isCurrent && (
              <Tag
                color="blue"
                style={{ marginTop: 2, width: 'fit-content', fontSize: 10 }}
              >
                {t('branch_switcher.current', 'Current')}
              </Tag>
            )}
          </div>
        ),
        onClick: () => switchBranch(b),
      });
    });

    if ((branches ?? []).length === 0 && !loading) {
      list.push({
        key: 'empty',
        label: (
          <span style={{ color: palette.ink500, fontSize: 12 }}>
            {t('branch_switcher.no_branches', 'No branches')}
          </span>
        ),
        disabled: true,
      });
    }

    return list;
  }, [branches, loading, currentBranch, t]);

  const label = currentBranch?.name ?? t('branch_switcher.select', 'Branch');

  return (
    <Dropdown
      menu={{ items }}
      placement={isRTL ? 'bottomLeft' : 'bottomRight'}
      trigger={['click']}
      onOpenChange={(open) => {
        if (open) void loadBranches();
      }}
    >
      <Tooltip title={t('topbar.branch_switcher', 'Branch')}>
        <Button
          type="text"
          icon={<ApartmentOutlined />}
          aria-label={t('topbar.branch_switcher', 'Branch')}
          style={{ maxWidth: 140 }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              maxWidth: 90,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'inline-block',
              verticalAlign: 'middle',
            }}
          >
            {label}
          </span>
        </Button>
      </Tooltip>
    </Dropdown>
  );
};

export default BranchSwitcher;
