/**
 * useCBIRate — fetches the latest CBI USD↔IQD rate (growth-to-100 § R4.15).
 *
 * Auto-polls every 6 hours (the backend cron runs at 09:00 Baghdad time,
 * so 4 polls/day catches the fresh value within hours of publication).
 *
 * Returns the raw rate document; consumers read `source` to decide whether
 * to render a "stale" tag. On request failure the previous value is kept.
 */
import { useEffect, useState, useCallback } from 'react';
import api from '../api';

const POLL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface CBIRate {
  id: string;
  rate_date: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: 'cbi' | 'fallback' | 'hardcoded_fallback';
  fetched_at: string;
  fallback_age_days?: number;
}

export interface UseCBIRateState {
  rate: CBIRate | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCBIRate(): UseCBIRateState {
  const [rate, setRate] = useState<CBIRate | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<CBIRate>('/api/cbi-rates/latest');
      setRate(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message || 'failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
    })();
    const t = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [refresh]);

  return { rate, loading, error, refresh };
}

export default useCBIRate;
