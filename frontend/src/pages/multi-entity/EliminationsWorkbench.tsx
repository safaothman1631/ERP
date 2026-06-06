import { useEffect, useState } from 'react';
import { Button, Space, Popconfirm, Alert } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { PageHeader, SectionCard, StatusTag } from '../../design-system';
import api from '../../api';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

interface ICTransaction {
  id: string;
  from_company_id: string;
  to_company_id: string;
  amount: number;
  currency: string;
  description: string;
  reference: string;
  date: string;
  eliminated?: boolean;
}

interface Company {
  id: string;
  name: string;
}

interface PairedTransaction {
  id: string;
  from: ICTransaction;
  to?: ICTransaction;
  matched: boolean;
  canEliminate: boolean;
}

const EliminationsWorkbench = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [_transactions, setTransactions] = useState<ICTransaction[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [pairs, setPairs] = useState<PairedTransaction[]>([]);

  const fetchCompanies = async () => {
    try {
      const { data } = await api.get('/api/companies');
      setCompanies(data);
    } catch (_err) {
      message.error(t('multi_entity.error_loading_companies'));
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/companies/intercompany');
      setTransactions(data);
      buildPairs(data);
    } catch (_err) {
      message.error(t('multi_entity.error_loading_ic_transactions'));
    } finally {
      setLoading(false);
    }
  };

  const buildPairs = (txns: ICTransaction[]) => {
    // Simple pairing: look for matching amount and opposite direction
    const paired: PairedTransaction[] = [];
    const processed = new Set<string>();

    txns.forEach((tx) => {
      if (processed.has(tx.id)) return;
      
      // Find reverse transaction
      const reverse = txns.find(
        (t) =>
          !processed.has(t.id) &&
          t.id !== tx.id &&
          t.from_company_id === tx.to_company_id &&
          t.to_company_id === tx.from_company_id &&
          Math.abs(t.amount - tx.amount) < 0.01 &&
          t.currency === tx.currency
      );

      if (reverse) {
        paired.push({
          id: `${tx.id}_${reverse.id}`,
          from: tx,
          to: reverse,
          matched: true,
          canEliminate: !tx.eliminated && !reverse.eliminated,
        });
        processed.add(tx.id);
        processed.add(reverse.id);
      } else {
        paired.push({
          id: tx.id,
          from: tx,
          matched: false,
          canEliminate: false,
        });
        processed.add(tx.id);
      }
    });

    setPairs(paired);
  };

  useEffect(() => {
    fetchCompanies();
    fetchTransactions();
  }, []);

  const getCompanyName = (id: string) => {
    return companies.find((c) => c.id === id)?.name || id;
  };

  const handleEliminate = async (pair: PairedTransaction) => {
    try {
      await api.post(`/api/companies/intercompany/${pair.from.id}/eliminate`);
      if (pair.to) {
        await api.post(`/api/companies/intercompany/${pair.to.id}/eliminate`);
      }
      message.success(t('multi_entity.elimination_successful'));
      fetchTransactions();
    } catch (_err) {
      message.error(t('multi_entity.error_eliminating'));
    }
  };

  const columns: ColumnsType<PairedTransaction> = [
    {
      title: t('multi_entity.date'),
      dataIndex: ['from', 'date'],
      key: 'date',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: t('multi_entity.transaction_pair'),
      key: 'pair',
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <div>
            <StatusTag status="info" label={t('multi_entity.outgoing')} />
            {' '}{getCompanyName(record.from.from_company_id)} → {getCompanyName(record.from.to_company_id)}
          </div>
          {record.to && (
            <div>
              <StatusTag status="success" label={t('multi_entity.incoming')} />
              {' '}{getCompanyName(record.to.from_company_id)} → {getCompanyName(record.to.to_company_id)}
            </div>
          )}
        </Space>
      ),
    },
    {
      title: t('multi_entity.amount'),
      dataIndex: ['from', 'amount'],
      key: 'amount',
      render: (amount, record) => `${amount.toLocaleString()} ${record.from.currency}`,
    },
    {
      title: t('multi_entity.description'),
      dataIndex: ['from', 'description'],
      key: 'description',
    },
    {
      title: t('multi_entity.matched'),
      dataIndex: 'matched',
      key: 'matched',
      render: (matched) => (
        <StatusTag
          status={matched ? 'success' : 'warning'}
          icon={matched ? <CheckOutlined /> : <CloseOutlined />}
          label={matched ? t('multi_entity.matched_yes') : t('multi_entity.matched_no')}
        />
      ),
    },
    {
      title: t('multi_entity.eliminated'),
      key: 'eliminated',
      render: (_, record) => (
        <StatusTag
          status={record.from.eliminated ? 'success' : 'default'}
          label={record.from.eliminated ? t('multi_entity.eliminated_yes') : t('multi_entity.eliminated_no')}
        />
      ),
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.canEliminate && (
            <Popconfirm
              title={t('multi_entity.confirm_eliminate')}
              onConfirm={() => handleEliminate(record)}
            >
              <Button type="primary" size="small">
                {t('multi_entity.eliminate')}
              </Button>
            </Popconfirm>
          )}
          {record.from.eliminated && (
            <StatusTag status="success" label={t('multi_entity.eliminated_yes')} />
          )}
          {!record.matched && !record.from.eliminated && (
            <StatusTag status="warning" label={t('multi_entity.no_match')} />
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('multi_entity.eliminations_workbench')}
        subtitle={t('multi_entity.eliminations_workbench_subtitle')}
      />
      <Alert
        message={t('multi_entity.eliminations_note')}
        description={t('multi_entity.eliminations_note_description')}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <SectionCard padded={false}>
        <ResponsiveTableAdapter
          columns={columns}
          dataSource={pairs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </SectionCard>
    </>
  );
};

export default EliminationsWorkbench;
