/**
 * Step 2 — Iraq Region (T-LR.3.4)
 *
 * Spec: launch-readiness design.md §4.4
 *
 * SVG map of Iraq with 18 clickable governorate "regions". For accessibility,
 * a parallel <Radio.Group> list view is always rendered (visually-hidden by
 * default; reveal via toggle). Selecting a governorate writes the preset to
 * the wizard store and previews the tax-rate set in the side card.
 *
 * The SVG is a stylized rectangular grid (not a true topology) — sufficient
 * for the UX while we wait on a regulator-confirmed GeoJSON in R7.1.
 */

import { useMemo, useState } from 'react';
import { Card, Radio, Tag, Space, Typography, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { useOnboardingWizardStore } from '../state';
import { IRAQ_REGION_LIST, getIraqRegion, type IraqRegionPreset } from '../../data/iraqRegionPresets';

const { Title, Text } = Typography;

interface MapTile {
  code: string;
  /** Grid cell (col, row). 6 cols × 4 rows. */
  col: number;
  row: number;
}

/**
 * Stylized layout of Iraq's governorates.
 * Rows are roughly N→S; columns roughly W→E. KRG region is in the NE.
 */
const MAP_TILES: MapTile[] = [
  // Row 0 (north)
  { code: 'IQ-NI', col: 1, row: 0 },
  { code: 'IQ-DA', col: 3, row: 0 },
  { code: 'IQ-AR', col: 4, row: 0 },
  // Row 1
  { code: 'IQ-AN', col: 0, row: 1 },
  { code: 'IQ-SD', col: 2, row: 1 },
  { code: 'IQ-KI', col: 3, row: 1 },
  { code: 'IQ-SU', col: 4, row: 1 },
  { code: 'IQ-DI', col: 5, row: 1 },
  // Row 2 (middle)
  { code: 'IQ-KA', col: 1, row: 2 },
  { code: 'IQ-BG', col: 2, row: 2 },
  { code: 'IQ-BB', col: 3, row: 2 },
  { code: 'IQ-WA', col: 4, row: 2 },
  { code: 'IQ-NA', col: 1, row: 3 },
  { code: 'IQ-QA', col: 2, row: 3 },
  { code: 'IQ-MA', col: 5, row: 2 },
  // Row 3 (south)
  { code: 'IQ-MU', col: 1, row: 4 },
  { code: 'IQ-DQ', col: 3, row: 4 },
  { code: 'IQ-BA', col: 4, row: 4 },
];

const CELL_W = 110;
const CELL_H = 78;
const GAP = 8;
const PAD = 16;
const COLS = 6;
const ROWS = 5;

const MAP_W = COLS * CELL_W + (COLS - 1) * GAP + PAD * 2;
const MAP_H = ROWS * CELL_H + (ROWS - 1) * GAP + PAD * 2;

export default function StepIraqRegion() {
  const { t, i18n } = useTranslation('onboarding');
  const region = useOnboardingWizardStore((s) => s.data.region);
  const setRegion = useOnboardingWizardStore((s) => s.setRegion);
  const [showList, setShowList] = useState(false);

  const selectedCode = region?.code ?? null;

  const labelFor = (r: IraqRegionPreset): string =>
    i18n.language === 'ku' ? r.name_ku : i18n.language === 'ar' ? r.name_ar : r.name_en;

  const onPick = (code: string) => {
    const r = getIraqRegion(code);
    if (!r) return;
    setRegion({
      code: r.code,
      governorate_code: r.governorate_code,
      krg_region: r.krg_region,
    });
  };

  const selected = useMemo(
    () => (selectedCode ? getIraqRegion(selectedCode) : undefined),
    [selectedCode],
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 320px', gap: 24, alignItems: 'start' }}>
      {/* Map / List */}
      <div>
        <Space style={{ marginBottom: 12 }}>
          <Switch
            checked={showList}
            onChange={setShowList}
            id="onb-region-list-toggle"
            aria-labelledby="onb-region-list-label"
          />
          <label id="onb-region-list-label" htmlFor="onb-region-list-toggle">
            {t('region.toggle_list_view')}
          </label>
        </Space>

        {showList ? (
          <Radio.Group
            value={selectedCode || undefined}
            onChange={(e) => onPick(e.target.value)}
            aria-label={t('region.list_aria')}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {IRAQ_REGION_LIST.map((r) => (
                <Radio key={r.code} value={r.code} style={{ width: '100%' }}>
                  {labelFor(r)} {r.krg_region && <Tag color="green">{t('region.krg_tag')}</Tag>}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        ) : (
          <div
            role="application"
            aria-label={t('region.map_aria')}
            style={{
              width: '100%',
              overflowX: 'auto',
            }}
          >
            <svg
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              width="100%"
              role="img"
              aria-label={t('region.map_aria')}
              style={{ maxWidth: '100%', height: 'auto', background: 'var(--surface-2)', borderRadius: 8 }}
            >
              {/* Country outline as a soft backdrop */}
              <rect x={4} y={4} width={MAP_W - 8} height={MAP_H - 8} rx={12} fill="#eef2ff" stroke="#c7d2fe" />
              {MAP_TILES.map((tile) => {
                const r = getIraqRegion(tile.code);
                if (!r) return null;
                const x = PAD + tile.col * (CELL_W + GAP);
                const y = PAD + tile.row * (CELL_H + GAP);
                const active = selectedCode === tile.code;
                const fill = active
                  ? r.krg_region ? '#16a34a' : '#2563eb'
                  : r.krg_region ? '#bbf7d0' : '#dbeafe';
                const stroke = active ? '#0f172a' : '#94a3b8';
                const textColor = active ? '#fff' : '#0f172a';
                const label = labelFor(r);
                return (
                  <g
                    key={tile.code}
                    role="button"
                    tabIndex={0}
                    aria-pressed={active}
                    aria-label={`${label}${r.krg_region ? ` — ${t('region.krg_tag')}` : ''}`}
                    onClick={() => onPick(tile.code)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onPick(tile.code);
                      }
                    }}
                    style={{ cursor: 'pointer', outline: 'none' }}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={CELL_W}
                      height={CELL_H}
                      rx={10}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={active ? 3 : 1.5}
                    />
                    <text
                      x={x + CELL_W / 2}
                      y={y + CELL_H / 2 + 4}
                      textAnchor="middle"
                      fontSize={14}
                      fontWeight={active ? 700 : 500}
                      fill={textColor}
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Side card */}
      <Card
        title={selected ? labelFor(selected) : t('region.preview.empty_title')}
        size="small"
        aria-live="polite"
      >
        {!selected && <Text type="secondary">{t('region.preview.empty_hint')}</Text>}
        {selected && (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Text>
              <Text strong>{t('region.preview.capital')}: </Text>
              {selected.capital}
            </Text>
            <Text>
              <Text strong>{t('region.preview.currency')}: </Text>
              {selected.currency}
            </Text>
            <Text>
              <Text strong>{t('region.preview.timezone')}: </Text>
              {selected.timezone}
            </Text>
            {selected.krg_region && <Tag color="green">{t('region.krg_tag')}</Tag>}

            <Title level={5} style={{ marginTop: 12, marginBottom: 4 }}>
              {t('region.preview.tax_rates')}
            </Title>
            {selected.tax_rates.length === 0 && <Text type="secondary">{t('region.preview.no_taxes')}</Text>}
            {selected.tax_rates.map((tx, i) => (
              <div key={i} style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                <Text>
                  {i18n.language === 'ku' ? tx.name_ku : i18n.language === 'ar' ? tx.name_ar : tx.name_en}
                </Text>
                <div>
                  <Tag>{tx.rate_percent}%</Tag>
                  <Tag color="blue">{tx.applies_to}</Tag>
                </div>
              </div>
            ))}

            <Title level={5} style={{ marginTop: 12, marginBottom: 4 }}>
              {t('region.preview.withholding')}
            </Title>
            <Text>
              {t('region.preview.wh_services')}: {(selected.withholding_rates.services * 100).toFixed(1)}%
            </Text>
            <Text>
              {t('region.preview.wh_rent')}: {(selected.withholding_rates.rent * 100).toFixed(1)}%
            </Text>
            <Text>
              {t('region.preview.wh_materials')}: {(selected.withholding_rates.materials * 100).toFixed(1)}%
            </Text>

            {selected.placeholder && (
              <Tag color="orange" style={{ marginTop: 8 }}>
                {t('region.preview.placeholder_notice')}
              </Tag>
            )}
          </Space>
        )}
      </Card>
    </div>
  );
}
