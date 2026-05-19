import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Space, Tag, List, Input, message, Divider } from 'antd';
import { EditOutlined, LikeOutlined, DislikeOutlined, CommentOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, LoadingSkeleton } from '../../design-system';
import { space } from '../../theme/tokens';
import { useLoadingState } from '../../hooks/useLoadingState';

interface Article {
  id: string;
  title: string;
  body: string;
  tags: string[];
  view_count: number;
  helpful_count: number;
  unhelpful_count: number;
  author_id: string;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
}

export default function ArticleView() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const { showSkeleton } = useLoadingState(loading);
  const [commentText, setCommentText] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [artRes, commRes] = await Promise.all([
        api.get(`/api/knowledge/articles/${id}`),
        api.get(`/api/knowledge/articles/${id}/comments`),
      ]);
      setArticle(artRes.data);
      setComments(commRes.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const onVote = async (helpful: boolean) => {
    if (!id) return;
    try {
      await api.post(`/api/knowledge/articles/${id}/vote`, { article_id: id, helpful });
      message.success(t('kb.vote_recorded'));
      load();
    } catch {
      message.error(t('error'));
    }
  };

  const onAddComment = async () => {
    if (!id || !commentText.trim()) return;
    try {
      await api.post(`/api/knowledge/articles/${id}/comments`, { article_id: id, body: commentText });
      message.success(t('kb.comment_added'));
      setCommentText('');
      load();
    } catch {
      message.error(t('error'));
    }
  };

  if (showSkeleton || !article) {
    return <LoadingSkeleton variant="card" />;
  }

  return (
    <div style={{ padding: space.lg }}>
      <PageHeader
        title={article.title}
        subtitle={`${t('kb.views')}: ${article.view_count || 0}`}
        extra={
          <Space>
            <Button icon={<EditOutlined />} onClick={() => navigate(`/kb/articles/${id}/edit`)}>
              {t('edit')}
            </Button>
          </Space>
        }
      />
      <Card style={{ marginTop: space.md }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            {article.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{article.body}</div>
          <Divider />
          <div>
            <Space>
              <Button icon={<LikeOutlined />} onClick={() => onVote(true)}>
                {t('kb.helpful')} ({article.helpful_count || 0})
              </Button>
              <Button icon={<DislikeOutlined />} onClick={() => onVote(false)}>
                {t('kb.not_helpful')} ({article.unhelpful_count || 0})
              </Button>
            </Space>
          </div>
          <Divider />
          <div>
            <h3>
              <CommentOutlined /> {t('kb.comments')} ({comments.length})
            </h3>
            <Space.Compact style={{ width: '100%', marginBottom: space.md }}>
              <Input
                placeholder={t('kb.add_comment_placeholder')}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <Button type="primary" onClick={onAddComment}>
                {t('kb.add_comment')}
              </Button>
            </Space.Compact>
            <List
              dataSource={comments}
              renderItem={(c) => (
                <List.Item>
                  <List.Item.Meta
                    title={c.author_id}
                    description={
                      <>
                        <div>{c.body}</div>
                        <small>{new Date(c.created_at).toLocaleString()}</small>
                      </>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: t('kb.no_comments') }}
            />
          </div>
        </Space>
      </Card>
    </div>
  );
}
