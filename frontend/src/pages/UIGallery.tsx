import React, { useState } from 'react';
import { Card, Row, Col, Button, Tag, Typography, Space, message } from 'antd';
import { CheckCircleFilled, EyeOutlined, ThunderboltFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store';
import { FormDialog } from '../components/responsive/FormDialog';
import RolePersonaGallery from '../components/role/RolePersonaGallery';

const { Title, Text, Paragraph } = Typography;

/* ---------- types ---------- */
type LayoutId =
 | 'classic-sidebar'
 | 'top-megamenu'
 | 'dual-rail'
 | 'icon-rail'
 | 'dashboard-first'
 | 'command-centric'
 | 'workspace-tabs'
 | 'apps-launcher'
 | 'split-master-detail'
 | 'mobile-bottom-nav';

interface LayoutOption {
 id: LayoutId;
 nameKu: string;
 nameEn: string;
 taglineKu: string;
 taglineEn: string;
 descKu: string;
 descEn: string;
 inspiredBy: string;
 bestFor: string[];
 preview: React.ReactNode;
}

/* ---------- preview building blocks (pure CSS/SVG mini-mockups) ---------- */
const Box: React.FC<{
 bg?: string;
 w?: number | string;
 h?: number | string;
 br?: number;
 children?: React.ReactNode;
 style?: React.CSSProperties;
}> = ({ bg = '#e6e9ef', w, h, br = 4, children, style }) => (
 <div
 style={{
 background: bg,
 width: w,
 height: h,
 borderRadius: br,
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 ...style,
 }}
 >
 {children}
 </div>
);

const Bar: React.FC<{ w?: number | string; h?: number; bg?: string; mb?: number }> = ({
 w = '70%',
 h = 6,
 bg = '#cfd4dc',
 mb = 4,
}) => <div style={{ width: w, height: h, background: bg, borderRadius: 3, marginBottom: mb }} />;

const PREVIEW_W = 320;
const PREVIEW_H = 200;

/* 1. Classic sidebar (current zoho/quickbooks) */
const PreviewClassic: React.FC = () => (
 <div style={{ display: 'flex', width: PREVIEW_W, height: PREVIEW_H, background: '#f5f7fa', borderRadius: 6, overflow: 'hidden' }}>
 <div style={{ width: 80, background: '#1f2937', padding: 8 }}>
 <Box bg="#3b82f6" w="100%" h={20} style={{ marginBottom: 8 }} />
 {[0, 1, 2, 3, 4, 5].map(i => <Bar key={i} w="100%" h={8} bg="#374151" mb={6} />)}
 </div>
 <div style={{ flex: 1, padding: 10 }}>
 <Bar w="40%" h={10} bg="#1f2937" mb={10} />
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
 <Box bg="#fff" h={32} /><Box bg="#fff" h={32} /><Box bg="#fff" h={32} />
 </div>
 <Box bg="#fff" h={100} />
 </div>
 </div>
);

/* 2. Top megamenu (SAP Fiori / Dynamics) */
const PreviewTopMega: React.FC = () => (
 <div style={{ width: PREVIEW_W, height: PREVIEW_H, background: '#f5f7fa', borderRadius: 6, overflow: 'hidden' }}>
 <div style={{ height: 36, background: '#0f172a', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 10 }}>
 <Box bg="#3b82f6" w={24} h={20} />
 {['Sales', 'Buy', 'Stock', 'Acct', 'HR'].map(t => (
 <div key={t} style={{ color: '#cbd5e1', fontSize: 9, fontWeight: 600 }}>{t}</div>
 ))}
 </div>
 <div style={{ height: 22, background: '#1e293b', display: 'flex', gap: 8, padding: '0 10px', alignItems: 'center' }}>
 {[0, 1, 2, 3].map(i => <Bar key={i} w={32} h={6} bg="#475569" mb={0} />)}
 </div>
 <div style={{ padding: 10 }}>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
 <Box bg="#fff" h={40} /><Box bg="#fff" h={40} />
 </div>
 <Box bg="#fff" h={70} />
 </div>
 </div>
);

/* 3. Dual rail (Odoo 17+ style) */
const PreviewDualRail: React.FC = () => (
 <div style={{ display: 'flex', width: PREVIEW_W, height: PREVIEW_H, background: '#f5f7fa', borderRadius: 6, overflow: 'hidden' }}>
 <div style={{ width: 44, background: '#7c3aed', padding: 6 }}>
 {[0, 1, 2, 3, 4, 5, 6].map(i => <Box key={i} bg="rgba(255,255,255,0.2)" w="100%" h={20} style={{ marginBottom: 4 }} />)}
 </div>
 <div style={{ width: 110, background: '#faf7ff', padding: 8, borderRight: '1px solid #ede9fe' }}>
 <Bar w="80%" h={8} bg="#7c3aed" mb={8} />
 {[0, 1, 2, 3, 4, 5].map(i => <Bar key={i} w="90%" h={6} bg="#c4b5fd" mb={6} />)}
 </div>
 <div style={{ flex: 1, padding: 10 }}>
 <Bar w="50%" h={10} bg="#1f2937" mb={10} />
 <Box bg="#fff" h={140} />
 </div>
 </div>
);

/* 4. Icon-only rail (Notion/Linear) */
const PreviewIconRail: React.FC = () => (
 <div style={{ display: 'flex', width: PREVIEW_W, height: PREVIEW_H, background: '#fafbfc', borderRadius: 6, overflow: 'hidden' }}>
 <div style={{ width: 48, background: '#fff', borderRight: '1px solid #e5e7eb', padding: 8, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
 {[0, 1, 2, 3, 4, 5, 6].map(i => <Box key={i} bg={i === 0 ? '#3b82f6' : '#e5e7eb'} w={28} h={28} br={6} />)}
 </div>
 <div style={{ flex: 1, padding: 14 }}>
 <Bar w="35%" h={12} bg="#111827" mb={12} />
 <Bar w="80%" h={6} bg="#d1d5db" mb={4} />
 <Bar w="60%" h={6} bg="#d1d5db" mb={12} />
 <Box bg="#fff" h={120} style={{ border: '1px solid #e5e7eb' }} />
 </div>
 </div>
);

/* 5. Dashboard-first (cockpit / executive) */
const PreviewDashboard: React.FC = () => (
 <div style={{ width: PREVIEW_W, height: PREVIEW_H, background: '#0f172a', borderRadius: 6, padding: 8, overflow: 'hidden' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
 <Bar w={80} h={10} bg="#fff" mb={0} />
 <Bar w={50} h={10} bg="#3b82f6" mb={0} />
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
 {['#3b82f6', '#10b981', '#f59e0b', '#ef4444'].map(c => (
 <Box key={c} bg={c} h={36} />
 ))}
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6 }}>
 <Box bg="#1e293b" h={120} style={{ alignItems: 'flex-end', padding: 6, gap: 3, justifyContent: 'space-around' }}>
 {[40, 70, 50, 90, 60, 80, 55].map((h, i) => (
 <div key={i} style={{ width: 12, height: h, background: '#3b82f6', borderRadius: 2 }} />
 ))}
 </Box>
 <Box bg="#1e293b" h={120} />
 </div>
 </div>
);

/* 6. Command-palette centric (Superhuman / Raycast) */
const PreviewCommand: React.FC = () => (
 <div style={{ width: PREVIEW_W, height: PREVIEW_H, background: '#fafafa', borderRadius: 6, padding: 12, position: 'relative', overflow: 'hidden' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
 <Bar w={60} h={8} bg="#9ca3af" mb={0} />
 <Bar w={30} h={8} bg="#9ca3af" mb={0} />
 </div>
 <Box bg="#fff" h={100} style={{ border: '1px solid #e5e7eb', flexDirection: 'column', alignItems: 'flex-start', padding: 8 }}>
 <Bar w="40%" h={6} bg="#e5e7eb" mb={6} />
 <Bar w="80%" h={4} bg="#f3f4f6" mb={3} />
 <Bar w="70%" h={4} bg="#f3f4f6" mb={3} />
 </Box>
 <div style={{
 position: 'absolute', top: 50, left: 30, right: 30,
 background: '#fff', borderRadius: 10,
 boxShadow: '0 12px 32px rgba(0,0,0,0.18)', padding: 10,
 border: '1px solid #e5e7eb',
 }}>
 <Bar w="100%" h={10} bg="#eef2ff" mb={8} />
 {[0, 1, 2].map(i => (
 <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
 <Box bg="#3b82f6" w={10} h={10} br={2} />
 <Bar w="70%" h={5} bg="#e5e7eb" mb={0} />
 </div>
 ))}
 </div>
 </div>
);

/* 7. Workspace tabs (browser-like, Odoo Studio) */
const PreviewTabs: React.FC = () => (
 <div style={{ width: PREVIEW_W, height: PREVIEW_H, background: '#f5f7fa', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
 <div style={{ height: 28, background: '#e5e7eb', display: 'flex', alignItems: 'flex-end', gap: 2, padding: '0 4px' }}>
 {[true, false, false, true].map((active, i) => (
 <div key={i} style={{
 padding: '4px 10px', background: active ? '#fff' : '#d1d5db',
 borderRadius: '6px 6px 0 0', fontSize: 8, color: '#374151',
 minWidth: 50, textAlign: 'center'
 }}>Tab {i + 1}</div>
 ))}
 </div>
 <div style={{ display: 'flex', flex: 1 }}>
 <div style={{ width: 60, background: '#fff', borderRight: '1px solid #e5e7eb', padding: 6 }}>
 {[0, 1, 2, 3].map(i => <Bar key={i} w="100%" h={8} bg="#e5e7eb" mb={6} />)}
 </div>
 <div style={{ flex: 1, padding: 10, background: '#fff' }}>
 <Bar w="50%" h={10} bg="#1f2937" mb={8} />
 <Box bg="#f9fafb" h={110} />
 </div>
 </div>
 </div>
);

/* 8. Apps launcher home (Odoo apps grid) */
const PreviewLauncher: React.FC = () => (
 <div style={{ width: PREVIEW_W, height: PREVIEW_H, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 6, padding: 14, overflow: 'hidden' }}>
 <Bar w={70} h={10} bg="rgba(255,255,255,0.9)" mb={10} />
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
 {['#fff', '#fde68a', '#fca5a5', '#86efac', '#93c5fd', '#fff', '#c4b5fd', '#fdba74', '#67e8f9', '#fff'].map((c, i) => (
 <div key={i} style={{ aspectRatio: '1', background: c, borderRadius: 8, opacity: 0.95 }} />
 ))}
 </div>
 </div>
);

/* 9. Split master-detail (mail / inbox style) */
const PreviewSplit: React.FC = () => (
 <div style={{ display: 'flex', width: PREVIEW_W, height: PREVIEW_H, background: '#fafafa', borderRadius: 6, overflow: 'hidden' }}>
 <div style={{ width: 50, background: '#1f2937', padding: 6 }}>
 {[0, 1, 2, 3, 4].map(i => <Box key={i} bg="#374151" w="100%" h={28} br={4} style={{ marginBottom: 4 }} />)}
 </div>
 <div style={{ width: 110, background: '#fff', borderRight: '1px solid #e5e7eb', padding: 8 }}>
 {[0, 1, 2, 3, 4].map(i => (
 <div key={i} style={{ padding: 4, background: i === 1 ? '#eff6ff' : 'transparent', borderRadius: 4, marginBottom: 4 }}>
 <Bar w="80%" h={5} bg="#1f2937" mb={3} />
 <Bar w="60%" h={4} bg="#9ca3af" mb={0} />
 </div>
 ))}
 </div>
 <div style={{ flex: 1, padding: 12, background: '#fff' }}>
 <Bar w="60%" h={10} bg="#1f2937" mb={10} />
 <Bar w="100%" h={5} bg="#e5e7eb" mb={4} />
 <Bar w="100%" h={5} bg="#e5e7eb" mb={4} />
 <Bar w="80%" h={5} bg="#e5e7eb" mb={10} />
 <Box bg="#f9fafb" h={70} />
 </div>
 </div>
);

/* 10. Mobile-first / bottom nav (PWA) */
const PreviewBottomNav: React.FC = () => (
 <div style={{ width: PREVIEW_W, height: PREVIEW_H, background: '#f5f7fa', borderRadius: 6, padding: 14, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
 <div style={{ width: 130, height: '100%', background: '#fff', borderRadius: 16, border: '6px solid #1f2937', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
 <div style={{ height: 24, background: '#3b82f6', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
 <Bar w="50%" h={5} bg="#fff" mb={0} />
 </div>
 <div style={{ flex: 1, padding: 6 }}>
 {[0, 1, 2, 3].map(i => (
 <Box key={i} bg="#f3f4f6" w="100%" h={18} br={4} style={{ marginBottom: 4 }} />
 ))}
 </div>
 <div style={{ height: 28, background: '#1f2937', display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '0 4px' }}>
 {['#3b82f6', '#9ca3af', '#9ca3af', '#9ca3af', '#9ca3af'].map((c, i) => (
 <Box key={i} bg={c} w={14} h={14} br={3} />
 ))}
 </div>
 </div>
 </div>
);

/* ---------- options registry ---------- */
const OPTIONS: LayoutOption[] = [
 {
 id: 'classic-sidebar',
 nameKu: 'کلاسیک — لاتەنیشتی',
 nameEn: 'Classic Sidebar',
 taglineKu: 'وەک ئێستا — Zoho/QuickBooks',
 taglineEn: 'Like today — Zoho/QuickBooks',
 descKu: 'لاتەنیشتی چەپ + topbar. ئاشنا، کاراکراو، گونجاو بۆ زۆربەی بەکارهێنەران.',
 descEn: 'Left sidebar + topbar. Familiar, productive, fits most users.',
 inspiredBy: 'Zoho Books, QuickBooks Online',
 bestFor: ['Accounting', 'General ERP', 'Multi-module daily use'],
 preview: <PreviewClassic />,
 },
 {
 id: 'top-megamenu',
 nameKu: 'مێگامێنوی سەرەوە',
 nameEn: 'Top Mega-Menu',
 taglineKu: 'هۆریزۆنتاڵ + بەش-بە-بەش',
 taglineEn: 'Horizontal navigation by domain',
 descKu: 'مێنوی سەرەوەی هۆریزۆنتاڵ، فراوانیی پشت ناوەند. وەک SAP Fiori و Microsoft Dynamics.',
 descEn: 'Horizontal top menu, full-width content. Like SAP Fiori and Microsoft Dynamics.',
 inspiredBy: 'SAP Fiori, MS Dynamics 365',
 bestFor: ['Wide screens', 'Enterprise feel', 'Reports-heavy'],
 preview: <PreviewTopMega />,
 },
 {
 id: 'dual-rail',
 nameKu: 'دوو لاتەنیشتی (Rail + Panel)',
 nameEn: 'Dual Rail',
 taglineKu: 'وەک Odoo 17+',
 taglineEn: 'Odoo 17+ inspired',
 descKu: 'لاتەنیشتی باریکی ئایکۆن + پانێڵی فراوانبوو بۆ هەر بەشێک. ٢ لێڤڵی ناڤیگەیشن بێ بێزاری.',
 descEn: 'Narrow icon rail + expanding contextual panel. Two-level nav without clutter.',
 inspiredBy: 'Odoo 17+, modern ERPs',
 bestFor: ['Many modules', 'Power users', 'Module switching'],
 preview: <PreviewDualRail />,
 },
 {
 id: 'icon-rail',
 nameKu: 'تەنیا ئایکۆن',
 nameEn: 'Icon-Only Rail',
 taglineKu: 'مینیمالیست — Notion/Linear',
 taglineEn: 'Minimal — Notion/Linear',
 descKu: 'لاتەنیشتی زۆر باریک تەنیا ئایکۆن، tooltip بۆ ناو. شوێنی زۆر بۆ ناوەڕۆک.',
 descEn: 'Very narrow icon-only sidebar with tooltips. Maximum content space.',
 inspiredBy: 'Notion, Linear, Slack',
 bestFor: ['Focus mode', 'Small screens', 'Less visual noise'],
 preview: <PreviewIconRail />,
 },
 {
 id: 'dashboard-first',
 nameKu: 'داشبۆرد یەکەم',
 nameEn: 'Dashboard-First',
 taglineKu: 'کۆکپیتی ڕێبەر',
 taglineEn: 'Executive cockpit',
 descKu: 'هۆمی ڕێبەر — KPI، چارت، ئەلێرت. ناڤیگەیشن لاتەنیشتی بچووک. باشترین بۆ بڕیاردەران.',
 descEn: 'Executive home — KPIs, charts, alerts. Compact nav. Best for decision-makers.',
 inspiredBy: 'Tableau, Power BI dashboards',
 bestFor: ['CEOs/CFOs', 'Insights-driven', 'Multi-branch monitoring'],
 preview: <PreviewDashboard />,
 },
 {
 id: 'command-centric',
 nameKu: 'فەرمان-سەنتەر (⌘K)',
 nameEn: 'Command-Centric',
 taglineKu: 'Superhuman/Raycast',
 taglineEn: 'Superhuman/Raycast feel',
 descKu: 'هیچ لاتەنیشتییەک. هەموو شت لە ⌘K. خێرایی نەهێشتنکراو بۆ شارەزایان.',
 descEn: 'No sidebar. Everything via ⌘K. Unmatched speed for power users.',
 inspiredBy: 'Superhuman, Raycast, Linear',
 bestFor: ['Keyboard pros', 'Speed-first', 'Minimalist UI lovers'],
 preview: <PreviewCommand />,
 },
 {
 id: 'workspace-tabs',
 nameKu: 'تابە کاری (وەک براوزەر)',
 nameEn: 'Workspace Tabs',
 taglineKu: 'multi-document',
 taglineEn: 'Multi-document workflow',
 descKu: 'تابەکانی سەرەوە، چەند بەڵگەنامە کراوە بەهاوکات. باشترە بۆ ئەکاونتانت کە چەند فاکتوور دەکاتەوە.',
 descEn: 'Top tabs for multiple open docs. Best when juggling many invoices/bills at once.',
 inspiredBy: 'Browser tabs, Odoo Studio',
 bestFor: ['Accountants', 'Heavy data-entry', 'Side-by-side compare'],
 preview: <PreviewTabs />,
 },
 {
 id: 'apps-launcher',
 nameKu: 'لانچەری ئەپ',
 nameEn: 'Apps Launcher Home',
 taglineKu: 'وەک Odoo apps',
 taglineEn: 'Odoo apps grid style',
 descKu: 'هۆمی گرید لە ئەپەکان (وەک iPhone). دواتر هەر ئەپێک ڕووکاری خۆی هەیە. باش بۆ ERP فرە-مۆدوول.',
 descEn: 'App-grid home (iPhone-like). Each app has its own UI. Great for multi-module ERPs.',
 inspiredBy: 'Odoo, iOS, Office 365',
 bestFor: ['Onboarding', 'Module discovery', 'Casual users'],
 preview: <PreviewLauncher />,
 },
 {
 id: 'split-master-detail',
 nameKu: 'دابەشکراوی سێ ستوون',
 nameEn: 'Split Master-Detail',
 taglineKu: 'وەک Mail/Inbox',
 taglineEn: 'Mail/Inbox style',
 descKu: 'سێ ستوون: ناڤ + لیست + وردەکاری. کەمتر کلیک، زیاتر context. باش بۆ approvals و workflow.',
 descEn: 'Three columns: nav + list + detail. Fewer clicks, more context. Great for approvals/workflow.',
 inspiredBy: 'Apple Mail, Outlook, Front',
 bestFor: ['Approval queues', 'Inbox/Activities', 'Triage workflows'],
 preview: <PreviewSplit />,
 },
 {
 id: 'mobile-bottom-nav',
 nameKu: 'مۆبایل-یەکەم (PWA)',
 nameEn: 'Mobile-First / Bottom Nav',
 taglineKu: 'PWA + ناڤیگەیشنی خوارەوە',
 taglineEn: 'PWA + bottom navigation',
 descKu: 'گرنگی بە مۆبایل دەدات، ناڤیگەیشن لە خوارەوە، گونجاو بۆ POS، ئاتێندانس و فیلد.',
 descEn: 'Mobile-first, bottom nav. Built for POS, attendance, field workers.',
 inspiredBy: 'Instagram, Shopify POS',
 bestFor: ['POS cashiers', 'Field sales', 'On-the-go managers'],
 preview: <PreviewBottomNav />,
 },
];

/* ---------- main page ---------- */
const UIGallery: React.FC = () => {
 const { i18n, t } = useTranslation();
 const isKu = i18n.language === 'ku';
 const setLayout = useAuthStore(s => s.setLayoutMode);
 const current = useAuthStore(s => s.layoutMode);
 const [previewing, setPreviewing] = useState<LayoutOption | null>(null);

 const apply = (opt: LayoutOption) => {
 setLayout(opt.id);
 message.success(
 isKu
 ? `ڕووکاری "${opt.nameKu}" دانرا. هەندێک ڕووکار پێویستی refresh هەیە.`
 : `Layout "${opt.nameEn}" applied. Some layouts require refresh.`
 );
 };

 return (
 <div style={{ padding: 24 }}>
 <Title level={3} style={{ marginBottom: 4 }}>
 {isKu ? 'گاڵەری ڕووکارەکان' : 'Layout Gallery'}
 </Title>
 <Text type="secondary">
 {isKu
 ? '١٠ ستایلی جیاوازی ERP — preview بکە و یەکێکیان هەڵبژێرە بۆ ئەوەی ببێتە ڕووکاری سەرەکی'
 : '10 ERP layout styles — preview and pick one to make it the main shell'}
 </Text>

 <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
 {OPTIONS.map(opt => {
 const isCurrent = current === opt.id;
 return (
 <Col key={opt.id} xs={24} md={12} lg={8} xxl={6}>
 <Card
 hoverable
 style={{
 border: isCurrent ? '2px solid #1f6feb' : undefined,
 position: 'relative',
 }}
 cover={
 <div
 style={{
 padding: 14,
 background: '#f8f9fb',
 display: 'flex',
 justifyContent: 'center',
 }}
 >
 {opt.preview}
 </div>
 }
 actions={[
 <Button
 key="preview"
 type="text"
 icon={<EyeOutlined />}
 onClick={() => setPreviewing(opt)}
 >
 {isKu ? 'بینین' : 'Preview'}
 </Button>,
 <Button
 key="apply"
 type={isCurrent ? 'default' : 'primary'}
 icon={isCurrent ? <CheckCircleFilled /> : <ThunderboltFilled />}
 onClick={() => apply(opt)}
 disabled={isCurrent}
 >
 {isCurrent ? (isKu ? 'هەڵبژێردراوە' : 'Selected') : (isKu ? 'هەڵبژاردن' : 'Select')}
 </Button>,
 ]}
 >
 {isCurrent && (
 <Tag
 color="blue"
 style={{ position: 'absolute', top: 8, insetInlineEnd: 8, zIndex: 2 }}
 >
 {isKu ? 'ئێستا چالاک' : 'Active'}
 </Tag>
 )}
 <Card.Meta
 title={
 <Space>
 <span>{isKu ? opt.nameKu : opt.nameEn}</span>
 </Space>
 }
 description={
 <div>
 <Text type="secondary" style={{ fontSize: 12 }}>
 {isKu ? opt.taglineKu : opt.taglineEn}
 </Text>
 <Paragraph
 style={{ marginTop: 8, marginBottom: 8, fontSize: 13 }}
 ellipsis={{ rows: 2 }}
 >
 {isKu ? opt.descKu : opt.descEn}
 </Paragraph>
 <div>
 {opt.bestFor.slice(0, 2).map(b => (
 <Tag key={b} style={{ fontSize: 10 }}>{b}</Tag>
 ))}
 </div>
 </div>
 }
 />
 </Card>
 </Col>
 );
 })}
 </Row>

 {/* full preview modal */}
 <FormDialog
 open={!!previewing}
 onClose={() => setPreviewing(null)}
 title={previewing ? (isKu ? previewing.nameKu : previewing.nameEn) : ''}
 footer={
 previewing && [
 <Button key="close" onClick={() => setPreviewing(null)}>
 {isKu ? 'داخستن' : 'Close'}
 </Button>,
 <Button
 key="apply"
 type="primary"
 icon={<ThunderboltFilled />}
 onClick={() => {
 apply(previewing);
 setPreviewing(null);
 }}
 disabled={current === previewing.id}
 >
 {current === previewing.id
 ? (isKu ? 'هەڵبژێردراوە' : 'Selected')
 : (isKu ? 'هەڵبژاردن' : 'Select this')}
 </Button>,
 ]
 }
 >
 {previewing && (
 <div>
 <div style={{ display: 'flex', justifyContent: 'center', padding: 20, background: '#f8f9fb', borderRadius: 8 }}>
 <div style={{ transform: 'scale(1.6)', transformOrigin: 'center' }}>
 {previewing.preview}
 </div>
 </div>
 <Title level={5} style={{ marginTop: 24 }}>
 {isKu ? 'وردەکاری' : 'Details'}
 </Title>
 <Paragraph>{isKu ? previewing.descKu : previewing.descEn}</Paragraph>
 <Paragraph>
 <Text strong>{isKu ? 'ئیلهام لە: ' : 'Inspired by: '}</Text>
 <Text>{previewing.inspiredBy}</Text>
 </Paragraph>
 <Paragraph>
 <Text strong>{isKu ? 'باشترە بۆ:' : 'Best for:'}</Text>
 <div style={{ marginTop: 6 }}>
 {previewing.bestFor.map(b => (
 <Tag key={b} color="blue">{b}</Tag>
 ))}
 </div>
 </Paragraph>
 </div>
 )}
 </FormDialog>
 <RolePersonaGallery />
 </div>
 );
};

export default UIGallery;
