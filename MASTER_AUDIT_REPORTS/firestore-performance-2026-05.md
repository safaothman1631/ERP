# Firestore Performance & Resilience — Spec Index (2026-05-26)

## Purpose

Master index for **all** database issues and recommendations discussed in product/audit sessions. Implementation tracked in Kiro:

**`.kiro/specs/firestore-performance-resilience/`**

| Doc | Role |
|-----|------|
| `requirements.md` | 40-item traceability matrix + 13 requirement groups |
| `design.md` | Technical design (list evolution, atomic, indexes, ops) |
| `tasks.md` | Waves V0–J with checkboxes |

## Already shipped (do not re-break)

See **data-integrity-wave**: org `get()` guard, atomic POS/bank/AR/AP, reconcile CLI + platform UI, root rules deploy, PITR enabled.

## Status (2026-05-26)

**Superseded for remaining work by:** `.kiro/specs/firestore-depth-remediation/`

Shipped in firestore-performance-resilience: stream, counters, cursor lists, partial reports/POS, atomics (bill approve, PO receive, transfers), CI audit tools.

**Still open → see depth remediation spec:** reports full refactor (~11 list 10k), exports, atomic wave 2 (warehouse, fiscal close, payroll JE), deploy CI alignment.
