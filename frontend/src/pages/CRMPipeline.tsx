import { useEffect, useState } from 'react';
import { Card, Tag, Button, Modal, Form, Input, InputNumber, Select, Space, message, Spin, Empty } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';

interface Stage {
  id: string;
  name: string;
  sequence: number;
  color?: string;
  is_won?: boolean;
  is_lost?: boolean;
}

interface Opportunity {
  id: string;
  name: string;
  stage_id: string;
  amount: number;
  probability: number;
  close_date?: string;
  owner_id?: string;
  contact_id?: string;
  notes?: string;
}

const formatMoney = (n: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n) || 0);

export default function CRMPipeline() {
  const { t } = useTranslation();
  const [stages, setStages] = useState<Stage[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([
        api.get('/api/crm/stages'),
        api.get('/api/crm/opportunities', { params: { page_size: 200, status: 'open' } }),
      ]);
      setStages((s.data.items || []).sort((a: Stage, b: Stage) => a.sequence - b.sequence));
      setOpps(o.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onDrop = async (oppId: string, newStageId: string) => {
    const opp = opps.find((o) => o.id === oppId);
    if (!opp || opp.stage_id === newStageId) return;
    setOpps((prev) => prev.map((o) => (o.id === oppId ? { ...o, stage_id: newStageId } : o)));
    try {
      await api.put(`/api/crm/opportunities/${oppId}`, { stage_id: newStageId });
      message.success(t('saved'));
    } catch {
      load();
    }
  };

  const onCreate = async () => {
    const values = await form.validateFields();
    try {
      await api.post('/api/crm/opportunities', values);
      message.success(t('saved'));
      setModalOpen(false);
      form.resetFields();
      load();
    } catch {
      message.error(t('error'));
    }
  };

  const totalByStage = (sid: string) =>
    opps.filter((o) => o.stage_id === sid).reduce((s, o) => s + (Number(o.amount) || 0), 0);

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{t('pipeline')}</h2>
        <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          {t('new_opportunity')}
        </Button>
      </Space>

      {loading ? (
        <Spin />
      ) : stages.length === 0 ? (
        <Empty />
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', alignItems: 'flex-start' }}>
          {stages.map((stage) => {
            const stageOpps = opps.filter((o) => o.stage_id === stage.id);
            return (
              <div
                key={stage.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData('text/plain');
                  if (id) onDrop(id, stage.id);
                }}
                style={{
                  minWidth: 280,
                  background: '#fafafa',
                  borderRadius: 8,
                  padding: 8,
                  borderTop: `4px solid ${stage.color || '#1890ff'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px 8px' }}>
                  <strong>{stage.name}</strong>
                  <Tag>{stageOpps.length} · {formatMoney(totalByStage(stage.id))}</Tag>
                </div>

                {stageOpps.map((opp) => (
                  <Card
                    key={opp.id}
                    size="small"
                    style={{ marginBottom: 8, cursor: 'grab' }}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', opp.id)}
                  >
                    <div style={{ fontWeight: 600 }}>{opp.name}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>
                      {formatMoney(opp.amount)} · {opp.probability}%
                    </div>
                    {opp.close_date && (
                      <div style={{ color: '#999', fontSize: 11 }}>{opp.close_date}</div>
                    )}
                  </Card>
                ))}

                {stageOpps.length === 0 && (
                  <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center', padding: 16 }}>
                    {t('drop_here')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        title={t('new_opportunity')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={onCreate}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ amount: 0, probability: 50 }}>
          <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="stage_id" label={t('stage')} rules={[{ required: true }]}>
            <Select options={stages.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
          <Form.Item name="amount" label={t('amount')}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="probability" label={t('probability')}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
          <Form.Item name="close_date" label={t('close_date')}>
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="notes" label={t('notes')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
