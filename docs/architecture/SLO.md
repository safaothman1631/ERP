# Service level objectives (Wave O8)

**Service:** Zoho ERP API (`zoho-erp` Cloud Run, `europe-west1`)

| SLI | Target | Measurement |
|-----|--------|-------------|
| Availability | 99.5% monthly | `run.googleapis.com/request_count` excluding 5xx |
| API latency p95 | < 800 ms | `X-Response-Time-Ms` logs / Cloud Run latencies |
| Firestore reads per list | < 1000 | `X-FS-Reads` header / `firestore_request` logs |
| Failed atomic JE | < 0.1% | `journal_entry_atomic` error logs |
| Backup verify | Weekly pass | `.github/workflows/backup-verify.yml` |
| Idempotency replay | < 1% of POST | `idempotency_keys` completed vs created |

**Error budget:** 0.5% monthly downtime (~3.6 h).

**Review:** Quarterly in `DISASTER_RECOVERY.md` drill log.
