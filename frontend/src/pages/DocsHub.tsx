import React, { useMemo, useState } from 'react';
import { Card, Input, List, Typography, Tag, Empty, Space, Collapse, Badge } from 'antd';
import { SearchOutlined, BookOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { listPageHelpKeys, getPageHelp, groupPageHelpBySection } from '../data/page-help';
import PageHelp, { type PageHelpContent, type PageHelpSection } from '../components/PageHelp';
import HelpButton from '../components/HelpButton';

const { Title, Paragraph, Text } = Typography;

const SECTION_ORDER: (PageHelpSection | 'other')[] = [
  'getting-started',
  'sales',
  'purchases',
  'banking',
  'inventory',
  'accounting',
  'reports',
  'pos',
  'crm',
  'hr',
  'projects',
  'setup',
  'system',
  'other',
];

const DocsHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const grouped = useMemo(
    () => groupPageHelpBySection(i18n.language),
    [i18n.language],
  );

  const filteredFlat = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.trim().toLowerCase();
    return listPageHelpKeys()
      .map((k) => ({ key: k, content: getPageHelp(k, i18n.language) }))
      .filter((e) =>
        `${e.key} ${e.content.title} ${e.content.purpose}`.toLowerCase().includes(q),
      )
      .sort((a, b) => a.content.title.localeCompare(b.content.title));
  }, [query, i18n.language]);

  const renderCard = (item: { key: string; content: PageHelpContent }) => (
    <List.Item>
      <Card
        hoverable
        onClick={() => setActiveKey(item.key)}
        title={
          <Space>
            <QuestionCircleOutlined style={{ color: '#6366f1' }} />
            <span>{item.content.title}</span>
          </Space>
        }
        extra={<Tag>{item.key}</Tag>}
      >
        <Paragraph
          type="secondary"
          ellipsis={{ rows: 3 }}
          style={{ minHeight: 60, marginBottom: 0 }}
        >
          {item.content.purpose}
        </Paragraph>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('click_to_open', 'کلیک بکە بۆ کردنەوە')}
        </Text>
      </Card>
    </List.Item>
  );

  const sectionsWithItems = SECTION_ORDER.filter(
    (s) => grouped[s] && grouped[s].length > 0,
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <BookOutlined /> {t('docs_hub', 'سەنتەری یارمەتی')}
        </Title>
        <HelpButton pageKey="docs" />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Input
          allowClear
          size="large"
          prefix={<SearchOutlined />}
          placeholder={t('docs_search_placeholder', 'گەڕان بەدوای پەیج، فیچەر، یان وۆرک‌فلۆ…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Card>

      {filteredFlat ? (
        filteredFlat.length === 0 ? (
          <Empty description={t('no_results', 'هیچ ئەنجامێک نەدۆزرایەوە')} />
        ) : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3 }}
            dataSource={filteredFlat}
            renderItem={renderCard}
          />
        )
      ) : (
        <Collapse
          defaultActiveKey={sectionsWithItems as string[]}
          items={sectionsWithItems.map((section) => ({
            key: section,
            label: (
              <Space>
                <Text strong>{t(`docs_section_${section}`, section)}</Text>
                <Badge count={grouped[section].length} color="blue" />
              </Space>
            ),
            children: (
              <List
                grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3 }}
                dataSource={grouped[section]}
                renderItem={renderCard}
              />
            ),
          }))}
        />
      )}

      {activeKey && (
        <PageHelp
          open={true}
          onClose={() => setActiveKey(null)}
          content={getPageHelp(activeKey, i18n.language)}
        />
      )}
    </div>
  );
};

export default DocsHub;
