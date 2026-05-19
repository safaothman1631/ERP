import { useMemo, useState } from 'react';
import {
 Steps, Card, Row, Col, Button, Checkbox, Tag, Empty, Space,
 Typography, Divider, Input, Alert, theme as antdTheme, Grid, App as AntApp } from 'antd';
import {
 CheckCircleFilled, RocketOutlined, AppstoreOutlined, FlagOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { INDUSTRIES, MODULES, ALWAYS_ON, type ModuleKey, type ModuleDef } from './industries';
import { useOnboardingStore } from './store';
import { FormDialog } from '../components/responsive/FormDialog';

const { Title, Text, Paragraph } = Typography;

interface OnboardingWizardProps {
 open: boolean;
 firstTime?: boolean;
 onClose: () => void;
 onComplete?: () => void;
}

const CATEGORY_ORDER: Array<ModuleDef['category']> = [
 'finance', 'ops', 'people', 'system', 'engagement', 'platform', 'vertical',
];

// i18n key per category — resolved via t('cat_*'), with sensible fallback.
const CATEGORY_KEY: Record<ModuleDef['category'], { key: string; fallback: string }> = {
 core: { key: 'cat_other', fallback: 'Core' },
 finance: { key: 'cat_finance', fallback: 'Finance' },
 ops: { key: 'cat_operations', fallback: 'Operations' },
 people: { key: 'cat_people', fallback: 'People' },
 system: { key: 'cat_system', fallback: 'سیستەم و یەکگرتنەکان' },
 engagement: { key: 'cat_engagement', fallback: 'بەشدارکردن و خزمەت' },
 platform: { key: 'cat_platform', fallback: 'پلاتفۆرم و AI' },
 vertical: { key: 'cat_vertical', fallback: 'پیشەسازییە تایبەتەکان' },
};

// Locale-aware normalize for search (handles Kurdish/Arabic case + diacritics).
const norm = (s: string) =>
 s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

export default function OnboardingWizard({ open, firstTime = false, onClose, onComplete }: OnboardingWizardProps) {
 const { t } = useTranslation();
 const { token } = antdTheme.useToken();
 const screens = Grid.useBreakpoint();
 const isMobile = !screens.md;
 const { message } = AntApp.useApp();

 const complete = useOnboardingStore(s => s.complete);
 const saving = useOnboardingStore(s => s.saving);
 const savedIndustry = useOnboardingStore(s => s.industryId);
 const savedMods = useOnboardingStore(s => s.enabledModules);

 const [step, setStep] = useState(0);
 const [industryId, setIndustryId] = useState<string | null>(savedIndustry);
 const [selected, setSelected] = useState<Set<ModuleKey>>(new Set(savedMods || []));
 const [search, setSearch] = useState('');

 const accent = token.colorPrimary;
 const accentSoft = token.controlItemBgActive;

 const pickIndustry = (id: string) => {
 setIndustryId(id);
 const ind = INDUSTRIES.find(i => i.id === id);
 if (ind) setSelected(new Set<ModuleKey>([...ind.modules, ...ALWAYS_ON]));
 };

 const toggle = (k: ModuleKey) => {
 if (ALWAYS_ON.includes(k)) return;
 setSelected(prev => {
 const next = new Set(prev);
 if (next.has(k)) next.delete(k); else next.add(k);
 return next;
 });
 };

 const selectAllVisible = () => {
 setSelected(prev => {
 const next = new Set(prev);
 filteredModules.forEach(m => next.add(m.key));
 return next;
 });
 };
 const clearAllOptional = () => {
 setSelected(new Set<ModuleKey>(ALWAYS_ON));
 };

 const filteredModules = useMemo(() => {
 if (!search.trim()) return MODULES;
 const q = norm(search.trim());
 return MODULES.filter(m =>
 norm(m.title).includes(q) ||
 norm(m.description).includes(q) ||
 norm(m.key).includes(q) ||
 norm(t(m.labelKey, m.title)).includes(q)
 );
 }, [search, t]);

 const grouped = useMemo(() => {
 const map = new Map<ModuleDef['category'], ModuleDef[]>();
 for (const m of filteredModules) {
 const arr = map.get(m.category) || [];
 arr.push(m);
 map.set(m.category, arr);
 }
 return map;
 }, [filteredModules]);

 const finish = async () => {
 try {
 await complete(industryId || 'custom', Array.from(selected));
 message.success(t('onb_success'));
 onComplete?.();
 } catch {
 message.error(t('onb_error'));
 }
 };

 const cardStyle = (active: boolean, locked = false): React.CSSProperties => ({
 borderColor: active ? accent : token.colorBorderSecondary,
 borderWidth: active ? 2 : 1,
 background: active ? accentSoft : token.colorBgContainer,
 cursor: locked ? 'not-allowed' : 'pointer',
 opacity: locked ? 0.85 : 1,
 height: '100%',
 transition: `all ${token.motionDurationMid} ${token.motionEaseInOut}`,
 });

 const stepContent = () => {
 if (step === 0) {
 return (
 <div>
 <Title level={4} style={{ marginTop: 0 }}>
 <FlagOutlined /> {t('onb_step_industry')}
 </Title>
 <Paragraph type="secondary">{t('onb_pick_industry_hint')}</Paragraph>
 <Row gutter={[12, 12]}>
 {INDUSTRIES.map(ind => {
 const active = industryId === ind.id;
 return (
 <Col xs={24} sm={12} md={8} key={ind.id}>
 <Card
 hoverable
 onClick={() => pickIndustry(ind.id)}
 role="button"
 tabIndex={0}
 aria-pressed={active}
 onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickIndustry(ind.id); } }}
 styles={{ body: { padding: 14 } }}
 style={cardStyle(active)}
 >
 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
 <span style={{ fontSize: 28 }} aria-hidden>{ind.icon}</span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <div style={{ fontWeight: 600, fontSize: 14 }}>{ind.title}</div>
 <Text type="secondary" style={{ fontSize: 12 }}>{ind.description}</Text>
 </div>
 {active && <CheckCircleFilled style={{ color: accent, fontSize: 20 }} />}
 </div>
 {ind.modules.length > 0 && (
 <div style={{ marginTop: 8 }}>
 <Tag>{ind.modules.length} {t('onb_modules_label')}</Tag>
 </div>
 )}
 </Card>
 </Col>
 );
 })}
 </Row>
 </div>
 );
 }

 if (step === 1) {
 const totalSel = selected.size;
 return (
 <div>
 <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
 <Title level={4} style={{ margin: 0 }}>
 <AppstoreOutlined /> {t('onb_step_modules')}
 </Title>
 <Space wrap>
 <Tag color="purple">{t('onb_selected_count', { count: totalSel })}</Tag>
 <Button onClick={selectAllVisible}>{t('onb_select_all')}</Button>
 <Button onClick={clearAllOptional}>{t('onb_clear_all')}</Button>
 <Input
 allowClear
 prefix={<SearchOutlined />}
 placeholder={t('onb_search_placeholder')}
 value={search}
 onChange={e => setSearch(e.target.value)}
 style={{ width: isMobile ? 160 : 220 }}
 aria-label={t('onb_search_placeholder')}
 />
 </Space>
 </Space>
 <Alert
 type="info"
 showIcon
 title={t('onb_customize_hint')}
 style={{ marginBottom: 12 }}
 />
 {filteredModules.length === 0 ? (
 <Empty description={t('onb_no_results')} />
 ) : (
 CATEGORY_ORDER.map(cat => {
 const items = grouped.get(cat);
 if (!items || items.length === 0) return null;
 const catLabel = t(CATEGORY_KEY[cat].key, CATEGORY_KEY[cat].fallback);
 return (
 <div key={cat} style={{ marginBottom: 18 }}>
 <Divider style={{ margin: '8px 0' }}>
 <Text strong>{catLabel}</Text>
 <Text type="secondary" style={{ marginInlineStart: 8, fontSize: 12 }}>({items.length})</Text>
 </Divider>
 <Row gutter={[10, 10]}>
 {items.map(m => {
 const checked = selected.has(m.key);
 const locked = ALWAYS_ON.includes(m.key);
 const label = t(m.labelKey, m.title);
 return (
 <Col xs={24} sm={12} md={8} key={m.key}>
 <Card
 hoverable={!locked}
 onClick={() => !locked && toggle(m.key)}
 role="button"
 tabIndex={locked ? -1 : 0}
 aria-pressed={checked}
 aria-disabled={locked}
 onKeyDown={(e) => { if (!locked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(m.key); } }}
 styles={{ body: { padding: 12 } }}
 style={cardStyle(checked, locked)}
 >
 <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
 <span style={{ fontSize: 22 }} aria-hidden>{m.icon}</span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
 <Text strong style={{ fontSize: 13 }}>{label}</Text>
 <Checkbox
 checked={checked}
 disabled={locked}
 onClick={e => e.stopPropagation()}
 onChange={() => toggle(m.key)}
 aria-label={label}
 />
 </div>
 <Text type="secondary" style={{ fontSize: 11, display: 'block', lineHeight: 1.4 }}>{m.description}</Text>
 {locked && <Tag color="default" style={{ marginTop: 4 }}>🔒 {t('onb_required_module')}</Tag>}
 </div>
 </div>
 </Card>
 </Col>
 );
 })}
 </Row>
 </div>
 );
 })
 )}
 </div>
 );
 }

 // step 2 — review
 const enabledList = Array.from(selected)
 .map(k => MODULES.find(m => m.key === k))
 .filter((m): m is ModuleDef => !!m);
 const ind = INDUSTRIES.find(i => i.id === industryId);

 return (
 <div>
 <Title level={4} style={{ marginTop: 0 }}>
 <RocketOutlined /> {t('onb_step_review')}
 </Title>
 <Paragraph type="secondary">{t('onb_review_hint')} — {t('onb_change_later')}</Paragraph>

 {ind && (
 <Card style={{ marginBottom: 12 }} styles={{ body: { padding: 12 } }}>
 <Space>
 <span style={{ fontSize: 28 }} aria-hidden>{ind.icon}</span>
 <div>
 <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{t('onb_industry_label')}</Text>
 <Text strong style={{ fontSize: 14 }}>{ind.title}</Text>
 <div><Text type="secondary" style={{ fontSize: 12 }}>{ind.description}</Text></div>
 </div>
 </Space>
 </Card>
 )}

 <Card title={`${t('onb_modules_label')} (${enabledList.length})`} styles={{ body: { padding: 12 } }}>
 <Space wrap>
 {enabledList.map(m => (
 <Tag key={m.key} color={ALWAYS_ON.includes(m.key) ? 'green' : 'blue'} style={{ fontSize: 12, padding: '4px 10px' }}>
 {m.icon} {t(m.labelKey, m.title)}
 </Tag>
 ))}
 {enabledList.length === 0 && <Empty description={t('onb_no_results')} />}
 </Space>
 </Card>
 </div>
 );
 };

 const canNext = step === 0 ? !!industryId : true;

 return (
 <FormDialog
 open={open}
 onClose={firstTime ? () => {} : onClose}
 title={t('onb_welcome')}
 hideFooter
 >
 {firstTime && (
 <Alert
 type="success"
 showIcon
 title={t('onb_welcome_sub')}
 style={{ marginBottom: 12 }}
 />
 )}
 <Steps
 current={step}
 responsive
 style={{ marginBottom: 20 }}
 items={[
 { title: t('onb_step_industry') },
 { title: t('onb_step_modules') },
 { title: t('onb_step_review') },
 ]}
 />

 <div style={{ minHeight: isMobile ? 280 : 360 }}>{stepContent()}</div>

 <Divider style={{ margin: '16px 0 12px' }} />

 <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
 {firstTime ? (
 <span />
 ) : (
 <Button onClick={onClose} disabled={saving}>{t('onb_skip')}</Button>
 )}
 <Space>
 {step > 0 && (
 <Button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={saving}>
 {t('onb_back')}
 </Button>
 )}
 {step < 2 ? (
 <Button type="primary" disabled={!canNext} onClick={() => setStep(s => s + 1)}>
 {t('onb_next')}
 </Button>
 ) : (
 <Button type="primary" icon={<RocketOutlined />} loading={saving} onClick={finish}>
 {saving ? t('onb_saving') : t('onb_finish')}
 </Button>
 )}
 </Space>
 </div>
 </FormDialog>
 );
}
