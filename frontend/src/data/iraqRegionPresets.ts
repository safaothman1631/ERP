/**
 * Iraq Governorate Presets (T-LR.3.5)
 *
 * Spec: launch-readiness design.md §4.4
 *
 * 18 governorates. For each: bilingual labels, KRG flag, default
 * withholding rate set, currency, timezone, and a `placeholder: true`
 * flag marking entries that need R7.1 verification by a Kurdish/Iraqi
 * tax accountant before launch.
 *
 * Iraq has no broad VAT today; sector-specific sales taxes apply
 * (hospitality, telecom). Withholding rates below are common defaults
 * (services 3%, rent 5%, materials 2%) but MUST be confirmed.
 */

export interface TaxRateRow {
  name_en: string;
  name_ku: string;
  name_ar: string;
  rate_percent: number;
  applies_to: 'sales' | 'purchases' | 'withholding';
  sector?: string;
}

export interface IraqRegionPreset {
  code: string;
  governorate_code: string;
  name_en: string;
  name_ku: string;
  name_ar: string;
  capital: string;
  krg_region: boolean;
  vat_rate: number;            // typically 0
  withholding_rates: {
    services: number;
    rent: number;
    materials: number;
  };
  tax_rates: TaxRateRow[];
  currency: 'IQD';
  timezone: 'Asia/Baghdad';
  placeholder: boolean;
}

const DEFAULT_WITHHOLDING = { services: 0.03, rent: 0.05, materials: 0.02 } as const;

const HOSPITALITY: TaxRateRow = {
  name_en: 'Sales Tax — Hospitality',
  name_ku: 'باجی فرۆشتن — کەرتی میوانداری',
  name_ar: 'ضريبة المبيعات — الضيافة',
  rate_percent: 10,
  applies_to: 'sales',
  sector: 'hospitality',
};

const TELECOM: TaxRateRow = {
  name_en: 'Sales Tax — Telecom',
  name_ku: 'باجی فرۆشتن — پەیوەندی',
  name_ar: 'ضريبة المبيعات — الاتصالات',
  rate_percent: 20,
  applies_to: 'sales',
  sector: 'telecom',
};

const KRG_HOSPITALITY: TaxRateRow = {
  name_en: 'KRG Hospitality Tax',
  name_ku: 'باجی میوانداری هەرێم',
  name_ar: 'ضريبة الضيافة لإقليم كردستان',
  rate_percent: 10,
  applies_to: 'sales',
  sector: 'hospitality',
};

function preset(
  code: string,
  name_en: string,
  name_ku: string,
  name_ar: string,
  capital: string,
  krg: boolean,
): IraqRegionPreset {
  return {
    code,
    governorate_code: code,
    name_en,
    name_ku,
    name_ar,
    capital,
    krg_region: krg,
    vat_rate: 0,
    withholding_rates: { ...DEFAULT_WITHHOLDING },
    tax_rates: krg ? [KRG_HOSPITALITY] : [HOSPITALITY, TELECOM],
    currency: 'IQD',
    timezone: 'Asia/Baghdad',
    placeholder: true, // R7.1 verification pending for all
  };
}

/**
 * 18 governorates of Iraq.
 * KRG governorates: Erbil, Sulaymaniyah, Duhok, Halabja (Halabja split from
 * Sulaymaniyah in 2014; we model the 18 official + treat Halabja under
 * Sulaymaniyah's preset — Iraq Federal officially recognizes 18 with Halabja
 * sometimes counted as the 19th).
 *
 * Official 18 used here: Baghdad, Anbar, Babil, Basra, Diyala, Dhi Qar,
 * Erbil, Karbala, Kirkuk, Maysan, Muthanna, Najaf, Nineveh, Qadisiyyah,
 * Salah ad-Din, Sulaymaniyah, Wasit, Duhok.
 */
export const IRAQ_REGION_PRESETS: Record<string, IraqRegionPreset> = {
  'IQ-BG': preset('IQ-BG', 'Baghdad', 'بەغداد', 'بغداد', 'Baghdad', false),
  'IQ-AN': preset('IQ-AN', 'Anbar', 'ئەنبار', 'الأنبار', 'Ramadi', false),
  'IQ-BB': preset('IQ-BB', 'Babil', 'بابیل', 'بابل', 'Hillah', false),
  'IQ-BA': preset('IQ-BA', 'Basra', 'بەسرە', 'البصرة', 'Basra', false),
  'IQ-DI': preset('IQ-DI', 'Diyala', 'دیالە', 'ديالى', 'Baqubah', false),
  'IQ-DQ': preset('IQ-DQ', 'Dhi Qar', 'زیقار', 'ذي قار', 'Nasiriyah', false),
  'IQ-AR': preset('IQ-AR', 'Erbil', 'هەولێر', 'أربيل', 'Erbil', true),
  'IQ-KA': preset('IQ-KA', 'Karbala', 'کەربەلا', 'كربلاء', 'Karbala', false),
  'IQ-KI': preset('IQ-KI', 'Kirkuk', 'کەرکووک', 'كركوك', 'Kirkuk', false),
  'IQ-MA': preset('IQ-MA', 'Maysan', 'میسان', 'ميسان', 'Amarah', false),
  'IQ-MU': preset('IQ-MU', 'Muthanna', 'موسەنا', 'المثنى', 'Samawah', false),
  'IQ-NA': preset('IQ-NA', 'Najaf', 'نەجەف', 'النجف', 'Najaf', false),
  'IQ-NI': preset('IQ-NI', 'Nineveh', 'نەینەوا', 'نينوى', 'Mosul', false),
  'IQ-QA': preset('IQ-QA', 'Qadisiyyah', 'قادیسیە', 'القادسية', 'Diwaniyah', false),
  'IQ-SD': preset('IQ-SD', 'Salah ad-Din', 'سەلاحەدین', 'صلاح الدين', 'Tikrit', false),
  'IQ-SU': preset('IQ-SU', 'Sulaymaniyah', 'سلێمانی', 'السليمانية', 'Sulaymaniyah', true),
  'IQ-WA': preset('IQ-WA', 'Wasit', 'واست', 'واسط', 'Kut', false),
  'IQ-DA': preset('IQ-DA', 'Duhok', 'دهۆک', 'دهوك', 'Duhok', true),
};

export const IRAQ_REGION_LIST: IraqRegionPreset[] = Object.values(IRAQ_REGION_PRESETS);

export function getIraqRegion(code: string): IraqRegionPreset | undefined {
  return IRAQ_REGION_PRESETS[code];
}
