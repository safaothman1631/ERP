/**
 * HelpPanel — drawer with search, contextual suggestions, and category
 * browse (G2 / R2.6).
 *
 * Three "screens":
 *   1. Home — search box, featured & contextual articles.
 *   2. Category — articles in a single category.
 *   3. Article — rendered via `HelpArticle`.
 *
 * Trilingual: pulls locale from `i18next` and chooses the matching
 * title/summary. RTL handled by Antd Drawer placement.
 */
import React, { useMemo, useState } from 'react';
import {
  Button,
  Drawer,
  Empty,
  Input,
  List,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  SearchOutlined,
  MessageOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  CATEGORY_LABELS,
  HELP_CATEGORIES,
  type HelpArticleMeta,
  type HelpCategory,
  type HelpLocale,
  contextual,
  listByCategory,
  search,
} from '../../data/helpArticles';
import HelpArticle from './HelpArticle';

const { Title, Text: _Text, Paragraph: _Paragraph } = Typography;

export interface HelpPanelProps {
  open: boolean;
  route: string;
  onClose(): void;
}

type Screen =
  | { kind: 'home' }
  | { kind: 'category'; category: HelpCategory }
  | { kind: 'article'; slug: string };

const SUPPORT_WHATSAPP = '+9647707071234'; // TODO: replace with real number

export const HelpPanel: React.FC<HelpPanelProps> = ({ open, route, onClose }) => {
  const { t, i18n } = useTranslation();
  const locale: HelpLocale =
    (['ku', 'en', 'ar'].includes(i18n.language) ? i18n.language : 'en') as HelpLocale;

  const isRtl = locale !== 'en';
  const [query, setQuery] = useState('');
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });

  const byCategory = useMemo(() => listByCategory(), []);
  const contextualArticles = useMemo(() => contextual(route), [route]);
  const searchResults = useMemo(() => search(query, locale), [query, locale]);

  const goBack = () => setScreen({ kind: 'home' });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement={isRtl ? 'left' : 'right'}
      width={420}
      title={
        screen.kind === 'home' ? (
          t('help.title', 'Help & support')
        ) : (
          <Space>
            <Button
              size="small"
              icon={<ArrowLeftOutlined />}
              onClick={goBack}
              aria-label={t('help.back', 'Back')}
            >
              {t('help.back', 'Back')}
            </Button>
          </Space>
        )
      }
      data-testid="help-panel"
    >
      {screen.kind === 'home' && (
        <>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t('help.searchPlaceholder', 'Search help articles…')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('help.searchLabel', 'Search help')}
            style={{ marginBottom: 12 }}
            data-testid="help-search"
          />

          {query.trim() ? (
            <>
              <Title level={5}>{t('help.searchResults', 'Results')}</Title>
              {searchResults.length === 0 ? (
                <Empty description={t('help.noResults', 'No articles found')} />
              ) : (
                <ArticleList
                  items={searchResults}
                  locale={locale}
                  onOpen={(slug) => setScreen({ kind: 'article', slug })}
                />
              )}
            </>
          ) : (
            <>
              {contextualArticles.length > 0 && (
                <>
                  <Title level={5}>
                    {t('help.contextual', 'Suggested for this screen')}
                  </Title>
                  <ArticleList
                    items={contextualArticles}
                    locale={locale}
                    onOpen={(slug) => setScreen({ kind: 'article', slug })}
                  />
                </>
              )}

              <Title level={5} style={{ marginTop: 16 }}>
                {t('help.categories', 'Browse by topic')}
              </Title>
              <List
                dataSource={HELP_CATEGORIES}
                renderItem={(c) => (
                  <List.Item
                    onClick={() => setScreen({ kind: 'category', category: c })}
                    style={{ cursor: 'pointer' }}
                  >
                    <List.Item.Meta
                      title={CATEGORY_LABELS[c][locale]}
                      description={`${byCategory[c]?.length ?? 0} ${t('help.articlesCount', 'articles')}`}
                    />
                  </List.Item>
                )}
              />
            </>
          )}

          <ContactRow t={t} />
        </>
      )}

      {screen.kind === 'category' && (
        <>
          <Title level={5}>{CATEGORY_LABELS[screen.category][locale]}</Title>
          <ArticleList
            items={byCategory[screen.category] || []}
            locale={locale}
            onOpen={(slug) => setScreen({ kind: 'article', slug })}
          />
        </>
      )}

      {screen.kind === 'article' && (
        <HelpArticle
          slug={screen.slug}
          locale={locale}
          onSelectRelated={(slug) => setScreen({ kind: 'article', slug })}
        />
      )}
    </Drawer>
  );
};

const ArticleList: React.FC<{
  items: HelpArticleMeta[];
  locale: HelpLocale;
  onOpen(slug: string): void;
}> = ({ items, locale, onOpen }) => (
  <List
    dataSource={items}
    renderItem={(a) => (
      <List.Item
        onClick={() => onOpen(a.slug)}
        style={{ cursor: 'pointer' }}
        data-testid={`help-article-${a.slug}`}
      >
        <List.Item.Meta
          title={a.title[locale]}
          description={a.summary[locale]}
        />
        {a.featured && <Tag color="gold">★</Tag>}
      </List.Item>
    )}
  />
);

const ContactRow: React.FC<{ t: ReturnType<typeof useTranslation>['t'] }> = ({
  t,
}) => (
  <div
    style={{
      borderTop: '1px solid var(--border)',
      paddingTop: 12,
      marginTop: 16,
      display: 'flex',
      gap: 8,
    }}
  >
    <Button
      icon={<MessageOutlined />}
      onClick={() => window.dispatchEvent(new CustomEvent('crisp:open'))}
      block
      data-testid="help-contact-support"
    >
      {t('help.contactSupport', 'Contact support')}
    </Button>
    <Button
      icon={<WhatsAppOutlined />}
      href={`https://wa.me/${SUPPORT_WHATSAPP.replace('+', '')}`}
      target="_blank"
      rel="noreferrer"
      block
    >
      {t('help.whatsappUs', 'WhatsApp us')}
    </Button>
  </div>
);

HelpPanel.displayName = 'HelpPanel';

export default HelpPanel;
