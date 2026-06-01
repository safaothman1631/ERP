import React, { useEffect, useState } from 'react';
import { List, Button, Space, Tag, message, Empty, Spin, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { CheckOutlined, CloseOutlined, ReloadOutlined, BulbOutlined } from '@ant-design/icons';
import { PageHeader, SectionCard, StatusTag } from '../../design-system';
import api from '../../api';

interface SuggestionItem {
  entity?: string;
  action?: string;
  confidence?: number;
}

interface Suggestion {
  id: string;
  target_user_id?: string;
  entity: string;
  items: SuggestionItem[];
  rationale?: string;
  status?: string;
  created_at?: string;
}

const SuggestionsInbox: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string | undefined>();

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/ai/recommendations', { params: { limit: 500 } });
      setData(res.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSuggestions();
  }, []);

  const accept = async (id: string) => {
    try {
      await api.patch(`/api/ai/recommendations/${id}`, { status: 'accepted' });
      message.success(t('ai.suggestion_accepted'));
      await fetchSuggestions();
    } catch {
      message.error(t('error'));
    }
  };

  const reject = async (id: string) => {
    try {
      await api.patch(`/api/ai/recommendations/${id}`, { status: 'rejected' });
      message.success(t('ai.suggestion_rejected'));
      await fetchSuggestions();
    } catch {
      message.error(t('error'));
    }
  };

  const filteredData = filterType
    ? data.filter((item) => item.entity === filterType)
    : data;

  // Group by entity type
  const grouped = filteredData.reduce((acc, item) => {
    const key = item.entity || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, Suggestion[]>);

  if (loading) {
    return (
      <div>
        <PageHeader title={t('ai.suggestions_title')} subtitle={t('ai.suggestions_subtitle')} />
        <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('ai.suggestions_title')}
        subtitle={t('ai.suggestions_subtitle')}
        extra={
          <Space>
            <Select
              placeholder={t('ai.filter_by_type')}
              value={filterType}
              onChange={setFilterType}
              style={{ width: 200 }}
              allowClear
              options={[
                { label: t('ai.type_expense'), value: 'expense' },
                { label: t('ai.type_payment'), value: 'payment' },
                { label: t('ai.type_invoice'), value: 'invoice' },
                { label: t('ai.type_bill'), value: 'bill' },
              ]}
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
            <Button icon={<ReloadOutlined />} onClick={fetchSuggestions}>
              {t('refresh')}
            </Button>
          </Space>
        }
      />

      {Object.keys(grouped).length === 0 ? (
        <Empty
          image={<BulbOutlined style={{ fontSize: 64, color: 'var(--ink-300)' }} />}
          description={t('ai.no_suggestions')}
          style={{ marginTop: 60 }}
        />
      ) : (
        Object.entries(grouped).map(([entityType, suggestions]) => (
          <SectionCard
            key={entityType}
            title={<Tag color="blue">{entityType}</Tag>}
          >
            <List
              dataSource={suggestions}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    item.status !== 'accepted' && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={() => accept(item.id)}
                      >
                        {t('ai.accept')}
                      </Button>
                    ),
                    item.status !== 'rejected' && (
                      <Button
                        danger
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={() => reject(item.id)}
                      >
                        {t('ai.reject')}
                      </Button>
                    ),
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={<BulbOutlined style={{ fontSize: 24, color: 'var(--warning-500)' }} />}
                    title={
                      <Space>
                        {item.items.map((itm, idx) => (
                          <Tag key={idx}>{itm.action || itm.entity}</Tag>
                        ))}
                        {item.status && <StatusTag status="success" label={item.status} />}
                      </Space>
                    }
                    description={
                      <div>
                        <div style={{ marginBottom: 4 }}>
                          {item.rationale || t('ai.no_rationale')}
                        </div>
                        {item.items.map((itm, idx) => (
                          <div key={idx} style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                            {itm.confidence !== undefined && (
                              <>
                                {t('ai.confidence')}: {(itm.confidence * 100).toFixed(0)}%
                              </>
                            )}
                          </div>
                        ))}
                        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 4 }}>
                          {item.created_at
                            ? item.created_at.substring(0, 16).replace('T', ' ')
                            : ''}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </SectionCard>
        ))
      )}
    </div>
  );
};

export default SuggestionsInbox;
