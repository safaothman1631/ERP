import React from 'react';
import { Tooltip, Button, Dropdown, Spin, Tag } from 'antd';
import { BankOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useOrgStore, type Company } from '../stores/orgStore';
import { palette } from '../theme/tokens';

interface EntitySwitcherProps {
  isRTL: boolean;
}

/**
 * EntitySwitcher — dropdown selector for legal entities (companies) within the org.
 * Loads from GET /api/companies; switch via POST /api/companies/{id}/switch.
 */
export const EntitySwitcher: React.FC<EntitySwitcherProps> = ({ isRTL }) => {
  const { t } = useTranslation();
  const currentCompany = useOrgStore((s) => s.currentCompany);
  const setCurrentCompany = useOrgStore((s) => s.setCurrentCompany);

  const [companies, setCompanies] = React.useState<Company[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [switching, setSwitching] = React.useState(false);

  const loadCompanies = React.useCallback(async () => {
    if (companies !== null || loading) return;
    setLoading(true);
    try {
      const { default: api } = await import('../api');
      const res = await api.get('/api/companies');
      const list = Array.isArray(res.data) ? res.data : [];
      setCompanies(
        list.map((c: Company) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          is_primary: c.is_primary,
        }))
      );
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [companies, loading]);

  const switchCompany = async (company: Company) => {
    setSwitching(true);
    try {
      const { default: api } = await import('../api');
      await api.post(`/api/companies/${company.id}/switch`);
      setCurrentCompany(company);
    } catch {
      // keep current selection on failure
    } finally {
      setSwitching(false);
    }
  };

  const items = React.useMemo(() => {
    if (loading || switching) {
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
            {t('entity_switcher.companies', 'Companies')}
          </span>
        ),
        disabled: true,
      },
    ];

    (companies ?? []).forEach((c) => {
      const isCurrent = currentCompany?.id === c.id;
      list.push({
        key: c.id,
        icon: isCurrent ? (
          <CheckOutlined style={{ color: palette.success }} />
        ) : (
          <BankOutlined />
        ),
        label: (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 160 }}>
            <span style={{ fontWeight: 500 }}>{c.name}</span>
            {c.code && (
              <span style={{ fontSize: 11, color: palette.ink500 }}>{c.code}</span>
            )}
            {isCurrent && (
              <Tag
                color="blue"
                style={{ marginTop: 2, width: 'fit-content', fontSize: 10 }}
              >
                {t('entity_switcher.current', 'Current')}
              </Tag>
            )}
          </div>
        ),
        onClick: () => void switchCompany(c),
      });
    });

    if ((companies ?? []).length === 0 && !loading) {
      list.push({
        key: 'empty',
        label: (
          <span style={{ color: palette.ink500, fontSize: 12 }}>
            {t('entity_switcher.no_companies', 'No companies')}
          </span>
        ),
        disabled: true,
      });
    }

    return list;
  }, [companies, loading, switching, currentCompany, t]);

  const label =
    currentCompany?.name ?? t('entity_switcher.select', 'Company');

  return (
    <Dropdown
      menu={{ items }}
      placement={isRTL ? 'bottomLeft' : 'bottomRight'}
      trigger={['click']}
      onOpenChange={(open) => {
        if (open) void loadCompanies();
      }}
    >
      <Tooltip title={t('entity_switcher.select', 'Company')}>
        <Button
          type="text"
          icon={<BankOutlined />}
          aria-label={t('entity_switcher.select', 'Company')}
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

export default EntitySwitcher;
