# Runbook — POS 24-hour Offline Drill

> **Spec ref:** requirements.md §4.5 acceptance, tasks.md T-3.11
> **Owner:** FE + QA
> **Frequency:** Quarterly (and any time the POS offline stack ships a meaningful change)

The objective: prove that an Iraqi shop running our POS on a single
tablet behind an unreliable connection can take orders for a full
trading day without **any** data loss or duplicates after the
connection returns.

## 1. What "passes" looks like

After the drill we must show:

* **Queue depth = 0** in `posOffline` IndexedDB.
* **All transactions** present in the server-side database, with the same line items + totals + timestamps as the device receipts.
* **Zero duplicates** (an idempotency key collision would surface as two `order_id`s for the same `client_op_id`).
* **Stock movements reconcile**: opening stock − sold qty = closing stock for the SKUs touched.
* **Kitchen Display** does **not** re-print already-fulfilled orders when the device reconnects (the KDS uses `synced_at` to filter).

If any of these fail, the drill is recorded as RED and a regression issue is filed.

## 2. Setup

### 2.1 Test tenant

* In the admin console, provision a tenant named `pos-drill-YYYY-Qn` (e.g. `pos-drill-2026-Q3`).
* Region: `me-central1` (matches prod).
* Subscription tier: same as production default.

### 2.2 Seed data

```bash
cd backend
python -m app.scripts.seed_pos \
  --tenant pos-drill-2026-Q3 \
  --products 1000 \
  --opening-stock 50 \
  --tax-config IQ_VAT_DEFAULT \
  --waiter-pin 1234
```

You should see:

```
[seed] tenant=pos-drill-2026-Q3 products=1000 inserted=1000 stock_seeded=1000 done in 18.2s
```

### 2.3 Device

* A Pixel 6 (Android 14) **or** an iPad Air 5 (iPadOS 17), whichever has not run the drill last quarter.
* App: latest staging build of the Capacitor wrapper (see `mobile/README.md`).
* Sign in as the `pos-drill` cashier with PIN `1234`.
* Confirm the screen shows `Connected · pos-drill-2026-Q3 · 1000 SKUs`.

### 2.4 Pre-flight check (5 minutes)

* Run 3 normal sales **online**. Verify they appear in the admin Sales list within 5 seconds.
* Open the offline status drawer; confirm `queue: 0`.
* Restart the app once. Confirm session persists (no re-login).

## 3. Execute the drill

| Time (local) | Action |
|---|---|
| **T = 0** (e.g. 09:00) | Put the device into airplane mode (or pull Wi-Fi + disable cellular). |
| T + 5m | Run a "queue probe" sale (1 item, cash). Receipt MUST print. |
| T + 30m..T + 23h | Run **50 transactions** spread across the day with the script below. |
| T + 12h | At a random midpoint, **force-quit** the app and re-open it. The queue must persist. |
| T + 23h | At hour 23, simulate a printer disconnect and reconnect once. |
| **T + 24h** (09:00 next day) | Restore connectivity. Watch the upload progress in the offline drawer. |

### 3.1 Transaction script (copy-paste-able)

Aim for a mix of patterns that have historically broken something:

* 30× cash sales, 1–3 lines, no discount.
* 10× cash sales with a percent discount on the cart.
* 5× cash sales with a line-level discount.
* 3× refunds against a prior offline sale (reference the receipt id from the device).
* 2× split tenders (cash + card).

Each sale records: receipt number, timestamp, total, tendered, change.

### 3.2 Mid-drill checkpoints

Every 4 hours, log into the admin console **(do not log out of the device)** from another laptop and:

* Verify the queue depth in the offline drawer matches the count you've recorded.
* Verify the device's clock has not drifted (NTP off-by-5-minutes will break the merge order).
* Confirm IndexedDB usage is < 50 MB in DevTools (chrome://inspect).

## 4. Reconciliation (Day 2, 09:00 + 1h)

Once the queue drains:

```bash
python -m app.scripts.pos_drill_reconcile \
  --tenant pos-drill-2026-Q3 \
  --start "2026-07-15T09:00:00+03:00" \
  --end   "2026-07-16T09:00:00+03:00"
```

Expected output:

```
device_receipts: 50
server_orders:   50
duplicates:       0
mismatches:       0
stock_delta_match: True
PASS
```

If you see `duplicates > 0` or `mismatches > 0`, dump the offending rows
into the report (see §6) and STOP. Do not delete the test tenant — we
need it to investigate.

## 5. Verify expected outcomes

| Check | How | Pass criterion |
|---|---|---|
| Queue depth | Offline drawer in app | `0` |
| All orders synced | Reconcile script | `device_receipts == server_orders` |
| No duplicates | Reconcile script | `duplicates == 0` |
| Stock reconciles | Reconcile script | `stock_delta_match == True` |
| Receipt totals match | Spot-check 5 random | line totals + tax + tender all identical |
| KDS not double-firing | Watch KDS screen during sync | each ticket appears once and only once |
| Audit log complete | `tenants/<t>/audit_log` count | ≥ 50 + setup entries |

## 6. Triage failure modes

| Symptom | Likely cause | Where to look |
|---|---|---|
| Duplicate `order_id` | Idempotency key collision (`client_op_id` not unique). | `frontend/src/stores/posOffline.ts` — verify uuid v4 generation, no Math.random. |
| Missing orders | Background Sync registration dropped (Safari iOS often). | DevTools → Application → Service Workers; check Workbox `bg-sync` queue. |
| Stock mismatch | Server-side ledger ran a partial reversal then crashed. | `backend/app/services/inventory_ledger.py` audit log. |
| KDS double-firing | KDS subscription read pre-sync state once and post-sync state again. | `frontend/src/pages/pos/POSKitchen.tsx` Firestore listener. |
| Receipt totals off | Tax rounding rounded differently device vs server. | Compare `iq_tax.py` round_iqd helper vs device equivalent. |

## 7. File the result

Create `audit/pos-drills/YYYY-Qn-drill.md`:

```markdown
# POS offline drill — 2026 Q3

* Tenant: pos-drill-2026-Q3
* Operator: <name>
* Device: Pixel 6 (Android 14), build 2026.07.123-staging
* Duration: 24h (09:00 2026-07-15 → 09:00 2026-07-16, +03:00)
* Result: PASS / RED
* Reconcile output:
  device_receipts: 50
  server_orders:   50
  ...
* Notes / regressions found: ...
* Issues filed: #1234, #1235
```

The audit file is committed to the repo on the drill day.

## 8. Cleanup

* `gcloud firestore export ... pos-drill-2026-Q3 ...` → archive to GCS for 12 months.
* Delete the tenant: admin console → `Delete tenant` → confirm.
* Wipe the device: factory-reset if not the daily driver, or just sign out of the app.

## 9. Acceptance link

Once PASS, link the audit file from the [`tasks.md` T-3.11 row](../../.kiro/specs/world-class-performance/tasks.md) and mark T-3.11 as **Done**.
