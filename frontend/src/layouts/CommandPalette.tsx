import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Modal, Input, Empty } from 'antd';
import { SearchOutlined, EnterOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildNavSections, buildNavZones, flattenRoutes } from './navigation';
import { palette, radius, space } from '../theme/tokens';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Cmd {
  key: string;          // route
  label: string;
  section: string;
  zone: string;
  description?: string;
  keywords?: string[];
  icon: React.ReactNode;
}

/**
 * CommandPalette — ⌘K / Ctrl K. Fuzzy-ish (substring) search لە هەموو routes.
 */
export const CommandPalette: React.FC<Props> = ({ open, onClose }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const isRTL = i18n.language === 'ku' || i18n.language === 'ar';

  const commands: Cmd[] = useMemo(() => {
    const sections = buildNavSections(t);
    const zones = buildNavZones(t);
    return flattenRoutes(sections, zones).map((item) => ({
      key: item.key,
      label: item.label,
      section: item.sectionLabel,
      zone: item.zoneLabel,
      description: item.description,
      keywords: item.keywords,
      icon: item.icon,
    }));
  }, [t]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return commands.slice(0, 12);
    return commands
      .filter((cmd) => {
        const haystack = [
          cmd.label,
          cmd.section,
          cmd.zone,
          cmd.description || '',
          cmd.key,
          ...(cmd.keywords || []),
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 30);
  }, [deferredQuery, commands]);

  useEffect(() => { setActive(0); }, [query, open]);

  const run = (cmd: Cmd) => {
    navigate(cmd.key);
    onClose();
    setQuery('');
  };

  const onKeyDown: React.KeyboardEventHandler = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && filtered[active]) { e.preventDefault(); run(filtered[active]); }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      destroyOnHidden
      width={640}
      centered
      styles={{
        body: { padding: 0 },
      }}
      style={{ borderRadius: radius.lg, overflow: 'hidden' }}
    >
      <Input
        size="large"
        variant="borderless"
        autoFocus
        prefix={<SearchOutlined style={{ color: palette.ink500, fontSize: 18 }} />}
        placeholder={t('search_or_jump', 'Search or jump to…')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        style={{ padding: `${space.md}px ${space.lg}px`, fontSize: 16 }}
      />
      <div style={{ borderTop: `1px solid var(--ant-color-border-secondary, ${palette.ink100})`, maxHeight: 420, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: space.xxl }} description={t('no_results', 'No results')} />
        ) : (
          <div>
            {filtered.map((cmd, idx) => (
              <div
                key={cmd.key}
                onMouseEnter={() => setActive(idx)}
                onClick={() => run(cmd)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    run(cmd);
                  }
                }}
                style={{
                  padding: `${space.sm}px ${space.lg}px`,
                  cursor: 'pointer',
                  background: idx === active ? palette.primary50 : 'transparent',
                  borderInlineStart: idx === active ? `3px solid ${palette.primary500}` : '3px solid transparent',
                  transition: 'background 120ms',
                  display: 'flex', alignItems: 'center', gap: space.md,
                }}
              >
                <span style={{ color: palette.ink500, fontSize: 16 }}>{cmd.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: palette.ink900 }}>{cmd.label}</div>
                  <div style={{ fontSize: 11, color: palette.ink500 }}>{cmd.zone} · {cmd.section} · {cmd.key}</div>
                  {cmd.description && (
                    <div style={{ fontSize: 11, color: palette.ink500, marginTop: 2 }}>{cmd.description}</div>
                  )}
                </div>
                {idx === active && (
                  <span style={{ color: palette.primary600, fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
                    <EnterOutlined /> Enter
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={{
          padding: `${space.xs}px ${space.lg}px`,
          borderTop: `1px solid var(--ant-color-border-secondary, ${palette.ink100})`,
          fontSize: 11, color: palette.ink500,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>↑ ↓ navigate · Enter open · Esc close</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {filtered.length} {isRTL ? 'ئەنجام' : 'results'} <ArrowRightOutlined />
          </span>
        </div>
      </div>
    </Modal>
  );
};

export default CommandPalette;
