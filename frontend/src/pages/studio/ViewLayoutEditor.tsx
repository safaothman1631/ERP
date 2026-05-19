import type React from 'react';
import { useState, useEffect } from 'react';
import { Button, Space, Switch, Tag, Card, Tabs, Segmented } from 'antd';
import { message } from '../../utils/message';
import { ArrowUpOutlined, ArrowDownOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

interface FieldLayout {
  field_name: string;
  field_label: string;
  visible_in_form: boolean;
  visible_in_list: boolean;
  visible_in_print: boolean;
  sort_order: number;
  is_system: boolean;
}

const ViewLayoutEditor: React.FC = () => {
  const { t } = useTranslation();
  const { entity } = useParams<{ entity: string }>();
  const navigate = useNavigate();
  const [fields, setFields] = useState<FieldLayout[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'form' | 'list' | 'print'>('form');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (entity) {
      void fetchLayout();
    }
  }, [entity]);

  const fetchLayout = async () => {
    setLoading(true);
    try {
      // Try persisted layout first
      let persisted: FieldLayout[] = [];
      try {
        const layoutRes = await api.get(`/api/studio/view-layouts/${entity}`);
        persisted = layoutRes.data?.fields || [];
      } catch {
        persisted = [];
      }

      const res = await api.get('/api/custom-fields', { params: { entity_type: entity } });
      const customFields = res.data || [];

      const systemFields: FieldLayout[] = [
        { field_name: 'id', field_label: 'ID', visible_in_form: false, visible_in_list: true, visible_in_print: true, sort_order: 0, is_system: true },
        { field_name: 'date', field_label: 'Date', visible_in_form: true, visible_in_list: true, visible_in_print: true, sort_order: 1, is_system: true },
        { field_name: 'reference', field_label: 'Reference', visible_in_form: true, visible_in_list: true, visible_in_print: true, sort_order: 2, is_system: true },
        { field_name: 'status', field_label: 'Status', visible_in_form: true, visible_in_list: true, visible_in_print: true, sort_order: 3, is_system: true },
        { field_name: 'total', field_label: 'Total', visible_in_form: true, visible_in_list: true, visible_in_print: true, sort_order: 4, is_system: true },
      ];

      const customFieldLayouts: FieldLayout[] = customFields.map((cf: any, i: number) => ({
        field_name: cf.field_name,
        field_label: cf.field_label,
        visible_in_form: true,
        visible_in_list: true,
        visible_in_print: true,
        sort_order: systemFields.length + i,
        is_system: false,
      }));

      const merged = [...systemFields, ...customFieldLayouts];
      // Overlay persisted overrides by field_name
      if (persisted.length) {
        const byName = new Map(persisted.map((p) => [p.field_name, p]));
        const enriched = merged.map((f) => {
          const p = byName.get(f.field_name);
          return p ? { ...f, ...p, is_system: f.is_system } : f;
        });
        enriched.sort((a, b) => a.sort_order - b.sort_order);
        setFields(enriched);
      } else {
        setFields(merged);
      }
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = (index: number, view: 'form' | 'list' | 'print') => {
    const updated = [...fields];
    const key = `visible_in_${view}` as keyof FieldLayout;
    updated[index] = { ...updated[index], [key]: !updated[index][key] };
    setFields(updated);
    setHasChanges(true);
  };

  const handleReorder = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    const reordered = [...fields];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);

    const withUpdatedOrder = reordered.map((f, i) => ({ ...f, sort_order: i }));
    setFields(withUpdatedOrder);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!entity) return;
    try {
      await api.put(`/api/studio/view-layouts/${entity}`, { fields });
      message.success(t('saved', 'Saved'));
      setHasChanges(false);
    } catch {
      message.error(t('error'));
    }
  };

  const columnsForm = [
    {
      title: t('studio.field_name', 'Field'),
      dataIndex: 'field_name',
      key: 'field_name',
      render: (v: string, record: FieldLayout) => (
        <Space>
          <span style={{ fontFamily: 'monospace', fontWeight: record.is_system ? 400 : 600 }}>{v}</span>
          {record.is_system && <Tag color="blue">{t('studio.system', 'System')}</Tag>}
        </Space>
      ),
    },
    {
      title: t('studio.field_label', 'Label'),
      dataIndex: 'field_label',
      key: 'field_label',
    },
    {
      title: t('studio.visible', 'Visible'),
      key: 'visible',
      width: 120,
      render: (_: any, record: FieldLayout, index: number) => (
        <Switch
          checked={activeView === 'form' ? record.visible_in_form : activeView === 'list' ? record.visible_in_list : record.visible_in_print}
          onChange={() => handleToggleVisibility(index, activeView)}
        />
      ),
    },
    {
      title: t('studio.order', 'Order'),
      key: 'order',
      width: 120,
      render: (_: any, __: any, index: number) => (
        <Space size="small">
          <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => handleReorder(index, 'up')} />
          <Button size="small" icon={<ArrowDownOutlined />} disabled={index === fields.length - 1} onClick={() => handleReorder(index, 'down')} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('studio.view_layout_editor', 'View Layout Editor')}
        subtitle={t('studio.entity_layout', { entity: t(entity || '') })}
        breadcrumb={[
          { label: t('home'), to: '/' },
          { label: t('studio.title'), to: '/studio' },
          { label: t(entity || ''), to: `/studio/${entity}/fields` },
          { label: t('studio.view_layout', 'Layout') },
        ]}
        extra={
          <Space size={space.sm}>
            <Button onClick={() => navigate(`/studio/${entity}/fields`)}>
              {t('studio.back_to_fields', 'Back to Fields')}
            </Button>
            {hasChanges && (
              <Button type="primary" onClick={handleSave}>
                {t('save')}
              </Button>
            )}
          </Space>
        }
      />

      <Card>
        <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Segmented
              options={[
                { label: t('studio.form_view', 'Form View'), value: 'form', icon: <EyeOutlined /> },
                { label: t('studio.list_view', 'List View'), value: 'list', icon: <EyeOutlined /> },
                { label: t('studio.print_view', 'Print View'), value: 'print', icon: <EyeOutlined /> },
              ]}
              value={activeView}
              onChange={(v) => setActiveView(v as 'form' | 'list' | 'print')}
            />
            <Tag color="orange">
              {t('studio.visible_count', {
                count: fields.filter(
                  (f) =>
                    (activeView === 'form' && f.visible_in_form) ||
                    (activeView === 'list' && f.visible_in_list) ||
                    (activeView === 'print' && f.visible_in_print)
                ).length,
              })}
            </Tag>
          </div>

          <ResponsiveTableAdapter
            columns={columnsForm}
            dataSource={fields}
            rowKey="field_name"
            loading={loading}
            pagination={false}
            size="small"
          />

          {hasChanges && (
            <div style={{ padding: space.md, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
              {t('studio.unsaved_changes', 'You have unsaved changes')}
            </div>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default ViewLayoutEditor;
