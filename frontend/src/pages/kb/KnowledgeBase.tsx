import { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Input, Tree, List, Tag, Empty } from 'antd';
import { SearchOutlined, FileTextOutlined, FolderOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, LoadingSkeleton } from '../../design-system';
import { InlineError } from '../../components/feedback/InlineError';
import { useLoadingState } from '../../hooks/useLoadingState';
import { space } from '../../theme/tokens';

interface Category {
  id: string;
  name: string;
  parent_id?: string;
  icon?: string;
}

interface Article {
  id: string;
  title: string;
  category_id?: string;
  tags: string[];
  is_published: boolean;
  view_count: number;
  helpful_count: number;
}

export default function KnowledgeBase() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [popular, setPopular] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const { showSkeleton } = useLoadingState(loading);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [catRes, artRes] = await Promise.all([
        api.get('/api/knowledge/categories'),
        api.get('/api/knowledge/articles', { params: { is_published: true, limit: 200 } }),
      ]);
      setCategories(catRes.data.items || []);
      const arts = artRes.data.items || [];
      setArticles(arts);
      setPopular(arts.sort((a: Article, b: Article) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 5));
    } catch (_err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  const treeData = categories.map((c) => ({
    key: c.id,
    title: c.name,
    icon: <FolderOutlined />,
  }));

  const filteredArticles = articles
    .filter((a) => (selectedCat ? a.category_id === selectedCat : true))
    .filter((a) => (searchQuery ? a.title.toLowerCase().includes(searchQuery.toLowerCase()) : true));

  if (error) {
    return <InlineError onRetry={load} />;
  }

  if (showSkeleton) {
    return <LoadingSkeleton variant="row" rows={8} />;
  }

  return (
    <div style={{ padding: space.lg }}>
      <PageHeader title={t('kb.knowledge_base')} subtitle={t('kb.browse_articles')} />
      <Row gutter={[16, 16]} style={{ marginTop: space.md }}>
        <Col xs={24} md={6}>
          <Card title={t('kb.categories')}>
            <Tree
              treeData={treeData}
              onSelect={(keys) => setSelectedCat(keys[0] as string || null)}
              showIcon
            />
          </Card>
        </Col>
        <Col xs={24} md={18}>
          <Input
            placeholder={t('kb.search_articles')}
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginBottom: space.md }}
            size="large"
          />
          <Card title={t('kb.articles')}>
            {filteredArticles.length > 0 ? (
              <List
                grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3 }}
                dataSource={filteredArticles}
                renderItem={(a) => (
                  <List.Item>
                    <Card
                      hoverable
                      onClick={() => navigate(`/kb/articles/${a.id}`)}
                      style={{ height: '100%' }}
                    >
                      <Card.Meta
                        avatar={<FileTextOutlined style={{ fontSize: 24 }} />}
                        title={a.title}
                        description={
                          <div>
                            <div>{t('kb.views')}: {a.view_count || 0}</div>
                            <div>
                              {a.tags.map((tag) => (
                                <Tag key={tag}>{tag}</Tag>
                              ))}
                            </div>
                          </div>
                        }
                      />
                    </Card>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description={t('kb.no_articles')} />
            )}
          </Card>
          <Card title={t('kb.popular_articles')} style={{ marginTop: space.md }}>
            <List
              dataSource={popular}
              renderItem={(a) => (
                <List.Item>
                  <a onClick={() => navigate(`/kb/articles/${a.id}`)}>{a.title}</a>
                  <span style={{ marginInlineStart: space.sm, color: 'var(--ink-400)' }}>
                    ({a.view_count || 0} {t('kb.views')})
                  </span>
                </List.Item>
              )}
              locale={{ emptyText: t('kb.no_articles') }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
