/**
 * Step 3 — Chart of Accounts (T-LR.3.8)
 *
 * Spec: launch-readiness design.md §4.5
 *
 * Five template cards: small / medium / restaurant / pharmacy / construction.
 * Selecting a card shows a preview tree (top-level structure). Confirming
 * calls `POST /api/onboarding/coa/apply` (owned by backend agent T-LR.3.7).
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, Button, Tree, Tag, Space, Alert, Spin, message } from 'antd';
import { CheckCircleOutlined, ShopOutlined, MedicineBoxOutlined, CoffeeOutlined, BuildOutlined, AppstoreOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { useOnboardingWizardStore, type COATemplateId } from '../state';

interface TemplateCard {
  id: COATemplateId;
  icon: React.ReactNode;
  accounts: number;
  recommended_for: string[];
  // Top-level preview (codes + i18n key suffix for the name)
  preview: Array<{ code: string; nameKey: string; isHeader?: boolean; children?: Array<{ code: string; nameKey: string }> }>;
}

const TEMPLATES: TemplateCard[] = [
  {
    id: 'small_general_trade',
    icon: <ShopOutlined />,
    accounts: 40,
    recommended_for: ['retail', 'services'],
    preview: [
      { code: '10000', nameKey: 'assets', isHeader: true, children: [
        { code: '10100', nameKey: 'cash' },
        { code: '10200', nameKey: 'bank_main' },
        { code: '10300', nameKey: 'ar' },
        { code: '10400', nameKey: 'inventory' },
      ] },
      { code: '20000', nameKey: 'liabilities', isHeader: true, children: [
        { code: '20100', nameKey: 'ap' },
      ] },
      { code: '30000', nameKey: 'equity', isHeader: true },
      { code: '40000', nameKey: 'revenue', isHeader: true, children: [
        { code: '40100', nameKey: 'sales_revenue' },
      ] },
      { code: '50000', nameKey: 'expenses', isHeader: true, children: [
        { code: '50100', nameKey: 'cogs' },
        { code: '50200', nameKey: 'rent' },
      ] },
    ],
  },
  {
    id: 'medium_general_trade',
    icon: <AppstoreOutlined />,
    accounts: 80,
    recommended_for: ['retail', 'wholesale'],
    preview: [
      { code: '10000', nameKey: 'assets', isHeader: true, children: [
        { code: '10100', nameKey: 'cash' },
        { code: '10150', nameKey: 'petty_cash' },
        { code: '10200', nameKey: 'bank_main' },
        { code: '10210', nameKey: 'bank_secondary' },
        { code: '10300', nameKey: 'ar' },
        { code: '10400', nameKey: 'inventory' },
      ] },
      { code: '20000', nameKey: 'liabilities', isHeader: true },
      { code: '30000', nameKey: 'equity', isHeader: true },
      { code: '40000', nameKey: 'revenue', isHeader: true },
      { code: '50000', nameKey: 'expenses', isHeader: true },
    ],
  },
  {
    id: 'restaurant_cafe',
    icon: <CoffeeOutlined />,
    accounts: 60,
    recommended_for: ['restaurant'],
    preview: [
      { code: '10000', nameKey: 'assets', isHeader: true, children: [
        { code: '10100', nameKey: 'cash' },
        { code: '10400', nameKey: 'food_inventory' },
        { code: '10410', nameKey: 'beverage_inventory' },
      ] },
      { code: '40000', nameKey: 'revenue', isHeader: true, children: [
        { code: '40100', nameKey: 'food_revenue' },
        { code: '40200', nameKey: 'beverage_revenue' },
        { code: '40300', nameKey: 'delivery_revenue' },
      ] },
      { code: '50000', nameKey: 'expenses', isHeader: true, children: [
        { code: '50100', nameKey: 'food_cost' },
        { code: '50200', nameKey: 'beverage_cost' },
        { code: '50300', nameKey: 'tips_payable' },
      ] },
    ],
  },
  {
    id: 'pharmacy',
    icon: <MedicineBoxOutlined />,
    accounts: 70,
    recommended_for: ['pharmacy'],
    preview: [
      { code: '10000', nameKey: 'assets', isHeader: true, children: [
        { code: '10300', nameKey: 'ar' },
        { code: '10350', nameKey: 'insurance_receivable' },
        { code: '10400', nameKey: 'inventory' },
        { code: '10410', nameKey: 'controlled_inventory' },
      ] },
      { code: '40000', nameKey: 'revenue', isHeader: true },
      { code: '50000', nameKey: 'expenses', isHeader: true },
    ],
  },
  {
    id: 'construction_contractor',
    icon: <BuildOutlined />,
    accounts: 120,
    recommended_for: ['manufacturing', 'services'],
    preview: [
      { code: '10000', nameKey: 'assets', isHeader: true, children: [
        { code: '10500', nameKey: 'wip' },
        { code: '10600', nameKey: 'retention_receivable' },
      ] },
      { code: '20000', nameKey: 'liabilities', isHeader: true, children: [
        { code: '20100', nameKey: 'ap' },
        { code: '20300', nameKey: 'subcontractor_payable' },
        { code: '20400', nameKey: 'retention_payable' },
      ] },
    ],
  },
];

interface ApplyResponse {
  applied: boolean;
  accounts_created: number;
  template: string;
}

export default function StepChartOfAccounts() {
  const { t } = useTranslation('onboarding');
  const coa = useOnboardingWizardStore((s) => s.data.coa);
  const setCOA = useOnboardingWizardStore((s) => s.setCOA);

  const [picked, setPicked] = useState<COATemplateId | null>(coa?.template ?? null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(!!coa?.accounts_created);
  const [accountsCreated, setAccountsCreated] = useState<number>(coa?.accounts_created ?? 0);

  useEffect(() => {
    setPicked(coa?.template ?? null);
    setApplied(!!coa?.accounts_created);
    setAccountsCreated(coa?.accounts_created ?? 0);
  }, [coa]);

  const previewTree: DataNode[] = useMemo(() => {
    const tpl = TEMPLATES.find((tt) => tt.id === picked);
    if (!tpl) return [];
    return tpl.preview.map((n) => ({
      key: n.code,
      title: `${n.code} — ${t(`coa.accounts.${n.nameKey}`)}`,
      children: n.children?.map((c) => ({
        key: c.code,
        title: `${c.code} — ${t(`coa.accounts.${c.nameKey}`)}`,
      })),
    }));
  }, [picked, t]);

  const onApply = async () => {
    if (!picked) return;
    setApplying(true);
    try {
      const res = await api.post<ApplyResponse>('/api/onboarding/coa/apply', { template: picked });
      const created = res.data?.accounts_created ?? 0;
      setApplied(true);
      setAccountsCreated(created);
      setCOA({
        template: picked,
        accounts_created: created,
        applied_at: new Date().toISOString(),
      });
      message.success(t('coa.applied_success', { count: created }));
    } catch {
      message.error(t('coa.applied_error'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {TEMPLATES.map((tpl) => {
          const isPicked = tpl.id === picked;
          return (
            <Card
              key={tpl.id}
              hoverable
              onClick={() => !applying && !applied && setPicked(tpl.id)}
              role="button"
              tabIndex={0}
              aria-pressed={isPicked}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !applying && !applied) {
                  e.preventDefault();
                  setPicked(tpl.id);
                }
              }}
              style={{
                borderColor: isPicked ? '#2563eb' : undefined,
                borderWidth: isPicked ? 2 : 1,
                opacity: applied && !isPicked ? 0.5 : 1,
              }}
            >
              <Space direction="vertical" size="small">
                <div style={{ fontSize: 28 }}>{tpl.icon}</div>
                <strong>{t(`coa.templates.${tpl.id}.name`)}</strong>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {t(`coa.templates.${tpl.id}.description`)}
                </span>
                <Space size={4} wrap>
                  <Tag color="blue">{t('coa.accounts_count', { count: tpl.accounts })}</Tag>
                  {tpl.recommended_for.map((rf) => (
                    <Tag key={rf}>{t(`company.business_type.options.${rf}`)}</Tag>
                  ))}
                </Space>
                {isPicked && <CheckCircleOutlined style={{ color: '#16a34a' }} />}
              </Space>
            </Card>
          );
        })}
      </div>

      {picked && (
        <Card title={t('coa.preview_title')} size="small">
          <Tree treeData={previewTree} defaultExpandAll selectable={false} />
        </Card>
      )}

      {!applied && picked && (
        <Button type="primary" size="large" loading={applying} onClick={onApply}>
          {applying ? <Spin size="small" /> : null}
          {t('coa.apply_cta')}
        </Button>
      )}

      {applied && accountsCreated > 0 && (
        <Alert
          type="success"
          showIcon
          message={t('coa.success_title')}
          description={t('coa.success_detail', { count: accountsCreated })}
        />
      )}
    </Space>
  );
}
