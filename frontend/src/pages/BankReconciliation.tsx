import React, { useState } from 'react';
import { Button, Row, Col, Space, Checkbox, Empty, Typography } from 'antd';
import { message } from '../utils/message';
import { SyncOutlined, CheckCircleOutlined, LinkOutlined, BankOutlined, DollarOutlined, WarningOutlined, InboxOutlined, CloudUploadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { PageHeader, KpiCard, SectionCard, StatusTag, FilterBar } from '../design-system';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';

const { Text } = Typography;

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  matched?: boolean;
}

interface ReconciliationSummary {
  opening_balance: number;
  closing_balance: number;
  system_balance: number;
  difference: number;
}

const BankReconciliation: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [bankTransactions, setBankTransactions] = useState<Transaction[]>([]);
  const [systemTransactions, setSystemTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary>({ opening_balance: 0, closing_balance: 0, system_balance: 0, difference: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<string[]>([]);
  const [matching, setMatching] = useState(false);
  const [completing, setCompleting] = useState(false);

  const fetchReconciliation = async (accountId: string) => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [bank, system, sum] = await Promise.all([
        api.get(`/api/banking/accounts/${accountId}/statements`, { params: { status: 'unreconciled' } }),
        api.get(`/api/banking/accounts/${accountId}/transactions`, { params: { status: 'unreconciled' } }),
        api.get(`/api/banking/accounts/${accountId}/reconciliation-summary`),
      ]);
      setBankTransactions(bank.data.items || bank.data);
      setSystemTransactions(system.data.items || system.data);
      setSummary(sum.data);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAccountChange = (value: string) => {
    setSelectedAccount(value);
    setSelectedBank([]);
    setSelectedSystem([]);
    fetchReconciliation(value);
  };

  const handleAutoMatch = async () => {
    if (!selectedAccount) return;
    setMatching(true);
    try {
      await api.post(`/api/banking/accounts/${selectedAccount}/auto-match`);
      message.success(t('success'));
      fetchReconciliation(selectedAccount);
    } catch {
      message.error(t('error'));
    } finally {
      setMatching(false);
    }
  };

  const handleManualMatch = async () => {
    if (!selectedAccount || selectedBank.length === 0 || selectedSystem.length === 0) return;
    setMatching(true);
    try {
      await api.post(`/api/banking/accounts/${selectedAccount}/match`, {
        bank_transaction_ids: selectedBank,
        system_transaction_ids: selectedSystem,
      });
      message.success(t('success'));
      setSelectedBank([]);
      setSelectedSystem([]);
      fetchReconciliation(selectedAccount);
    } catch {
      message.error(t('error'));
    } finally {
      setMatching(false);
    }
  };


  const handleComplete = async () => {
    if (!selectedAccount) return;
    setCompleting(true);
    try {
      await api.post(`/api/banking/accounts/${selectedAccount}/complete-reconciliation`);
      message.success(t('completeReconciliation') + ' — ' + t('success'));
      fetchReconciliation(selectedAccount);
    } catch {
      message.error(t('error'));
    } finally {
      setCompleting(false);
    }
  };

  const fmtIQD = (v: number) => `${new Intl.NumberFormat('en-US').format(v || 0)} د.ع`;

  const bankColumns = [
    {
      title: '',
      key: 'select',
      width: 40,
      render: (_: unknown, r: Transaction) => (
        <Checkbox
          checked={selectedBank.includes(r.id)}
          onChange={e => {
            setSelectedBank(e.target.checked ? [...selectedBank, r.id] : selectedBank.filter(x => x !== r.id));
          }}
        />
      ),
    },
    { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
    { title: t('description'), dataIndex: 'description', key: 'description' },
    {
      title: t('amount'), dataIndex: 'amount', key: 'amount',
      render: (v: number) => <span style={{ color: v >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>{fmtIQD(v)}</span>,
    },
  ];

  const systemColumns = [
    {
      title: '',
      key: 'select',
      width: 40,
      render: (_: unknown, r: Transaction) => (
        <Checkbox
          checked={selectedSystem.includes(r.id)}
          onChange={e => {
            setSelectedSystem(e.target.checked ? [...selectedSystem, r.id] : selectedSystem.filter(x => x !== r.id));
          }}
        />
      ),
    },
    { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
    { title: t('description'), dataIndex: 'description', key: 'description' },
    {
      title: t('amount'), dataIndex: 'amount', key: 'amount',
      render: (v: number) => <span style={{ color: v >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>{fmtIQD(v)}</span>,
    },
    { title: t('type'), dataIndex: 'type', key: 'type', render: (v: string) => <StatusTag status="default" label={t(v, v)} /> },
  ];

  return (
    <div>
      <PageHeader 
        title={t('reconciliation')} 
        subtitle={t('reconciliation_subtitle', 'Reconcile bank accounts')}
        extra={
          selectedAccount ? (
            <Space>
              <Button icon={<CloudUploadOutlined />} onClick={() => navigate(`/banking/${selectedAccount}/import`)}>
                {t('import_statement')}
              </Button>
              <Button icon={<ThunderboltOutlined />} onClick={() => navigate(`/banking/${selectedAccount}/match`)}>
                {t('smart_match')}
              </Button>
            </Space>
          ) : undefined
        }
      />
      <FilterBar
        extra={
          <>
            <SelectWithQuickCreate
              entity="bank_account"
              placeholder={t('account')}
              value={selectedAccount || undefined}
              onChange={handleAccountChange}
              style={{ width: 240 }}
            />
            <Button icon={<SyncOutlined />} loading={matching} onClick={handleAutoMatch} disabled={!selectedAccount}>
              {t('autoMatch')}
            </Button>
            <Button
              icon={<LinkOutlined />}
              onClick={handleManualMatch}
              disabled={selectedBank.length === 0 || selectedSystem.length === 0}
              loading={matching}
            >
              {t('match')}
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleComplete}
              disabled={!selectedAccount}
              loading={completing}
            >
              {t('completeReconciliation')}
            </Button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-md)', marginBlockEnd: 'var(--space-lg)' }}>
        <KpiCard
          title={t('closing_balance')}
          value={summary.closing_balance}
          icon={<BankOutlined />}
          tone="primary"
          suffix=" د.ع"
        />
        <KpiCard
          title={t('system_balance')}
          value={summary.system_balance}
          icon={<DollarOutlined />}
          tone="success"
          suffix=" د.ع"
        />
        <KpiCard
          title={t('difference')}
          value={summary.difference}
          icon={summary.difference === 0 ? <CheckCircleOutlined /> : <WarningOutlined />}
          tone={summary.difference === 0 ? 'success' : 'danger'}
          suffix=" د.ع"
        />
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <SectionCard
            title={<><BankOutlined /> {t('bank_statement')}</>}
            padded={false}
          >
            <ResponsiveTableAdapter
              dataSource={bankTransactions}
              columns={bankColumns}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="small"
              locale={{
                emptyText: (
                  <Empty
                    image={<InboxOutlined style={{ fontSize: 36, color: 'var(--ink-300)' }} />}
                    description={<Text type="secondary">{t('no_data')}</Text>}
                  />
                ),
              }}
            />
          </SectionCard>
        </Col>
        <Col xs={24} lg={12}>
          <SectionCard
            title={<><DollarOutlined /> {t('system_transactions')}</>}
            padded={false}
          >
            <ResponsiveTableAdapter
              dataSource={systemTransactions}
              columns={systemColumns}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="small"
              locale={{
                emptyText: (
                  <Empty
                    image={<InboxOutlined style={{ fontSize: 36, color: 'var(--ink-300)' }} />}
                    description={<Text type="secondary">{t('no_data')}</Text>}
                  />
                ),
              }}
            />
          </SectionCard>
        </Col>
      </Row>
    </div>
  );
};

export default BankReconciliation;
