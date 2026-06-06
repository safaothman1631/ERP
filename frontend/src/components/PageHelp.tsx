import React from 'react';
import { Typography, Tag, Divider, Alert, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { QuestionCircleFilled } from '@ant-design/icons';
import { FormDialog } from './responsive/FormDialog';

const { Title, Paragraph, Text } = Typography;

export interface PageHelpField {
 name: string;
 required?: boolean;
 description: string;
}

export type PageHelpSection =
 | 'getting-started'
 | 'sales'
 | 'purchases'
 | 'banking'
 | 'inventory'
 | 'accounting'
 | 'reports'
 | 'pos'
 | 'crm'
 | 'hr'
 | 'projects'
 | 'setup'
 | 'system';

export interface PageHelpContent {
 title: string;
 purpose: string;
 section?: PageHelpSection;
 fields?: PageHelpField[];
 workflow?: string[];
 tips?: string[];
 warnings?: string[];
 related?: string[]; // related pageKeys
 shortcuts?: { keys: string; description: string }[];
}

interface PageHelpProps {
 open: boolean;
 onClose: () => void;
 content: PageHelpContent;
}

/**
 * Centralized help drawer. Each page passes its own content via the
 * `frontend/src/data/page-help.ts` registry.
 */
const PageHelp: React.FC<PageHelpProps> = ({ open, onClose, content }) => {
 const { t } = useTranslation();

 return (
 <FormDialog
 title={
 <Space>
 <QuestionCircleFilled style={{ color: '#7B61FF' }} />
 <span>{content.title}</span>
 </Space>
 }
 open={open}
 onClose={onClose}
 >
 <Title level={5}>{t('help_purpose')}</Title>
 <Paragraph>{content.purpose}</Paragraph>

 {content.fields && content.fields.length > 0 && (
 <>
 <Divider />
 <Title level={5}>{t('help_fields')}</Title>
 {content.fields.map((f) => (
 <div key={f.name} style={{ marginBottom: 12 }}>
 <Space>
 <Text strong>{f.name}</Text>
 {f.required && <Tag color="red">{t('required')}</Tag>}
 </Space>
 <Paragraph type="secondary" style={{ marginBottom: 0 }}>
 {f.description}
 </Paragraph>
 </div>
 ))}
 </>
 )}

 {content.workflow && content.workflow.length > 0 && (
 <>
 <Divider />
 <Title level={5}>{t('help_workflow')}</Title>
 <ol style={{ paddingInlineStart: 20 }}>
 {content.workflow.map((step, i) => (
 <li key={i} style={{ marginBottom: 6 }}>
 {step}
 </li>
 ))}
 </ol>
 </>
 )}

 {content.tips && content.tips.length > 0 && (
 <>
 <Divider />
 <Title level={5}>{t('help_tips')}</Title>
 <ul style={{ paddingInlineStart: 20 }}>
 {content.tips.map((tip, i) => (
 <li key={i} style={{ marginBottom: 6 }}>
 {tip}
 </li>
 ))}
 </ul>
 </>
 )}

 {content.warnings && content.warnings.length > 0 && (
 <>
 <Divider />
 {content.warnings.map((w, i) => (
 <Alert key={i} type="warning" message={w} style={{ marginBottom: 8 }} />
 ))}
 </>
 )}

 {content.shortcuts && content.shortcuts.length > 0 && (
 <>
 <Divider />
 <Title level={5}>{t('help_shortcuts', 'Keyboard shortcuts')}</Title>
 {content.shortcuts.map((s, i) => (
 <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
 <Tag style={{ fontFamily: 'monospace' }}>{s.keys}</Tag>
 <Text type="secondary">{s.description}</Text>
 </div>
 ))}
 </>
 )}

 {content.related && content.related.length > 0 && (
 <>
 <Divider />
 <Title level={5}>{t('help_related', 'Related pages')}</Title>
 <Space wrap>
 {content.related.map((r) => (
 <Tag key={r} color="blue">{r}</Tag>
 ))}
 </Space>
 </>
 )}
 </FormDialog>
 );
};

export default PageHelp;
