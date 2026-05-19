import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Divider, Typography, Space } from 'antd';
import {
 InfoCircleOutlined,
 TeamOutlined,
 DatabaseOutlined,
 LinkOutlined,
 BulbOutlined,
 ArrowRightOutlined,
} from '@ant-design/icons';
import { SECTION_DOCS } from '../docs';
import type { SectionDoc, SubArea } from '../docs/types';
import { FormDialog } from './responsive/FormDialog';

const { Text, Paragraph } = Typography;

interface SectionDocsDrawerProps {
 sectionKey: string | null;
 onClose: () => void;
 isDark?: boolean;
 isRTL?: boolean;
}

const SubAreaCard: React.FC<{ area: SubArea; isDark: boolean }> = ({ area, isDark }) => (
 <div style={{
 padding: '12px 14px',
 borderRadius: 8,
 border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(148,163,184,0.14)'}`,
 background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(248,250,252,0.8)',
 marginBottom: 8,
 }}>
 <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
 {area.route ? (
 <a href={area.route} style={{ color: 'inherit', textDecoration: 'none' }}>
 {area.name} <ArrowRightOutlined style={{ fontSize: 10, opacity: 0.5 }} />
 </a>
 ) : area.name}
 </div>
 <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>{area.purpose}</div>
 {area.dataFlow && (
 <div style={{
 marginTop: 8,
 padding: '4px 8px',
 borderRadius: 5,
 background: isDark ? 'rgba(31,111,235,0.12)' : 'rgba(31,111,235,0.06)',
 fontSize: 11,
 color: isDark ? '#7eb3ff' : '#1a6bd0',
 fontFamily: 'monospace',
 lineHeight: 1.6,
 whiteSpace: 'pre-wrap',
 wordBreak: 'break-word',
 }}>
 {area.dataFlow}
 </div>
 )}
 </div>
);

const MermaidDiagram: React.FC<{ src: string }> = ({ src }) => (
 <div style={{
 padding: '10px 12px',
 borderRadius: 8,
 background: 'rgba(30, 41, 59, 0.95)',
 fontFamily: 'monospace',
 fontSize: 11,
 color: '#7dd3fc',
 whiteSpace: 'pre',
 overflowX: 'auto',
 lineHeight: 1.6,
 marginTop: 8,
 }}>
 {src}
 </div>
);

const SectionDocsDrawer: React.FC<SectionDocsDrawerProps> = ({
 sectionKey,
 onClose,
 isDark = false,
 isRTL = true,
}) => {
 const { t } = useTranslation();

 const doc: SectionDoc | null = useMemo(
 () => (sectionKey ? (SECTION_DOCS[sectionKey] ?? null) : null),
 [sectionKey],
 );

 const surface = isDark ? '#0b1220' : '#ffffff';
 const bodyBg = isDark ? '#0f1829' : '#f8fafc';
 const sectionHeadColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.4)';

 const sectionHeader = (icon: React.ReactNode, label: string) => (
 <Divider
 style={{ marginBlock: '14px 10px', fontSize: 11, color: sectionHeadColor, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(148,163,184,0.16)' }}
 titlePlacement="start"
 >
 <Space>
 {icon}
 <span style={{ textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>{label}</span>
 </Space>
 </Divider>
 );

 return (
 <FormDialog
 open={!!sectionKey && !!doc}
 onClose={onClose}
 placement={isRTL ? 'left' : 'right'}
 title={
 doc ? (
 <Space>
 <InfoCircleOutlined style={{ color: '#1f6feb' }} />
 <span style={{ fontWeight: 700, fontSize: 15 }}>{doc.title}</span>
 </Space>
 ) : null
 }
 styles={{
 header: { background: surface, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}` },
 body: { background: bodyBg, padding: '20px 20px 32px' },
 mask: { backdropFilter: 'blur(4px)' },
 }}
 data-theme={isDark ? 'dark' : 'light'}
 >
 {doc && (
 <>
 {/* Purpose */}
 <Paragraph style={{ fontSize: 13.5, lineHeight: 1.7, margin: 0 }}>
 {doc.purpose}
 </Paragraph>

 {/* Who uses */}
 {sectionHeader(<TeamOutlined />, t('docs.who_uses', 'Who uses this'))}
 <Space wrap>
 {doc.whoUses.map((r) => (
 <Tag key={r} color="blue" style={{ margin: 0, borderRadius: 6 }}>{r}</Tag>
 ))}
 </Space>

 {/* Sub-areas */}
 {sectionHeader(<AppOutlined />, t('docs.sub_areas', 'Sub-areas'))}
 {doc.subAreas.map((area) => (
 <SubAreaCard key={area.name} area={area} isDark={isDark} />
 ))}

 {/* Data flow diagram */}
 {doc.mermaidDiagram && (
 <>
 {sectionHeader(<ArrowRightOutlined />, t('docs.data_flow', 'Data flow'))}
 <MermaidDiagram src={doc.mermaidDiagram} />
 </>
 )}

 {/* Data destination */}
 {sectionHeader(<DatabaseOutlined />, t('docs.data_store', 'Data store'))}
 <Text style={{ fontSize: 12, fontFamily: 'monospace', opacity: 0.8 }}>
 {doc.dataDestination}
 </Text>

 {/* Related */}
 {doc.related.length > 0 && (
 <>
 {sectionHeader(<LinkOutlined />, t('docs.related', 'Related'))}
 <Space wrap>
 {doc.related.map((k) => (
 <Tag
 key={k}
 style={{ margin: 0, borderRadius: 6, cursor: 'default' }}
 color={isDark ? 'default' : 'default'}
 >
 {SECTION_DOCS[k]?.title ?? k}
 </Tag>
 ))}
 </Space>
 </>
 )}

 {/* KPIs */}
 {doc.kpis && doc.kpis.length > 0 && (
 <>
 {sectionHeader(<BulbOutlined />, t('docs.kpis', 'Key KPIs'))}
 <ul style={{ paddingInlineStart: 18, margin: 0 }}>
 {doc.kpis.map((kpi) => (
 <li key={kpi} style={{ fontSize: 12.5, lineHeight: 1.8 }}>{kpi}</li>
 ))}
 </ul>
 </>
 )}

 {/* Tips */}
 {doc.tips && doc.tips.length > 0 && (
 <>
 {sectionHeader(<BulbOutlined />, t('docs.tips', 'Tips'))}
 <ul style={{ paddingInlineStart: 18, margin: 0 }}>
 {doc.tips.map((tip) => (
 <li key={tip} style={{ fontSize: 12.5, lineHeight: 1.8, marginBottom: 4 }}>{tip}</li>
 ))}
 </ul>
 </>
 )}
 </>
 )}
 </FormDialog>
 );
};

// small icon placeholder for sub-areas section header
const AppOutlined = () => <span style={{ fontSize: 11 }}>⊞</span>;

export default SectionDocsDrawer;
