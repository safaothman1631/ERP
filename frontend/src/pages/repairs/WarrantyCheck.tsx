import type React from 'react';
import { useState } from 'react';
import { Button, Input, Space, Empty } from 'antd';
import { message } from '../../utils/message';
import { SearchOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader, SectionCard, KeyValueGrid, StatusTag } from '../../design-system';
import type { KeyValueItem } from '../../design-system';
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

      <SectionCard style={{ marginBottom: space.md }}>
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
      </SectionCard>

      {searched && (
        <SectionCard>
          {!warranty ? (
            <Empty
              image={<CloseCircleOutlined style={{ fontSize: 64, color: 'var(--danger-500)' }} />}
              description={
                <Space direction="vertical">
                  <StatusTag status="error" label={t('repairs.warranty_not_found')} />
                  <div>{t('repairs.no_warranty_message')}</div>
                </Space>
              }
            />
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: space.md }}>
                {underWarranty ? (
                  <CheckCircleOutlined style={{ fontSize: 64, color: 'var(--success-500)' }} />
                ) : (
                  <CloseCircleOutlined style={{ fontSize: 64, color: 'var(--danger-500)' }} />
                )}
                <div style={{ marginTop: space.sm, fontSize: 18, fontWeight: 600 }}>
                  {underWarranty ? (
                    <StatusTag status="success" label={t('repairs.warranty_valid')} />
                  ) : (
                    <StatusTag status="error" label={t('repairs.warranty_expired')} />
                  )}
                </div>
              </div>

              <KeyValueGrid
                columns={1}
                items={[
                  { label: t('repairs.serial_no'), value: warranty.serial_no },
                  { label: t('repairs.warranty_start'), value: warranty.start_date ? dayjs(warranty.start_date).format('YYYY-MM-DD') : '—' },
                  { label: t('repairs.warranty_end'), value: warranty.end_date ? dayjs(warranty.end_date).format('YYYY-MM-DD') : '—' },
                  ...(warranty.coverage_notes ? [{ label: t('repairs.coverage_notes'), value: warranty.coverage_notes } as KeyValueItem] : []),
                ]}
              />
            </>
          )}
        </SectionCard>
      )}
    </div>
  );
};

export default WarrantyCheck;
