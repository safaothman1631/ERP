import type React from 'react';
import { useState } from 'react';
import { Card, Button, Input, Space, Descriptions, Tag, Empty } from 'antd';
import { message } from '../../utils/message';
import { SearchOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';

const WarrantyCheck: React.FC = () => {
  const { t } = useTranslation();
  const [serialNo, setSerialNo] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!serialNo.trim()) {
      message.warning(t('repairs.serial_required'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/api/repairs/warranties/check/${encodeURIComponent(serialNo)}`);
      setResult(res.data);
      setSearched(true);
    } catch {
      message.error(t('error'));
      setResult(null);
      setSearched(false);
    } finally {
      setLoading(false);
    }
  };

  const underWarranty = result?.under_warranty || false;
  const warranty = result?.warranty;

  return (
    <div>
      <PageHeader
        title={t('repairs.warranty_check')}
        subtitle={t('repairs.warranty_check_subtitle')}
      />

      <Card style={{ marginBottom: space.md }}>
        <Space.Compact style={{ width: '100%', maxWidth: 500 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t('repairs.serial_no_placeholder')}
            value={serialNo}
            onChange={(e) => setSerialNo(e.target.value)}
            onPressEnter={handleSearch}
            size="large"
          />
          <Button type="primary" size="large" onClick={handleSearch} loading={loading}>
            {t('search')}
          </Button>
        </Space.Compact>
      </Card>

      {searched && (
        <Card>
          {!warranty ? (
            <Empty
              image={<CloseCircleOutlined style={{ fontSize: 64, color: '#ff4d4f' }} />}
              description={
                <Space direction="vertical">
                  <Tag color="red">{t('repairs.warranty_not_found')}</Tag>
                  <div>{t('repairs.no_warranty_message')}</div>
                </Space>
              }
            />
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: space.md }}>
                {underWarranty ? (
                  <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
                ) : (
                  <CloseCircleOutlined style={{ fontSize: 64, color: '#ff4d4f' }} />
                )}
                <div style={{ marginTop: space.sm, fontSize: 18, fontWeight: 600 }}>
                  {underWarranty ? (
                    <Tag color="green">{t('repairs.warranty_valid')}</Tag>
                  ) : (
                    <Tag color="red">{t('repairs.warranty_expired')}</Tag>
                  )}
                </div>
              </div>

              <Descriptions column={1} bordered>
                <Descriptions.Item label={t('repairs.serial_no')}>
                  {warranty.serial_no}
                </Descriptions.Item>
                <Descriptions.Item label={t('repairs.warranty_start')}>
                  {warranty.start_date ? dayjs(warranty.start_date).format('YYYY-MM-DD') : '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('repairs.warranty_end')}>
                  {warranty.end_date ? dayjs(warranty.end_date).format('YYYY-MM-DD') : '—'}
                </Descriptions.Item>
                {warranty.coverage_notes && (
                  <Descriptions.Item label={t('repairs.coverage_notes')}>
                    {warranty.coverage_notes}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </>
          )}
        </Card>
      )}
    </div>
  );
};

export default WarrantyCheck;
