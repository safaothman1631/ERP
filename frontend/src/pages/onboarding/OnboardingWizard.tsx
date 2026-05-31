import { useState, useEffect, useContext } from 'react';
import type { FC } from 'react';
import { Card, Form, Input, Select, Button, Space, Result, Checkbox, Radio } from 'antd';
import { CheckCircleOutlined, RocketOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader, LoadingSkeleton } from '../../design-system';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { ResponsiveForm } from '../../components/responsive/ResponsiveForm';
import AddGateProvider, {
  useAddGateFlow,
  type FlowStepBinding,
} from '../../components/AddGate/AddGateProvider';
import { AddGateContext } from '../../components/AddGate/useAddGate';
import { FlowProgressIndicator } from '../../components/AddGate/FlowProgressIndicator';
import { FlowFinalSummary } from '../../components/AddGate/FlowFinalSummary';
import type { FlowStepStatus } from '../../components/AddGate/AddGateProvider';
import type { SectionId } from '../../help/sectionIds';

interface IndustryPreset {
  id: string;
  name: string;
  coa_preset: string;
}

interface Module {
  key: string;
  label: string;
  description: string;
}

const AVAILABLE_MODULES: Module[] = [
  { key: 'inventory', label: 'Inventory', description: 'Stock management and warehouses' },
  { key: 'manufacturing', label: 'Manufacturing', description: 'BOMs and production' },
  { key: 'pos', label: 'POS', description: 'Retail point of sale' },
  { key: 'crm', label: 'CRM', description: 'Leads and pipeline' },
  { key: 'hr', label: 'HR & Payroll', description: 'Employees and payroll' },
  { key: 'projects', label: 'Projects', description: 'Time tracking and delivery' },
  { key: 'field_service', label: 'Field Service', description: 'Dispatch and service orders' },
  { key: 'subscriptions', label: 'Subscriptions', description: 'Recurring billing' },
  { key: 'quality', label: 'Quality', description: 'QC checks and CAPA' },
  { key: 'maintenance', label: 'Maintenance', description: 'Equipment and schedules' },
];

const INDUSTRY_PRESETS: IndustryPreset[] = [
  { id: 'retail', name: 'Retail & E-commerce', coa_preset: 'retail' },
  { id: 'manufacturing', name: 'Manufacturing', coa_preset: 'manufacturing' },
  { id: 'services', name: 'Professional Services', coa_preset: 'services' },
  { id: 'wholesale', name: 'Wholesale & Distribution', coa_preset: 'wholesale' },
  { id: 'restaurant', name: 'Restaurant & Hospitality', coa_preset: 'restaurant' },
  { id: 'construction', name: 'Construction', coa_preset: 'construction' },
];

const CURRENCIES = [
  { code: 'IQD', name: 'Iraqi Dinar', symbol: 'د.ع' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
];

const TAX_PRESETS = [
  { id: 'iraq', name: 'Iraq (VAT 15%)', rate: 15 },
  { id: 'vat_20', name: 'VAT 20%', rate: 20 },
  { id: 'vat_10', name: 'VAT 10%', rate: 10 },
  { id: 'none', name: 'No Tax', rate: 0 },
];

/** Flow ID for the onboarding wizard multi-step flow. */
const ONBOARDING_FLOW_ID = 'onboarding-wizard';

/** Section IDs bound to each wizard step. */
const STEP_SECTION_IDS: SectionId[] = [
  'onboarding.company',
  'onboarding.currency_tax',
  'onboarding.coa',
  'onboarding.modules',
  'onboarding.sample_data',
];

/**
 * Inner wizard component that consumes the AddGateFlow context.
 * Separated so it can be wrapped by AddGateProvider.
 */
const OnboardingWizardInner: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [form] = Form.useForm();

  // Step 1: Company Info
  const [companyName, setCompanyName] = useState('');
  const [companyCountry, setCompanyCountry] = useState('IQ');

  // Step 2: Currency & Tax
  const [currencyCode, setCurrencyCode] = useState('IQD');
  const [taxPreset, setTaxPreset] = useState('iraq');

  // Step 3: COA
  const [industryId, setIndustryId] = useState('retail');

  // Step 4: Modules
  const [enabledModules, setEnabledModules] = useState<string[]>(['inventory', 'crm']);

  // Step 5: Sample Data
  const [loadSampleData, setLoadSampleData] = useState(false);

  // AddGateFlow integration
  const { flow, advance, unsatisfiedRequired } = useAddGateFlow(ONBOARDING_FLOW_ID);

  // Access the AddGate context to register record counts for each step's section.
  const addGateCtx = useContext(AddGateContext);

  useEffect(() => {
    // Company step: has a record when company name is filled
    addGateCtx.setRecordCount('onboarding.company' as SectionId, companyName ? 1 : 0);
  }, [companyName, addGateCtx]);

  useEffect(() => {
    // Currency/Tax step: always has a default selection
    addGateCtx.setRecordCount('onboarding.currency_tax' as SectionId, currencyCode ? 1 : 0);
  }, [currencyCode, addGateCtx]);

  useEffect(() => {
    // COA step: always has a default industry selection
    addGateCtx.setRecordCount('onboarding.coa' as SectionId, industryId ? 1 : 0);
  }, [industryId, addGateCtx]);

  useEffect(() => {
    // Modules step: has records when modules are selected
    addGateCtx.setRecordCount('onboarding.modules' as SectionId, enabledModules.length);
  }, [enabledModules, addGateCtx]);

  useEffect(() => {
    // Sample data step: always optional, mark as having a record
    addGateCtx.setRecordCount('onboarding.sample_data' as SectionId, 1);
  }, [addGateCtx]);

  // Check if wizard already completed
  useEffect(() => {
    api.get('/api/onboarding/preferences')
      .then((r) => {
        if (r.data.completed) {
          navigate('/onboarding/checklist');
        }
      })
      .finally(() => setChecking(false));
  }, [navigate]);

  // Derive step statuses from the flow view for the progress indicator
  const getStepStatus = (index: number): FlowStepStatus => {
    if (!flow) {
      // Fallback when flow is not registered yet
      if (index < current) return 'completed';
      return 'required-incomplete';
    }
    const step = flow.steps[index];
    return step?.status ?? 'required-incomplete';
  };

  // Check if a step is already configured (has data)
  const isStepAlreadyConfigured = (index: number): boolean => {
    if (!flow) return false;
    const step = flow.steps[index];
    // A step is "already configured" when it's optional (has records)
    // but hasn't been explicitly completed by the user advancing past it
    return step?.status === 'optional';
  };

  const steps = [
    { title: t('onboarding.step_company'), icon: <RocketOutlined /> },
    { title: t('onboarding.step_currency_tax'), icon: <RocketOutlined /> },
    { title: t('onboarding.step_coa'), icon: <RocketOutlined /> },
    { title: t('onboarding.step_modules'), icon: <RocketOutlined /> },
    { title: t('onboarding.step_sample_data'), icon: <CheckCircleOutlined /> },
  ];

  const nextStep = () => {
    // Use AddGateProvider's advance to evaluate the gate
    const result = advance();
    if (!result.ok) {
      // Step is blocked — show validation message
      message.warning(t('addGate.blockedMessage'));
      return;
    }

    if (current < steps.length - 1) {
      setCurrent(current + 1);
    } else {
      handleFinish();
    }
  };

  const prevStep = () => {
    if (current > 0) setCurrent(current - 1);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      // 1. Update org settings (company name, currency, country)
      await api.put('/api/organizations/current', {
        name: companyName,
        currency_code: currencyCode,
        country: companyCountry,
      });

      // 2. Setup COA based on industry preset
      await api.post('/api/accounts/setup-preset', {
        preset: INDUSTRY_PRESETS.find((p) => p.id === industryId)?.coa_preset || 'retail',
      });

      // 3. Setup tax based on preset
      const taxDef = TAX_PRESETS.find((t) => t.id === taxPreset);
      if (taxDef && taxDef.rate > 0) {
        await api.post('/api/tax-settings', {
          name: taxDef.name,
          rate: taxDef.rate,
          type: 'sales',
          is_default: true,
        });
      }

      // 4. Mark onboarding complete
      await api.put('/api/onboarding/preferences', {
        industry_id: industryId,
        enabled_modules: enabledModules,
        completed: true,
      });

      // 5. Load sample data if requested
      if (loadSampleData) {
        await api.post('/api/onboarding/load-sample-data');
      }

      message.success(t('onboarding.wizard_complete'));
      navigate('/onboarding/checklist');
    } catch (_err) {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleModuleChange = (e: CheckboxChangeEvent, key: string) => {
    if (e.target.checked) {
      setEnabledModules([...enabledModules, key]);
    } else {
      setEnabledModules(enabledModules.filter((m) => m !== key));
    }
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title={t('onboarding.wizard_title')}
        subtitle={t('onboarding.wizard_subtitle')}
      />

      <Card style={{ maxWidth: 900, margin: '24px auto' }}>
        <FlowProgressIndicator
          currentStep={current}
          steps={steps.map((step, index) => ({
            title: step.title,
            icon: step.icon,
            status: getStepStatus(index),
            alreadyConfigured: isStepAlreadyConfigured(index),
          }))}
        />

        <div style={{ minHeight: 320 }}>
          {current === 0 && (
            <Form form={form} layout="vertical">
              <ResponsiveForm layout="single">
              <Form.Item
                label={t('onboarding.company_name')}
                rules={[{ required: true, message: t('required') }]}
              >
                <Input
                  size="large"
                  placeholder={t('onboarding.company_name_placeholder')}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </Form.Item>
              <Form.Item label={t('onboarding.country')}>
                <Select
                  size="large"
                  value={companyCountry}
                  onChange={setCompanyCountry}
                  options={[
                    { value: 'IQ', label: t('onboarding.country_iraq') },
                    { value: 'US', label: 'United States' },
                    { value: 'GB', label: 'United Kingdom' },
                    { value: 'AE', label: 'United Arab Emirates' },
                  ]}
                />
              </Form.Item>
              </ResponsiveForm>
</Form>
          )}

          {current === 1 && (
            <Form layout="vertical">
              <ResponsiveForm layout="single">
              <Form.Item label={t('onboarding.base_currency')}>
                <Radio.Group
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {CURRENCIES.map((c) => (
                      <Radio key={c.code} value={c.code} style={{ width: '100%', padding: 12, border: '1px solid #d9d9d9', borderRadius: 6 }}>
                        <strong>{c.code}</strong> — {c.name} ({c.symbol})
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              </Form.Item>
              <Form.Item label={t('onboarding.tax_preset')} style={{ marginTop: 24 }}>
                <Select
                  size="large"
                  value={taxPreset}
                  onChange={setTaxPreset}
                  options={TAX_PRESETS.map((t) => ({ value: t.id, label: t.name }))}
                />
              </Form.Item>
              </ResponsiveForm>
</Form>
          )}

          {current === 2 && (
            <Form layout="vertical">
              <ResponsiveForm layout="single">
              <Form.Item label={t('onboarding.industry_preset')}>
                <Radio.Group
                  value={industryId}
                  onChange={(e) => setIndustryId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {INDUSTRY_PRESETS.map((p) => (
                      <Radio key={p.id} value={p.id} style={{ width: '100%', padding: 12, border: '1px solid #d9d9d9', borderRadius: 6 }}>
                        <strong>{p.name}</strong>
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              </Form.Item>
              </ResponsiveForm>
</Form>
          )}

          {current === 3 && (
            <div>
              <p style={{ marginBottom: 16 }}>{t('onboarding.modules_help')}</p>
              <Space direction="vertical" style={{ width: '100%' }}>
                {AVAILABLE_MODULES.map((m) => (
                  <Checkbox
                    key={m.key}
                    checked={enabledModules.includes(m.key)}
                    onChange={(e) => handleModuleChange(e, m.key)}
                    style={{ width: '100%', padding: 12, border: '1px solid #d9d9d9', borderRadius: 6 }}
                  >
                    <div>
                      <strong>{m.label}</strong>
                      <div style={{ fontSize: 12, color: '#666' }}>{m.description}</div>
                    </div>
                  </Checkbox>
                ))}
              </Space>
            </div>
          )}

          {current === 4 && (
            <Result
              status="success"
              title={t('onboarding.ready_title')}
              subTitle={t('onboarding.ready_subtitle')}
              extra={
                <div>
                  <FlowFinalSummary
                    unsatisfiedSections={unsatisfiedRequired}
                    sectionLabels={{
                      'onboarding.company': t('onboarding.step_company'),
                      'onboarding.currency_tax': t('onboarding.step_currency_tax'),
                      'onboarding.coa': t('onboarding.step_coa'),
                      'onboarding.modules': t('onboarding.step_modules'),
                      'onboarding.sample_data': t('onboarding.step_sample_data'),
                    }}
                    onNavigateToSection={(sectionId) => {
                      const idx = STEP_SECTION_IDS.indexOf(sectionId as SectionId);
                      if (idx >= 0) setCurrent(idx);
                    }}
                  />
                  <Checkbox checked={loadSampleData} onChange={(e) => setLoadSampleData(e.target.checked)}>
                    {t('onboarding.load_sample_data')}
                  </Checkbox>
                </div>
              }
            />
          )}
        </div>

        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
          <Button size="large" onClick={prevStep} disabled={current === 0}>
            {t('back')}
          </Button>
          <Space>
            <Button size="large" onClick={() => navigate('/dashboard')}>
              {t('skip')}
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={nextStep}
              loading={loading}
              disabled={current === 0 && !companyName}
            >
              {current === steps.length - 1 ? t('finish') : t('next')}
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
};

/**
 * Build flow bindings for the onboarding wizard.
 *
 * Steps 0-3 (Company, Currency/Tax, COA, Modules) are required.
 * Step 4 (Sample Data) is optional — the user can finish without it.
 *
 * If a step already has data (e.g., default tax rates seeded by the
 * system), it will be marked "Optional — already configured" at runtime
 * by the AddGateProvider's status derivation (R10.2).
 */
function buildOnboardingFlowBindings(): FlowStepBinding[] {
  return STEP_SECTION_IDS.map((sectionId, index) => ({
    flowId: ONBOARDING_FLOW_ID,
    stepId: `step-${index}`,
    sectionId,
    // Steps 0-3 are required; step 4 (sample data) is optional
    status: index < 4 ? 'required-incomplete' as FlowStepStatus : 'optional' as FlowStepStatus,
    route: `/onboarding#step-${index}`,
  }));
}

/**
 * OnboardingWizard wrapped in AddGateProvider to integrate with the
 * Selective Add system (R10.1, R10.2, R10.3, R10.4).
 *
 * Each wizard step is bound to a sectionId via flowBindings. The
 * AddGateProvider evaluates the gate at the moment the user attempts
 * to advance, blocking only if a required Section is empty.
 */
const OnboardingWizard: FC = () => {
  const flowBindings = buildOnboardingFlowBindings();

  return (
    <AddGateProvider flowBindings={flowBindings}>
      <OnboardingWizardInner />
    </AddGateProvider>
  );
};

export default OnboardingWizard;
