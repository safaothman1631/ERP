/**
 * CurrencyConverter — UI for the CBI-rate-backed converter
 * (growth-to-100 § R4.15).
 *
 * Hits `/api/cbi-rates/convert` for live conversion. The rate source ("cbi"
 * vs "fallback" vs "hardcoded_fallback") is surfaced as a tag so the user
 * knows whether the displayed value is fresh or stale.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Card,
  Col,
  InputNumber,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../api';

const { Text } = Typography;

const CURRENCIES = ['IQD', 'USD'] as const;
type CurrencyCode = (typeof CURRENCIES)[number];

interface ConvertResponse {
  amount: number;
  converted: number;
  rate: number;
  from: CurrencyCode;
  to: CurrencyCode;
  rate_date: string;
  source: 'cbi' | 'fallback' | 'hardcoded_fallback' | 'identity';
  fallback_age_days: number;
}

export const CurrencyConverter: React.FC = React.memo(() => {
  const { t } = useTranslation(['common']);
  const [amount, setAmount] = useState<number>(100);
  const [from, setFrom] = useState<CurrencyCode>('USD');
  const [to, setTo] = useState<CurrencyCode>('IQD');
  const [result, setResult] = useState<ConvertResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!Number.isFinite(amount) || amount < 0) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ConvertResponse>('/api/cbi-rates/convert', {
        params: { amount, from, to },
      });
      setResult(data);
    } catch (err) {
      const msg = (err as Error).message || 'request failed';
      setError(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [amount, from, to]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <Card
      size="small"
      title={t('common:currency_converter', { defaultValue: 'Currency converter (CBI)' })}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Row gutter={8} align="middle">
          <Col xs={24} md={6}>
            <InputNumber
              style={{ width: '100%' }}
              value={amount}
              onChange={(v) => setAmount(Number(v) || 0)}
              min={0}
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              style={{ width: '100%' }}
              value={from}
              onChange={(v) => setFrom(v)}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </Col>
          <Col xs={4} md={2} style={{ textAlign: 'center' }}>→</Col>
          <Col xs={12} md={4}>
            <Select
              style={{ width: '100%' }}
              value={to}
              onChange={(v) => setTo(v)}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </Col>
          <Col xs={24} md={8}>
            <Text strong style={{ fontSize: 18 }}>
              {result ? `${result.converted.toLocaleString()} ${result.to}` : '—'}
            </Text>
          </Col>
        </Row>

        {result ? (
          <Space size="small" wrap>
            <Tag color={result.source === 'cbi' ? 'green' : 'orange'}>
              {result.source === 'cbi'
                ? t('common:rate_fresh', { defaultValue: 'Fresh CBI rate' })
                : result.source === 'fallback'
                  ? t('common:rate_fallback', { defaultValue: `Fallback (${result.fallback_age_days}d old)` })
                  : result.source === 'hardcoded_fallback'
                    ? t('common:rate_hardcoded', { defaultValue: 'Hardcoded fallback' })
                    : 'identity'}
            </Tag>
            <Text type="secondary">
              {t('common:rate_date', { defaultValue: 'Rate date' })}: {result.rate_date}
            </Text>
            <Text type="secondary">
              {t('common:rate_value', { defaultValue: 'Rate' })}: {result.rate.toFixed(4)}
            </Text>
          </Space>
        ) : null}

        {error ? <Alert type="error" message={error} showIcon /> : null}
        {loading ? <Text type="secondary">{t('common:loading', { defaultValue: 'Loading…' })}</Text> : null}
      </Space>
    </Card>
  );
});

CurrencyConverter.displayName = 'CurrencyConverter';

export default CurrencyConverter;
