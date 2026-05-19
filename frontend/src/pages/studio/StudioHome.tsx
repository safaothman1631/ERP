import type React from 'react';
import { useState, useEffect } from 'react';
import { Card, Row, Col, Badge, Tag, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  FileTextOutlined, TeamOutlined, ShoppingOutlined, ProjectOutlined,
  ShopOutlined, BankOutlined, InboxOutlined, SettingOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import api from '../../api';

interface EntityCard {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  customFieldCount?: number;
  hasCustomizations?: boolean;
}

const StudioHome: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [entities, setEntities] = useState<EntityCard[]>([]);
  const [loading, setLoading] = useState(true);

  const baseEntities: Omit<EntityCard, 'customFieldCount' | 'hasCustomizations'>[] = [
    { key: 'invoice', label: t('invoices'), icon: <FileTextOutlined />, color: '#6366f1' },
    { key: 'quote', label: t('quotes'), icon: <FileTextOutlined />, color: '#10b981' },
    { key: 'contact', label: t('contacts'), icon: <TeamOutlined />, color: '#f59e0b' },
    { key: 'item', label: t('items'), icon: <ShoppingOutlined />, color: '#ec4899' },
    { key: 'sales_order', label: t('sales_orders'), icon: <FileTextOutlined />, color: '#8b5cf6' },
    { key: 'purchase_order', label: t('purchase_orders'), icon: <ShoppingOutlined />, color: '#06b6d4' },
    { key: 'bill', label: t('bills'), icon: <FileTextOutlined />, color: '#ef4444' },
    { key: 'lead', label: t('leads'), icon: <TeamOutlined />, color: '#3b82f6' },
    { key: 'project', label: t('projects'), icon: <ProjectOutlined />, color: '#14b8a6' },
    { key: 'pos_order', label: t('pos.orders'), icon: <ShopOutlined />, color: '#f97316' },
    { key: 'journal', label: t('journals'), icon: <BankOutlined />, color: '#64748b' },
    { key: 'inventory', label: t('inventory'), icon: <InboxOutlined />, color: '#84cc16' },
  ];

  useEffect(() => {
    void fetchCustomFieldCounts();
  }, []);

  const fetchCustomFieldCounts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/custom-fields');
      const fields = res.data || [];

      const countMap: Record<string, number> = {};
      fields.forEach((f: any) => {
        countMap[f.entity_type] = (countMap[f.entity_type] || 0) + 1;
      });

      const enriched = baseEntities.map((e) => ({
        ...e,
        customFieldCount: countMap[e.key] || 0,
        hasCustomizations: (countMap[e.key] || 0) > 0,
      }));

      setEntities(enriched);
    } catch {
      setEntities(baseEntities.map((e) => ({ ...e, customFieldCount: 0, hasCustomizations: false })));
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (entityKey: string) => {
    navigate(`/studio/${entityKey}/fields`);
  };

  return (
    <div>
      <PageHeader
        title={t('studio.title', 'Studio (No-Code)')}
        subtitle={t('studio.home_subtitle', 'Customize and extend any entity with no code')}
        breadcrumb={[{ label: t('home'), to: '/' }, { label: t('studio.title') }]}
      />

      <Row gutter={[space.md, space.md]}>
        {entities.map((entity) => (
          <Col key={entity.key} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              loading={loading}
              onClick={() => handleCardClick(entity.key)}
              style={{ height: '100%', borderRadius: 12 }}
            >
              <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 32, color: entity.color }}>
                    {entity.icon}
                  </div>
                  {entity.hasCustomizations && (
                    <Badge status="success" text={t('studio.customized', 'Customized')} />
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: space.xs }}>
                    {entity.label}
                  </div>
                  <Space size={space.xs} wrap>
                    <Tag color={entity.color} style={{ margin: 0 }}>
                      {t('studio.custom_fields_count', { count: entity.customFieldCount || 0 })}
                    </Tag>
                  </Space>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ marginTop: space.lg }}>
        <div style={{ textAlign: 'center', padding: space.lg }}>
          <AppstoreOutlined style={{ fontSize: 48, color: '#6366f1', marginBottom: space.md }} />
          <h3>{t('studio.what_can_you_do', 'What can you do in Studio?')}</h3>
          <Row gutter={[space.md, space.md]} style={{ marginTop: space.md }}>
            <Col xs={24} md={8}>
              <div>
                <SettingOutlined style={{ fontSize: 24, color: '#10b981' }} />
                <h4>{t('studio.custom_fields', 'Custom Fields')}</h4>
                <p>{t('studio.custom_fields_desc', 'Add custom fields to any entity')}</p>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div>
                <AppstoreOutlined style={{ fontSize: 24, color: '#f59e0b' }} />
                <h4>{t('studio.view_layout', 'View Layout')}</h4>
                <p>{t('studio.view_layout_desc', 'Control field visibility in forms and lists')}</p>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div>
                <ProjectOutlined style={{ fontSize: 24, color: '#ec4899' }} />
                <h4>{t('studio.automation', 'Automation')}</h4>
                <p>{t('studio.automation_desc', 'Create workflows for any entity')}</p>
              </div>
            </Col>
          </Row>
        </div>
      </Card>
    </div>
  );
};

export default StudioHome;
