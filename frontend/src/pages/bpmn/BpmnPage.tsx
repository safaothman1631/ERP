import React, { useEffect, useState } from 'react';
import { Button, Modal, Form, Input, Select, Space, Tag, message } from 'antd';
import { PlusOutlined, ReloadOutlined, ForwardOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, SectionCard, StatusTag, EmptyState } from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { space } from '../../theme/tokens';

interface Transition { from: string; to: string; on: string }
interface WorkflowDef {
  id: string;
  name?: string;
  states?: string[];
  start?: string;
  end?: string[];
  transitions?: Transition[];
}
interface WorkflowInstance {
  id: string;
  definition_id: string;
  state?: string;
  status?: string;
  history?: Array<Record<string, unknown>>;
}

const BpmnPage: React.FC = () => {
  const { t } = useTranslation();
  const [defs, setDefs] = useState<WorkflowDef[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [defModalOpen, setDefModalOpen] = useState(false);
  const [advanceFor, setAdvanceFor] = useState<WorkflowInstance | null>(null);
  const [defForm] = Form.useForm();
  const [advanceEvent, setAdvanceEvent] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [d, i] = await Promise.all([
        api.get('/api/bpmn/definitions').then((r) => r.data).catch(() => []),
        api.get('/api/bpmn/instances').then((r) => r.data).catch(() => []),
      ]);
      setDefs(Array.isArray(d) ? d : d?.items || []);
      setInstances(Array.isArray(i) ? i : i?.items || []);
    } catch {
      message.error(t('error', 'هەڵەیەک ڕوویدا'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createDef = async () => {
    const v = await defForm.validateFields();
    const states = String(v.states || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    let transitions: Transition[] = [];
    try {
      transitions = v.transitions ? JSON.parse(v.transitions) : [];
    } catch {
      message.error(t('bpmn.bad_transitions', 'فۆرماتی transitions دروست نییە (JSON)'));
      return;
    }
    try {
      await api.post('/api/bpmn/definitions', {
        name: v.name, states, start: v.start, end: states.length ? [states[states.length - 1]] : [], transitions,
      });
      message.success(t('saved', 'پاشەکەوتکرا'));
      setDefModalOpen(false);
      defForm.resetFields();
      load();
    } catch { /* interceptor toasts */ }
  };

  const createInstance = async (definitionId: string) => {
    try {
      await api.post('/api/bpmn/instances', { definition_id: definitionId });
      message.success(t('bpmn.instance_created', 'نموونە دروستکرا'));
      load();
    } catch { /* interceptor toasts */ }
  };

  const advance = async () => {
    if (!advanceFor || !advanceEvent) return;
    try {
      await api.post(`/api/bpmn/instances/${advanceFor.id}/advance`, { event: advanceEvent });
      message.success(t('bpmn.advanced', 'گواسترا'));
      setAdvanceFor(null);
      setAdvanceEvent('');
      load();
    } catch { /* interceptor toasts the WorkflowError 409 */ }
  };

  const defColumns = [
    { title: t('bpmn.name', 'ناو'), dataIndex: 'name', key: 'name', render: (v: string, r: WorkflowDef) => v || r.id },
    { title: t('bpmn.states', 'دۆخەکان'), key: 'states', render: (_: unknown, r: WorkflowDef) => (r.states || []).length },
    { title: t('bpmn.start', 'دەستپێک'), dataIndex: 'start', key: 'start' },
    {
      title: t('actions', 'کردارەکان'), key: 'a',
      render: (_: unknown, r: WorkflowDef) => (
        <Button size="small" icon={<PlusOutlined />} onClick={() => createInstance(r.id)}>
          {t('bpmn.new_instance', 'نموونەی نوێ')}
        </Button>
      ),
    },
  ];

  const instColumns = [
    { title: t('bpmn.definition', 'پێناسە'), dataIndex: 'definition_id', key: 'def' },
    {
      title: t('bpmn.state', 'دۆخ'), dataIndex: 'state', key: 'state',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: t('status', 'بار'), dataIndex: 'status', key: 'status',
      render: (v: string) => <StatusTag status={v === 'completed' ? 'success' : 'default'} label={v || '—'} />,
    },
    {
      title: t('actions', 'کردارەکان'), key: 'a',
      render: (_: unknown, r: WorkflowInstance) => (
        <Button size="small" icon={<ForwardOutlined />} disabled={r.status === 'completed'}
          onClick={() => { setAdvanceFor(r); setAdvanceEvent(''); }}>
          {t('bpmn.advance', 'بەرەوپێش')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('bpmn.title', 'وۆرکفلۆ (BPMN)')}
        subtitle={t('bpmn.subtitle', 'پێناسە و نموونەکانی وۆرکفلۆ بەڕێوەببە')}
        extra={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh', 'نوێکردنەوە')}</Button>
            <Button type="primary" icon={<NodeIndexOutlined />} onClick={() => setDefModalOpen(true)}>
              {t('bpmn.new_def', 'پێناسەی نوێ')}
            </Button>
          </Space>
        )}
      />

      <SectionCard title={t('bpmn.definitions', 'پێناسەکان')} style={{ marginBlockEnd: space.lg }}>
        {defs.length === 0 && !loading
          ? <EmptyState title={t('bpmn.no_defs', 'هیچ پێناسەیەک نییە')} actionLabel={t('bpmn.new_def', 'پێناسەی نوێ')} onAction={() => setDefModalOpen(true)} />
          : <ResponsiveTableAdapter rowKey="id" loading={loading} dataSource={defs} columns={defColumns} pagination={false} />}
      </SectionCard>

      <SectionCard title={t('bpmn.instances', 'نموونەکان')}>
        {instances.length === 0 && !loading
          ? <EmptyState title={t('bpmn.no_instances', 'هیچ نموونەیەک نییە')} />
          : <ResponsiveTableAdapter rowKey="id" loading={loading} dataSource={instances} columns={instColumns} pagination={false} />}
      </SectionCard>

      <Modal title={t('bpmn.new_def', 'پێناسەی نوێ')} open={defModalOpen}
        onCancel={() => setDefModalOpen(false)} onOk={createDef} okText={t('save', 'پاشەکەوت')}>
        <Form form={defForm} layout="vertical">
          <Form.Item name="name" label={t('bpmn.name', 'ناو')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="states" label={t('bpmn.states_csv', 'دۆخەکان (بە کۆما)')} rules={[{ required: true }]}>
            <Input placeholder="draft, sent, paid" />
          </Form.Item>
          <Form.Item name="start" label={t('bpmn.start', 'دەستپێک')} rules={[{ required: true }]}>
            <Input placeholder="draft" />
          </Form.Item>
          <Form.Item name="transitions" label={t('bpmn.transitions_json', 'گواستنەوەکان (JSON)')}>
            <Input.TextArea rows={4} placeholder='[{"from":"draft","to":"sent","on":"send"}]' />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('bpmn.advance', 'بەرەوپێش')} open={!!advanceFor}
        onCancel={() => setAdvanceFor(null)} onOk={advance} okText={t('bpmn.advance', 'بەرەوپێش')}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <span>{t('bpmn.current_state', 'دۆخی ئێستا')}: <Tag color="blue">{advanceFor?.state}</Tag></span>
          <Select value={advanceEvent || undefined} onChange={setAdvanceEvent} style={{ width: '100%' }}
            placeholder={t('bpmn.pick_event', 'ڕووداو هەڵبژێرە')}
            options={(defs.find((d) => d.id === advanceFor?.definition_id)?.transitions || [])
              .filter((tr) => tr.from === advanceFor?.state)
              .map((tr) => ({ value: tr.on, label: `${tr.on} → ${tr.to}` }))} />
        </Space>
      </Modal>
    </div>
  );
};

export default BpmnPage;
