/**
 * HelpArticle — renders a single KB article (G2 / R2.6, R2.2).
 *
 * Bodies live as raw markdown under `data/helpArticles/{ku,en,ar}/{slug}.md`.
 * We use `import.meta.glob` so Vite produces a code-split chunk per locale.
 * If the per-locale file is missing we fall back to English.
 *
 * Renders markdown via a minimal, dependency-free converter
 * (subset: headings, paragraphs, bold, italics, lists, links).
 */
import React, { useEffect, useState } from 'react';
import { Alert, Button, Skeleton, Space, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  findBySlug,
  type HelpLocale,
} from '../../data/helpArticles';

const { Title, Paragraph } = Typography;

// Vite glob: only metadata + lazy import factories per language.
const KU_FILES = (import.meta as any).glob(
  '../../data/helpArticles/ku/*.md',
  { query: '?raw', import: 'default' },
);
const EN_FILES = (import.meta as any).glob(
  '../../data/helpArticles/en/*.md',
  { query: '?raw', import: 'default' },
);
const AR_FILES = (import.meta as any).glob(
  '../../data/helpArticles/ar/*.md',
  { query: '?raw', import: 'default' },
);

const FILE_TABLE: Record<HelpLocale, Record<string, () => Promise<unknown>>> = {
  ku: KU_FILES,
  en: EN_FILES,
  ar: AR_FILES,
};

function resolvePath(locale: HelpLocale, slug: string): string {
  return `../../data/helpArticles/${locale}/${slug}.md`;
}

async function loadBody(slug: string, locale: HelpLocale): Promise<string> {
  const order: HelpLocale[] = [locale, 'en', 'ku'];
  for (const lang of order) {
    const path = resolvePath(lang, slug);
    const loader = FILE_TABLE[lang]?.[path];
    if (loader) {
      try {
        const text = (await loader()) as string;
        if (text && text.trim()) return text;
      } catch {
        /* try next */
      }
    }
  }
  return '';
}

// ── minimal markdown renderer ────────────────────────────────────────────

function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^#\s+/.test(line)) {
      out.push(<h1 key={key++}>{line.replace(/^#\s+/, '')}</h1>);
      i++;
    } else if (/^##\s+/.test(line)) {
      out.push(<h2 key={key++}>{line.replace(/^##\s+/, '')}</h2>);
      i++;
    } else if (/^###\s+/.test(line)) {
      out.push(<h3 key={key++}>{line.replace(/^###\s+/, '')}</h3>);
      i++;
    } else if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      out.push(
        <ul key={key++}>
          {items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
    } else if (line.trim() === '') {
      i++;
    } else {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !/^[#\-*]/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      out.push(<p key={key++}>{renderInline(buf.join(' '))}</p>);
    }
  }
  return out;
}

function renderInline(s: string): React.ReactNode {
  // **bold** / *italic* / [text](url) — applied sequentially with a single
  // pass for each kind. Good enough for the KB; not a full md engine.
  const nodes: React.ReactNode[] = [];
  const tokens = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);
  tokens.forEach((tok, idx) => {
    if (!tok) return;
    if (/^\*\*[^*]+\*\*$/.test(tok)) {
      nodes.push(<strong key={idx}>{tok.slice(2, -2)}</strong>);
    } else if (/^\*[^*]+\*$/.test(tok)) {
      nodes.push(<em key={idx}>{tok.slice(1, -1)}</em>);
    } else if (/^\[[^\]]+\]\([^)]+\)$/.test(tok)) {
      const m = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m) {
        nodes.push(
          <a key={idx} href={m[2]} target="_blank" rel="noreferrer">
            {m[1]}
          </a>,
        );
      }
    } else {
      nodes.push(tok);
    }
  });
  return nodes;
}

// ── component ────────────────────────────────────────────────────────────

export interface HelpArticleProps {
  slug: string;
  locale: HelpLocale;
  onSelectRelated(slug: string): void;
}

export const HelpArticle: React.FC<HelpArticleProps> = ({
  slug,
  locale,
  onSelectRelated,
}) => {
  const { t } = useTranslation();
  const meta = findBySlug(slug);
  const [body, setBody] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'yes' | 'no' | null>(null);

  useEffect(() => {
    let cancel = false;
    setBody(null);
    loadBody(slug, locale).then((b) => {
      if (!cancel) setBody(b);
    });
    return () => {
      cancel = true;
    };
  }, [slug, locale]);

  if (!meta) {
    return <Alert type="error" message={t('help.notFound', 'Article not found')} />;
  }

  return (
    <article data-testid="help-article">
      <Title level={4}>{meta.title[locale]}</Title>
      <Paragraph type="secondary">{meta.summary[locale]}</Paragraph>

      {body === null ? (
        <Skeleton paragraph={{ rows: 5 }} active />
      ) : body ? (
        <div className="help-article-body">{renderMarkdown(body)}</div>
      ) : (
        <Alert
          type="info"
          message={t('help.bodyPending', 'Full article coming soon.')}
        />
      )}

      <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <Paragraph strong>{t('help.wasHelpful', 'Was this helpful?')}</Paragraph>
        <Space>
          <Button
            size="small"
            type={feedback === 'yes' ? 'primary' : 'default'}
            onClick={() => setFeedback('yes')}
          >
            {t('help.yes', 'Yes')}
          </Button>
          <Button
            size="small"
            danger={feedback === 'no'}
            type={feedback === 'no' ? 'primary' : 'default'}
            onClick={() => setFeedback('no')}
          >
            {t('help.no', 'No')}
          </Button>
        </Space>
      </div>

      {meta.related.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Paragraph strong>{t('help.related', 'Related articles')}</Paragraph>
          <Space direction="vertical" style={{ width: '100%' }}>
            {meta.related.map((s) => {
              const r = findBySlug(s);
              if (!r) return null;
              return (
                <Button
                  key={s}
                  type="link"
                  icon={<ArrowRightOutlined />}
                  onClick={() => onSelectRelated(s)}
                  style={{ padding: 0 }}
                >
                  {r.title[locale]}
                </Button>
              );
            })}
          </Space>
        </div>
      )}
    </article>
  );
};

HelpArticle.displayName = 'HelpArticle';

export default HelpArticle;
