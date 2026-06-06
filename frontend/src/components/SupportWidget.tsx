import React, { useEffect, useState } from 'react';
import { Button, Tag, Typography, Space, Divider, Alert } from 'antd';
import {
 QuestionCircleOutlined,
 BookOutlined,
 CloseOutlined,
 WarningOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorTracker, type TrackedError } from '../utils/errorTracker';
import { FormDialog } from './responsive/FormDialog';

const { Text, Title } = Typography;

const ERROR_THRESHOLD = 3;
const WINDOW_MS = 60_000;

const SupportWidget: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [open, setOpen] = useState(false);
 const [nudge, setNudge] = useState(false);
 const [recent, setRecent] = useState<TrackedError[]>([]);

 useEffect(() => {
 const refresh = () => {
 const r = errorTracker.recent(WINDOW_MS);
 setRecent(r);
 if (r.length >= ERROR_THRESHOLD) setNudge(true);
 };
 refresh();
 const unsub = errorTracker.subscribe(refresh);
 const interval = window.setInterval(refresh, 5_000);
 return () => { unsub(); window.clearInterval(interval); };
 }, []);

 const dismissNudge = () => {
 setNudge(false);
 errorTracker.clear();
 };

 return (
 <>
 {/* Floating launcher */}
 <Button
 type="primary"
 shape="circle"
 icon={<QuestionCircleOutlined />}
 onClick={() => setOpen(true)}
 style={{
 position: 'fixed',
 insetInlineEnd: 20,
 bottom: 20,
 zIndex: 200,
 boxShadow: '0 6px 16px rgba(123,97,255,0.4)',
 }}
 aria-label={t('need_help')}
 />

 {/* Auto nudge after repeated errors */}
 {nudge && !open && (
 <div
 style={{
 position: 'fixed',
 insetInlineEnd: 80,
 bottom: 28,
 zIndex: 200,
 background: 'var(--surface)',
 border: '1px solid #fde68a',
 borderRadius: 12,
 padding: '10px 14px',
 boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
 maxWidth: 280,
 display: 'flex',
 alignItems: 'flex-start',
 gap: 8,
 }}
 >
 <WarningOutlined style={{ color: 'var(--warning-500)', fontSize: 18, marginTop: 2 }} />
 <div style={{ flex: 1 }}>
 <Text strong style={{ display: 'block' }}>{t('need_help_q')}</Text>
 <Text type="secondary" style={{ fontSize: 12 }}>{t('repeated_errors_hint')}</Text>
 <Space style={{ marginTop: 6 }}>
 <Button type="primary" onClick={() => { setOpen(true); setNudge(false); }}>
 {t('open_help')}
 </Button>
 <Button type="text" onClick={dismissNudge} icon={<CloseOutlined />} />
 </Space>
 </div>
 </div>
 )}

 <FormDialog
 title={<Space><QuestionCircleOutlined />{t('need_help')}</Space>}
 open={open}
 onClose={() => setOpen(false)}
 >
 <Title level={5}>{t('quick_actions')}</Title>
 <Space direction="vertical" style={{ width: '100%' }}>
 <Button block icon={<BookOutlined />} onClick={() => { navigate('/docs'); setOpen(false); }}>
 {t('docs_hub')}
 </Button>
 <Button block onClick={() => window.open('mailto:support@example.com?subject=ERP%20Support', '_self')}>
 {t('contact_support')}
 </Button>
 </Space>

 {recent.length > 0 && (
 <>
 <Divider />
 <Title level={5}>{t('recent_errors')}</Title>
 <Alert
 type="info"
 showIcon
 style={{ marginBottom: 12 }}
 message={`${recent.length} ${t('errors_in_last_minute')}`}
 />
 <Space direction="vertical" style={{ width: '100%' }}>
 {recent.slice(-5).reverse().map((e, i) => (
 <div key={i} style={{ padding: 8, borderRadius: 8, background: 'var(--surface-2)' }}>
 <Tag color="red" style={{ borderRadius: 8 }}>{new Date(e.ts).toLocaleTimeString()}</Tag>
 <div style={{ marginTop: 4, fontSize: 12 }}>{e.message}</div>
 {e.source && <Text type="secondary" style={{ fontSize: 11 }}>{e.source}</Text>}
 </div>
 ))}
 </Space>
 <Button block style={{ marginTop: 12 }} onClick={() => errorTracker.clear()}>
 {t('clear')}
 </Button>
 </>
 )}
 </FormDialog>
 </>
 );
};

export default SupportWidget;
