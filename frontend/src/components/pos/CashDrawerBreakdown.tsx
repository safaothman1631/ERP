/**
 * CashDrawerBreakdown — shows the cashier how to make change in IQD notes
 * (growth-to-100 § R4.10).
 *
 * Renders one row per current IQD denomination + a "Withdrawn" group at the
 * bottom for the legacy 50/100/200 IQD notes. Each row shows how many notes
 * the greedy break-down algorithm suggests for the requested amount. The
 * cashier can also count manually and the row totals reflect the input.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, InputNumber, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';

import {
  breakDown,
  DENOMINATION_META,
  WITHDRAWN_DENOMINATIONS,
  type DenominationInfo,
  format as formatIqd,
  sumFromBreakdown,
} from '../../utils/iqd-denominations';
import { useLanguage } from '../../hooks/useLanguage';
import { useDigitPreference } from '../../contexts/DigitPreferenceContext';

const { Text } = Typography;

interface CashDrawerBreakdownProps {
  /** The amount to make change for. */
  amount: number;
  /** If true, render the suggested counts as the initial values. */
  showSuggested?: boolean;
}

interface Row {
  key: number;
  denomination: number;
  label: string;
  count: number;
  rowTotal: number;
  withdrawn: boolean;
}

function labelFor(d: DenominationInfo, locale: 'ku' | 'ar' | 'en'): string {
  if (locale === 'ar') return d.label_ar;
  if (locale === 'en') return d.label_en;
  return d.label_ku;
}

export const CashDrawerBreakdown: React.FC<CashDrawerBreakdownProps> = React.memo(({
  amount,
  showSuggested = true,
}) => {
  const { t } = useTranslation(['pos', 'common']);
  const { language } = useLanguage();
  const { useArabicIndic } = useDigitPreference();
  const locale: 'ku' | 'ar' | 'en' = language === 'en' ? 'en' : language === 'ar' ? 'ar' : 'ku';

  const suggested = useMemo(() => breakDown(amount), [amount]);
  const [counts, setCounts] = useState<Map<number, number>>(() => suggested);

  // Re-seed when the amount changes (and the user wanted suggestions).
  useEffect(() => {
    if (showSuggested) setCounts(suggested);
  }, [suggested, showSuggested]);

  const rows: Row[] = useMemo(() => {
    const result: Row[] = [];
    for (const d of DENOMINATION_META) {
      const c = counts.get(d.value) ?? 0;
      result.push({
        key: d.value,
        denomination: d.value,
        label: labelFor(d, locale),
        count: c,
        rowTotal: d.value * c,
        withdrawn: false,
      });
    }
    for (const d of WITHDRAWN_DENOMINATIONS) {
      const c = counts.get(d.value) ?? 0;
      if (c > 0) {
        result.push({
          key: d.value,
          denomination: d.value,
          label: labelFor(d, locale),
          count: c,
          rowTotal: d.value * c,
          withdrawn: true,
        });
      }
    }
    return result;
  }, [counts, locale]);

  const total = useMemo(() => sumFromBreakdown(counts), [counts]);

  const columns: ColumnsType<Row> = [
    {
      title: t('pos:cash.denomination', { defaultValue: 'Denomination' }),
      dataIndex: 'label',
      key: 'label',
      render: (label, row) => (
        <Space>
          <Text>{label}</Text>
          {row.withdrawn ? (
            <Tag color="default">
              {t('pos:cash.withdrawn', { defaultValue: 'Withdrawn' })}
            </Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('pos:cash.count', { defaultValue: 'Count' }),
      dataIndex: 'count',
      key: 'count',
      width: 140,
      render: (count: number, row) => (
        <InputNumber
          min={0}
          value={count}
          onChange={(v) => {
            const next = new Map(counts);
            next.set(row.denomination, Math.max(0, Number(v) || 0));
            setCounts(next);
          }}
        />
      ),
    },
    {
      title: t('pos:cash.row_total', { defaultValue: 'Total' }),
      dataIndex: 'rowTotal',
      key: 'rowTotal',
      align: 'right',
      render: (val: number) => <Text>{formatIqd(val, locale, useArabicIndic)}</Text>,
    },
  ];

  return (
    <Card
      size="small"
      title={t('pos:cash.title', { defaultValue: 'Cash drawer break-down (IQD)' })}
      extra={
        <Text strong>
          {t('pos:cash.target', { defaultValue: 'Target' })}:{' '}
          {formatIqd(amount, locale, useArabicIndic)}
        </Text>
      }
    >
      {amount <= 0 ? (
        <Empty description={t('pos:cash.empty', { defaultValue: 'Enter an amount above' })} />
      ) : (
        <>
          <Table<Row>
            rowKey="key"
            dataSource={rows}
            columns={columns}
            pagination={false}
            size="small"
          />
          <Space style={{ marginTop: 8, width: '100%', justifyContent: 'flex-end' }}>
            <Text strong>
              {t('pos:cash.counted', { defaultValue: 'Counted' })}:{' '}
              {formatIqd(total, locale, useArabicIndic)}
            </Text>
            <Text type={total === amount ? 'success' : 'warning'}>
              {t('pos:cash.delta', { defaultValue: 'Δ' })}:{' '}
              {formatIqd(total - amount, locale, useArabicIndic)}
            </Text>
          </Space>
        </>
      )}
    </Card>
  );
});

CashDrawerBreakdown.displayName = 'CashDrawerBreakdown';

export default CashDrawerBreakdown;
