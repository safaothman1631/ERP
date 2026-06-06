import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Space, Typography, Row, Col, Slider, Alert, Empty, Descriptions } from 'antd';
import { message } from '../../utils/message';
import { ThunderboltOutlined, LinkOutlined, CloseOutlined, ArrowLeftOutlined, InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, SectionCard, StatusTag } from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const { Text } = Typography;

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  reference: string;
  transaction_type: string;
  matched: boolean;
}

interface Candidate {
  type: string;
  target_id: string;
  score: number;
  suggested_action: string;
  suggested_amount: number;
  reason: string;
  invoice_number?: string;
  bill_number?: string;
  contact_name?: string;
  vendor_name?: string;
  rule_name?: string;
  target_account?: string;
}

const SmartMatch: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { accountId } = useParams<{ accountId: string }>();

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selectedTxn, setSelectedTxn] = useState<BankTransaction | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [threshold, setThreshold] = useState(90);
  const [autoMatching, setAutoMatching] = useState(false);
  const [autoResult, setAutoResult] = useState<{ matched: number; ambiguous: number; no_match: number; total: number } | null>(null);

  useEffect(() => {
    fetchUnmatched();
  }, [accountId]);

  const fetchUnmatched = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/api/banking/transactions`, {
        params: { bank_account_id: accountId, page_size: 200 }
      });
      const unmatched = (r.data.items || []).filter((txn: BankTransaction) => !txn.matched);
      setTransactions(unmatched);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTxn = async (txn: BankTransaction) => {
    setSelectedTxn(txn);
    setCandidatesLoading(true);
    try {
      const r = await api.get(`/api/banking/transactions/${txn.id}/match-candidates`);
      setCandidates(r.data.candidates || []);
    } catch {
      message.error(t('error'));
      setCandidates([]);
    } finally {
      setCandidatesLoading(false);
    }
  };

  const handleMatch = async (candidate: Candidate) => {
    if (!selectedTxn) return;
    try {
      await api.post(`/api/banking/transactions/${selectedTxn.id}/match`, {
        match_type: candidate.type,
        target_id: candidate.target_id,
        action: candidate.suggested_action,
        notes: `Auto-matched: ${candidate.reason}`
      });
      message.success(t('match_success'));
      setSelectedTxn(null);
      setCandidates([]);
      fetchUnmatched();
    } catch {
      message.error(t('error'));
    }
  };

  const handleAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const r = await api.post(`/api/banking/accounts/${accountId}/auto-match-new`, {
        threshold,
        dry_run: false
      });
      setAutoResult(r.data);
      message.success(`${t('matched')}: ${r.data.matched}, ${t('ambiguous')}: ${r.data.ambiguous}, ${t('no_match')}: ${r.data.no_match}`);
      fetchUnmatched();
    } catch {
      message.error(t('error'));
    } finally {
      setAutoMatching(false);
    }
  };

  const fmtIQD = (v: number) => `${new Intl.NumberFormat('en-US').format(v || 0)} د.ع`;

  const txnColumns = [
    { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10), width: 120 },
    { title: t('description'), dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: t('amount'),
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      render: (v: number) => <span style={{ color: v >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>{fmtIQD(v)}</span>
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_: unknown, r: BankTransaction) => (
        <Button size="small" type={selectedTxn?.id === r.id ? 'primary' : 'default'} onClick={() => handleSelectTxn(r)}>
          {selectedTxn?.id === r.id ? t('selected') : t('select')}
        </Button>
      )
    }
  ];

  const candidateColumns = [
    {
      title: t('type'),
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (v: string) => <StatusTag status={v === 'invoice' ? 'info' : v === 'bill' ? 'warning' : 'success'} label={t(v)} />
    },
    {
      title: t('target'),
      key: 'target',
      render: (_: unknown, c: Candidate) => (
        <div>
          <Text strong>{c.invoice_number || c.bill_number || c.rule_name || c.target_id}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{c.contact_name || c.vendor_name || c.target_account}</Text>
        </div>
      )
    },
    {
      title: t('score'),
      dataIndex: 'score',
      key: 'score',
      width: 80,
      render: (v: number) => (
        <StatusTag status={v >= 90 ? 'success' : v >= 70 ? 'warning' : 'default'} label={String(v)} />
      )
    },
    {
      title: t('reason'),
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_: unknown, c: Candidate) => (
        <Button type="primary" size="small" icon={<LinkOutlined />} onClick={() => handleMatch(c)}>
          {t('match')}
        </Button>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title={t('smart_match')}
        subtitle={t('smart_match_subtitle', 'Intelligent transaction matching')}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/banking/${accountId}/reconciliation`)}>
              {t('back')}
            </Button>
          </Space>
        }
      />

      <SectionCard style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={12}>
            <Text strong>{t('auto_match_threshold')}: {threshold}%</Text>
            <Slider
              min={50}
              max={100}
              step={5}
              value={threshold}
              onChange={setThreshold}
              marks={{ 50: '50%', 70: '70%', 90: '90%', 100: '100%' }}
            />
          </Col>
          <Col span={12} style={{ textAlign: 'start' }}>
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              loading={autoMatching}
              onClick={handleAutoMatch}
              disabled={transactions.length === 0}
            >
              {t('auto_match_all')}
            </Button>
          </Col>
        </Row>

        {autoResult && (
          <Alert
            message={t('auto_match_result')}
            description={
              <Space direction="vertical">
                <Text>{t('matched')}: <strong style={{ color: 'var(--success-fg)' }}>{autoResult.matched}</strong></Text>
                <Text>{t('ambiguous')}: <strong style={{ color: 'var(--warning-fg)' }}>{autoResult.ambiguous}</strong></Text>
                <Text>{t('no_match')}: <strong style={{ color: 'var(--danger-fg)' }}>{autoResult.no_match}</strong></Text>
                <Text>{t('total')}: <strong>{autoResult.total}</strong></Text>
              </Space>
            }
            type="info"
            showIcon
            closable
            onClose={() => setAutoResult(null)}
            style={{ marginTop: 16 }}
          />
        )}
      </SectionCard>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <SectionCard
            title={`${t('unmatched_transactions')} (${transactions.length})`}
            padded={false}
          >
            <ResponsiveTableAdapter
              dataSource={transactions}
              columns={txnColumns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              size="small"
              locale={{
                emptyText: (
                  <Empty
                    image={<InboxOutlined style={{ fontSize: 48, color: 'var(--ink-300)' }} />}
                    description={<Text type="secondary">{t('all_matched')}</Text>}
                  />
                )
              }}
            />
          </SectionCard>
        </Col>

        <Col xs={24} lg={12}>
          <SectionCard
            title={t('match_candidates')}
          >
            {!selectedTxn ? (
              <Empty
                image={<LinkOutlined style={{ fontSize: 48, color: 'var(--ink-300)' }} />}
                description={<Text type="secondary">{t('select_transaction_first')}</Text>}
              />
            ) : (
              <>
                <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
                  <Descriptions.Item label={t('date')}>{selectedTxn.date?.substring(0, 10)}</Descriptions.Item>
                  <Descriptions.Item label={t('description')}>{selectedTxn.description}</Descriptions.Item>
                  <Descriptions.Item label={t('amount')}>
                    <span style={{ color: selectedTxn.amount >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                      {fmtIQD(selectedTxn.amount)}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('reference')}>{selectedTxn.reference || '-'}</Descriptions.Item>
                </Descriptions>

                <ResponsiveTableAdapter
                  dataSource={candidates}
                  columns={candidateColumns}
                  rowKey="target_id"
                  loading={candidatesLoading}
                  pagination={false}
                  size="small"
                  locale={{
                    emptyText: (
                      <Empty
                        image={<CloseOutlined style={{ fontSize: 48, color: 'var(--ink-300)' }} />}
                        description={<Text type="secondary">{t('no_candidates')}</Text>}
                      />
                    )
                  }}
                />
              </>
            )}
          </SectionCard>
        </Col>
      </Row>
    </div>
  );
};

export default SmartMatch;
