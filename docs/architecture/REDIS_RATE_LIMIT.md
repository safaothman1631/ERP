# Redis-backed rate limiting (H2 spike)

## Problem

`slowapi` + in-memory storage counts limits **per Cloud Run instance**. With `N` replicas, effective limit is `N × DEFAULT_RATE_LIMIT`.

## Solution (opt-in)

Set environment variables on Cloud Run:

```yaml
RATE_LIMITING_ENABLED: "true"
RATE_LIMIT_STORAGE_URI: "redis://10.0.0.3:6379/0"
```

The limiter uses `limits` storage URI when `RATE_LIMIT_STORAGE_URI` is non-empty.

## Infrastructure checklist

1. Memorystore for Redis in `europe-west1` (same region as `zoho-erp`).
2. VPC connector on Cloud Run service to reach Redis private IP.
3. Rotate URI via Secret Manager; never commit credentials.

One-shot attach to Cloud Run (after Memorystore is up):

```bash
export REDIS_URI='redis://10.0.0.3:6379/0'
bash scripts/setup_redis_rate_limit_secret.sh
```

Verify: `.\scripts\prelaunch_ops.ps1 -Phase redis` or GitHub workflow **Pre-launch ops** → `redis`.

## Fallback

Leave `RATE_LIMIT_STORAGE_URI` unset → in-memory per instance (current behaviour).

## Per-org middleware

`RateLimitMiddleware` (token bucket per org) remains in-memory until a follow-up wires Redis — document in ops runbook.
