import { useQuery } from '@tanstack/react-query';
import api from '../../api';

export default function PlatformAnnouncementBanner() {
  const { data } = useQuery({
    queryKey: ['platform', 'announcements', 'active'],
    queryFn: async () => (await api.get<{ items: { title: string; body: string; severity?: string }[] }>('/api/platform/announcements/active')).data.items,
    staleTime: 120_000,
  });

  const item = data?.[0];
  if (!item) return null;

  const bg = item.severity === 'critical' ? '#7f1d1d' : item.severity === 'warning' ? '#78350f' : '#1e3a8a';

  return (
    <div
      role="status"
      style={{
        padding: '8px 16px',
        background: bg,
        color: '#fff',
        fontSize: '0.88rem',
        textAlign: 'center',
      }}
    >
      <strong>{item.title}</strong>
      {' — '}
      {item.body}
    </div>
  );
}
