/**
 * Step 1 — Company Info (T-LR.3.3)
 *
 * Spec: launch-readiness design.md §4.3
 *
 * Collects core tenant profile: company_name, legal_name, address (governorate
 * picker, city, district, line), phone (E.164 normalized), email, tax_id
 * (Iraqi commercial reg), vat_status, business_type, intended_use multi-select.
 *
 * Submits live to the wizard store; the parent shell calls `next()` which
 * triggers `state.save()` -> `PUT /api/onboarding/state`.
 *
 * The downstream `PUT /api/tenants/{tenant_id}/profile` is owned by the
 * backend agent (T-LR.3.11 and tenant hardening).
 */

import { useEffect, useState } from 'react';
import { Form, Input, Select, Radio, Checkbox, Row, Col, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { useOnboardingWizardStore, normalizeIraqPhone, type BusinessType, type CompanyInfo } from '../state';
import { IRAQ_REGION_LIST } from '../../data/iraqRegionPresets';

const BUSINESS_TYPES: BusinessType[] = [
  'retail',
  'restaurant',
  'pharmacy',
  'services',
  'manufacturing',
  'wholesale',
  'ngo',
];

const INTENDED_USE: BusinessType[] = [
  'retail',
  'restaurant',
  'pharmacy',
  'services',
  'manufacturing',
  'wholesale',
  'ngo',
];

export default function StepCompanyInfo() {
  const { t, i18n } = useTranslation('onboarding');
  const [form] = Form.useForm<CompanyInfo>();
  const stored = useOnboardingWizardStore((s) => s.data.company);
  const setCompany = useOnboardingWizardStore((s) => s.setCompany);

  const [phoneNormalized, setPhoneNormalized] = useState<string>('');

  // Hydrate form on mount
  useEffect(() => {
    if (stored) {
      form.setFieldsValue(stored);
      if (stored.phone) setPhoneNormalized(stored.phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onValuesChange = (_changed: Partial<CompanyInfo>, all: CompanyInfo) => {
    const normalized: CompanyInfo = {
      ...all,
      company_name: (all.company_name || '').trim(),
      phone: all.phone ? normalizeIraqPhone(all.phone) : undefined,
    };
    setPhoneNormalized(normalized.phone || '');
    setCompany(normalized);
  };

  const regionLabel = (r: { name_en: string; name_ku: string; name_ar: string }) =>
    i18n.language === 'ku' ? r.name_ku : i18n.language === 'ar' ? r.name_ar : r.name_en;

  return (
    <Form<CompanyInfo>
      form={form}
      layout="vertical"
      onValuesChange={onValuesChange}
      requiredMark
      initialValues={{
        vat_status: 'not_registered',
        business_type: 'retail',
      }}
      aria-label={t('step.1.title')}
    >
      <Row gutter={[16, 0]}>
        <Col xs={24} md={12}>
          <Form.Item
            name="company_name"
            label={<label htmlFor="onb-company-name">{t('company.name.label')}</label>}
            rules={[
              { required: true, message: t('company.name.required') },
              { min: 2, message: t('company.name.too_short') },
              { max: 120, message: t('company.name.too_long') },
            ]}
          >
            <Input id="onb-company-name" placeholder={t('company.name.placeholder')} autoComplete="organization" />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            name="legal_name"
            label={<label htmlFor="onb-legal-name">{t('company.legal_name.label')}</label>}
            tooltip={t('company.legal_name.help')}
          >
            <Input id="onb-legal-name" placeholder={t('company.legal_name.placeholder')} />
          </Form.Item>
        </Col>

        <Col xs={24} md={8}>
          <Form.Item
            name="governorate_code"
            label={<label htmlFor="onb-governorate">{t('company.governorate.label')}</label>}
          >
            <Select
              id="onb-governorate"
              showSearch
              placeholder={t('company.governorate.placeholder')}
              optionFilterProp="label"
              options={IRAQ_REGION_LIST.map((r) => ({
                value: r.code,
                label: regionLabel(r),
              }))}
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={8}>
          <Form.Item
            name="city"
            label={<label htmlFor="onb-city">{t('company.city.label')}</label>}
          >
            <Input id="onb-city" autoComplete="address-level2" />
          </Form.Item>
        </Col>

        <Col xs={24} md={8}>
          <Form.Item
            name="district"
            label={<label htmlFor="onb-district">{t('company.district.label')}</label>}
          >
            <Input id="onb-district" autoComplete="address-level3" />
          </Form.Item>
        </Col>

        <Col xs={24}>
          <Form.Item
            name="address_line"
            label={<label htmlFor="onb-address">{t('company.address.label')}</label>}
          >
            <Input id="onb-address" autoComplete="street-address" />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            name="phone"
            label={<label htmlFor="onb-phone">{t('company.phone.label')}</label>}
            extra={phoneNormalized ? t('company.phone.normalized', { value: phoneNormalized }) : t('company.phone.help')}
            rules={[
              {
                validator: (_, v) => {
                  if (!v) return Promise.resolve();
                  const e164 = normalizeIraqPhone(v);
                  return /^\+964\d{8,11}$/.test(e164)
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('company.phone.invalid')));
                },
              },
            ]}
          >
            <Input id="onb-phone" placeholder="07XX XXX XXXX" autoComplete="tel" inputMode="tel" />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            name="email"
            label={<label htmlFor="onb-email">{t('company.email.label')}</label>}
            rules={[{ type: 'email', message: t('company.email.invalid') }]}
          >
            <Input id="onb-email" type="email" autoComplete="email" />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            name="tax_id"
            label={<label htmlFor="onb-tax-id">{t('company.tax_id.label')}</label>}
            tooltip={t('company.tax_id.help')}
          >
            <Input id="onb-tax-id" placeholder={t('company.tax_id.placeholder')} />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            name="vat_status"
            label={t('company.vat_status.label')}
            rules={[{ required: true, message: t('company.vat_status.required') }]}
          >
            <Radio.Group>
              <Radio value="registered">{t('company.vat_status.registered')}</Radio>
              <Radio value="not_registered">{t('company.vat_status.not_registered')}</Radio>
              <Radio value="pending">{t('company.vat_status.pending')}</Radio>
            </Radio.Group>
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            name="business_type"
            label={<label htmlFor="onb-business-type">{t('company.business_type.label')}</label>}
            rules={[{ required: true, message: t('company.business_type.required') }]}
          >
            <Select
              id="onb-business-type"
              options={BUSINESS_TYPES.map((bt) => ({ value: bt, label: t(`company.business_type.options.${bt}`) }))}
            />
          </Form.Item>
        </Col>

        <Col xs={24}>
          <Form.Item
            name="intended_use"
            label={t('company.intended_use.label')}
            tooltip={t('company.intended_use.help')}
          >
            <Checkbox.Group>
              <Row gutter={[8, 8]}>
                {INTENDED_USE.map((bt) => (
                  <Col xs={12} sm={8} md={6} key={bt}>
                    <Checkbox value={bt}>{t(`company.intended_use.options.${bt}`)}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        message={t('company.privacy_notice')}
        style={{ marginTop: 8 }}
      />
    </Form>
  );
}
