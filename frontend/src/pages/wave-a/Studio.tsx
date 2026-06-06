import React, { useEffect, useState } from 'react';
import { Button, Space, Tag, message, Card } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const Studio: React.FC = () => {
  const { t } = useTranslation();
  const [models, setModels] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/studio/models', { params: { limit: 100 } });
      setModels(res.data.items || []);
    } catch (_error) {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async (modelName: string) => {
    setLoading(true);
    try {
      const res = await api.get('/api/studio/fields', { params: { model_name: modelName, limit: 200 } });
      setFields(res.data.items || []);
    } catch (_error) {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchModels();
  }, []);

  const handleViewFields = (modelName: string) => {
    setSelectedModel(modelName);
    void fetchFields(modelName);
  };

  const modelsColumns = [
    { title: t('studio.model_name'), dataIndex: 'name', key: 'name' },
    { title: t('studio.label_singular'), dataIndex: 'label_singular', key: 'label_singular' },
    { title: t('studio.label_plural'), dataIndex: 'label_plural', key: 'label_plural' },
    { title: t('studio.description'), dataIndex: 'description', key: 'description' },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleViewFields(record.name)} title={t('studio.view_fields')} />
        </Space>
      ),
    },
  ];

  const fieldsColumns = [
    { title: t('studio.field_name'), dataIndex: 'name', key: 'name' },
    { title: t('studio.label'), dataIndex: 'label', key: 'label' },
    { title: t('studio.type'), dataIndex: 'type', key: 'type', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: t('studio.required'), dataIndex: 'required', key: 'required', render: (v: boolean) => v ? <Tag color="red">{t('studio.required')}</Tag> : <Tag>{t('studio.optional')}</Tag> },
  ];

  return (
    <div>
      <PageHeader
        title={t('studio.title')}
        subtitle={t('studio.subtitle')}
      />
      <Card style={{ marginTop: space.md }}>
        <h3>{t('studio.custom_models')}</h3>
        <ResponsiveTableAdapter dataSource={models} columns={modelsColumns} loading={loading} rowKey="name" />
      </Card>

      {selectedModel && (
        <Card style={{ marginTop: space.md }}>
          <h3>{t('studio.fields_for', { model: selectedModel })}</h3>
          <ResponsiveTableAdapter dataSource={fields} columns={fieldsColumns} loading={loading} rowKey="name" />
          <Button style={{ marginTop: space.md }} onClick={() => { setSelectedModel(null); setFields([]); }}>
            {t('studio.back_to_models')}
          </Button>
        </Card>
      )}
    </div>
  );
};

export default Studio;
