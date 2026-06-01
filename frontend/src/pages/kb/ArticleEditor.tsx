import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, Switch, Button, Space, List, message } from 'antd';
import { SaveOutlined, EyeOutlined, HistoryOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, LoadingSkeleton, SectionCard } from '../../design-system';
import { space } from '../../theme/tokens';
import { FormDialog } from '../../components/responsive/FormDialog';
import { useLoadingState } from '../../hooks/useLoadingState';

interface Category { id: string; name: string; }
interface Version {
 id: string;
 version_number: number;
 title: string;
 body: string;
 edited_by: string;
 created_at: string;
}

export default function ArticleEditor() {
 const { id } = useParams<{ id: string }>();
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [form] = Form.useForm();
 const [categories, setCategories] = useState<Category[]>([]);
 const [versions, setVersions] = useState<Version[]>([]);
 const [versionDrawer, setVersionDrawer] = useState(false);
 const [loading, setLoading] = useState(false);
 const { showSkeleton } = useLoadingState(loading);

 const load = async () => {
 setLoading(true);
 try {
 const catRes = await api.get('/api/knowledge/categories');
 setCategories(catRes.data.items || []);
 if (id) {
 const artRes = await api.get(`/api/knowledge/articles/${id}`);
 form.setFieldsValue(artRes.data);
 const verRes = await api.get(`/api/knowledge/articles/${id}/versions`);
 setVersions(verRes.data.items || []);
 }
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 load();
 }, [id]);

 const onSave = async () => {
 const v = await form.validateFields();
 try {
 if (id) {
 await api.patch(`/api/knowledge/articles/${id}`, v);
 message.success(t('updated'));
 } else {
 const res = await api.post('/api/knowledge/articles', v);
 message.success(t('created'));
 navigate(`/kb/articles/${res.data.id}`);
 }
 } catch {
 message.error(t('error'));
 }
 };

 const onPublishToggle = async () => {
 if (!id) return;
 const current = form.getFieldValue('is_published');
 try {
 if (current) {
 await api.post(`/api/knowledge/articles/${id}/unpublish`);
 message.success(t('kb.unpublished'));
 form.setFieldsValue({ is_published: false });
 } else {
 await api.post(`/api/knowledge/articles/${id}/publish`);
 message.success(t('kb.published'));
 form.setFieldsValue({ is_published: true });
 }
 } catch {
 message.error(t('error'));
 }
 };

 if (showSkeleton) {
 return <LoadingSkeleton variant="card" />;
 }

 return (
 <div style={{ padding: space.lg }}>
 <PageHeader
 title={id ? t('kb.edit_article') : t('kb.new_article')}
 extra={
 <Space>
 {id && (
 <Button icon={<HistoryOutlined />} onClick={() => setVersionDrawer(true)}>
 {t('kb.version_history')}
 </Button>
 )}
 {id && (
 <Button icon={<EyeOutlined />} onClick={() => navigate(`/kb/articles/${id}`)}>
 {t('kb.view')}
 </Button>
 )}
 <Button type="primary" icon={<SaveOutlined />} onClick={onSave}>
 {t('save')}
 </Button>
 </Space>
 }
 />
 <SectionCard style={{ marginTop: space.md }}>
 <Form form={form} layout="vertical">
 <Form.Item name="title" label={t('kb.title')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="category_id" label={t('kb.category')}>
 <Select allowClear>
 {categories.map((c) => (
 <Select.Option key={c.id} value={c.id}>
 {c.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="body" label={t('kb.body')} rules={[{ required: true }]}>
 <Input.TextArea rows={15} />
 </Form.Item>
 <Form.Item name="tags" label={t('kb.tags')}>
 <Select mode="tags" tokenSeparators={[',']} />
 </Form.Item>
 <Form.Item name="is_published" valuePropName="checked" label={t('kb.published')}>
 <Switch onChange={onPublishToggle} />
 </Form.Item>
 <Form.Item name="is_public" valuePropName="checked" label={t('kb.public_article')}>
 <Switch />
 </Form.Item>
 </Form>
 </SectionCard>

 <FormDialog
 title={t('kb.version_history')}
 open={versionDrawer}
 onClose={() => setVersionDrawer(false)}
 >
 <List
 dataSource={versions}
 renderItem={(v) => (
 <List.Item>
 <List.Item.Meta
 title={`v${v.version_number} — ${v.title}`}
 description={
 <>
 <div>{t('kb.edited_by')}: {v.edited_by}</div>
 <div>{new Date(v.created_at).toLocaleString()}</div>
 </>
 }
 />
 </List.Item>
 )}
 locale={{ emptyText: t('kb.no_versions') }}
 />
 </FormDialog>
 </div>
 );
}
