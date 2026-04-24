import React from 'react';
import { Form, Input, Select, Row, Col } from 'antd';
import { useTranslation } from 'react-i18next';

export const IRAQ_GOVERNORATES = [
  'Baghdad', 'Basra', 'Erbil', 'Sulaymaniyah', 'Duhok', 'Halabja', 'Kirkuk',
  'Mosul', 'Najaf', 'Karbala', 'Babil', 'Wasit', 'Maysan', 'Diyala', 'Anbar',
  'Salah ad-Din', 'Dhi Qar', 'Muthanna', 'Qadisiyyah',
];

export interface AddressValue {
  street?: string;
  city?: string;
  governorate?: string;
  postal_code?: string;
  country?: string;
}

export interface AddressInputProps {
  value?: AddressValue;
  onChange?: (v: AddressValue) => void;
}

/**
 * AddressInput — Sprint 10 — IQ governorates + free-text street/city.
 */
export const AddressInput: React.FC<AddressInputProps> = ({ value = {}, onChange }) => {
  const { t } = useTranslation();
  const set = (patch: Partial<AddressValue>) => onChange?.({ ...value, ...patch });
  return (
    <Row gutter={[8, 8]}>
      <Col span={24}>
        <Input placeholder={t('street', 'شەقام')} value={value.street} onChange={(e) => set({ street: e.target.value })} />
      </Col>
      <Col span={12}>
        <Input placeholder={t('city', 'شار')} value={value.city} onChange={(e) => set({ city: e.target.value })} />
      </Col>
      <Col span={12}>
        <Select
          showSearch
          placeholder={t('governorate', 'پارێزگا')}
          value={value.governorate}
          onChange={(v: string) => set({ governorate: v })}
          options={IRAQ_GOVERNORATES.map((g) => ({ label: g, value: g }))}
          style={{ width: '100%' }}
        />
      </Col>
      <Col span={12}>
        <Input placeholder={t('postal_code', 'کۆدی پۆستە')} value={value.postal_code} onChange={(e) => set({ postal_code: e.target.value })} />
      </Col>
      <Col span={12}>
        <Input placeholder={t('country', 'وڵات')} value={value.country ?? 'Iraq'} onChange={(e) => set({ country: e.target.value })} />
      </Col>
    </Row>
  );
};

export default AddressInput;
