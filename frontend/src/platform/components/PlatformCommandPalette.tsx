import { useEffect, useState } from 'react';
import { Modal, Input } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { platformNavItems } from '../theme/platformTokens';

export default function PlatformCommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const items = platformNavItems.filter(item =>
    t(`platform.nav.${item.key}`, item.key).toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      title={t('platform.command_palette', 'Jump to…')}
      destroyOnHidden
    >
      <Input
        autoFocus
        placeholder={t('platform.search_pages', 'Search pages')}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onPressEnter={() => {
          if (items[0]) {
            navigate(items[0].path);
            setOpen(false);
          }
        }}
      />
      <ul style={{ marginTop: 12, padding: 0, listStyle: 'none' }}>
        {items.map(item => (
          <li key={item.key}>
            <button
              type="button"
              style={{ width: '100%', textAlign: 'start', padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => { navigate(item.path); setOpen(false); }}
            >
              {t(`platform.nav.${item.key}`, item.key)}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
