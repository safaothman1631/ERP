# Runbook — Payment Reconciliation / ڕێکخستنی پارەدان

> **Spec ref:** `.kiro/specs/launch-readiness` T-LR.6.4, T-LR.4.12
> **Owner:** Backend on-call + Finance ops
> **Audience:** Backend on-call engineers, finance team
> **Status:** Cash + COD + Stripe documented. Iraqi providers (FastPay, Qi, Zain) marked PENDING until sandbox creds land (R7.2–R7.4).

The objective: every payment the tenant records in our system must
trace back to (or be marked discrepant with) a real settlement from the
provider, within 24 hours.

---

## 1. Daily reconciliation procedure

Run between 06:00 and 08:00 Baghdad time, after the previous night's
batch settlements have closed.

### 1.1 Automated job (preferred path)

```bash
# Runs as a Cloud Scheduler cron at 04:30 UTC daily
python -m backend.app.payments.recon.nightly --date YYYY-MM-DD
```

Output lands in `tenants/{id}/payments/_recon/{date}` with fields:

| Field | Meaning |
|-------|---------|
| `total_payments` | Count of `Payment` aggregates in window |
| `matched` | Provider settlement matched, GL posted |
| `unmatched_provider` | Provider says paid; we have no Payment |
| `unmatched_ledger` | We have a Payment marked `paid`; provider settlement missing |
| `amount_delta_iqd` | Sum of absolute differences (IQD) |
| `amount_delta_usd` | Sum (USD) |
| `status` | `clean` / `flagged` / `failed` |

### 1.2 Where to view results

- **Per-tenant queue:** Settings → Payments → Reconciliation (Frontend route `/settings/payments/reconciliation`)
- **Super-admin overview:** Admin Console → Payments → Recon → All tenants (`/admin/payments/recon`)
- **Cloud Logging filter:**
  ```
  resource.type="cloud_run_revision"
  jsonPayload.job="payments_recon_nightly"
  ```

### 1.3 Daily checklist

1. Open super-admin recon view. Sort by `amount_delta_iqd` descending.
2. For each tenant with `status != clean`:
   - If `unmatched_provider > 0` → §2.1
   - If `unmatched_ledger > 0` → §2.2
   - If `amount_delta_iqd > 0` but no unmatched → §2.3
3. After triage, mark cleared items as resolved in the queue UI (writes to `tenants/{id}/payments/_recon/{date}/resolved/{payment_id}`).
4. Anything not resolved within 48 hours → escalate per §6.

---

## 2. Symptom triage

### 2.1 Provider says paid, we have no Payment record

**Most common cause:** Webhook never arrived (network, signature failure,
or provider issue).

Steps:
1. Open provider dashboard. Confirm the settlement is real and not a hold/auth.
2. Look up our webhook log:
   ```
   resource.type="cloud_run_revision"
   jsonPayload.endpoint="/api/payments/webhooks/<provider>"
   timestamp >= "<date_minus_2d>"
   ```
3. If no log entry → webhook was never sent OR was rejected at TLS. Replay it from provider dashboard if possible.
4. If log entry shows `401 signature_invalid` → check the provider's webhook secret in Secret Manager (`PROVIDER_WEBHOOK_SECRET_<provider>`). Rotate if necessary, then replay.
5. If replay isn't available, manually create the Payment via:
   ```bash
   python -m backend.app.payments.admin_create_payment \
     --tenant TENANT_ID \
     --provider stripe \
     --provider-payment-id pi_xxx \
     --amount-minor 50000 \
     --currency IQD \
     --paid-at "2026-05-28T14:23:00+03:00" \
     --reason "webhook missed, manual recon"
   ```
   The tool posts the GL entry and writes an `admin_manual_create` event to the audit log.

### 2.2 We have a Payment marked paid, provider settlement missing

**Most common cause:** Webhook was a test/sandbox event leaked into prod
(rare with signature verify), or operator marked a manual payment but
the customer never actually paid.

Steps:
1. Pull the Payment doc:
   ```
   tenants/{id}/payments/{payment_id}
   ```
   Look at `created_via`. If `manual_entry` → ask the operator who recorded it.
2. If `webhook` but no matching provider record → check `provider_payment_id`. Search provider dashboard for it. If the ID format looks wrong (e.g. starts with `pi_test_` in prod), this is a sandbox leak — revert the GL entry:
   ```bash
   python -m backend.app.payments.admin_reverse_payment \
     --tenant TENANT_ID \
     --payment-id PAYMENT_ID \
     --reason "sandbox event in prod, see ticket #1234"
   ```
3. If `provider_payment_id` is valid but provider returned 404, contact the provider per §5.

### 2.3 Amounts differ but no unmatched records

**Most common cause:** Currency conversion drift, settlement fee subtraction,
or rounding (IQD has no decimals — see ADR-LR-002).

Steps:
1. For each tenant in this state, run the per-payment diff:
   ```bash
   python -m backend.app.payments.recon.detail \
     --tenant TENANT_ID --date YYYY-MM-DD
   ```
2. Read the columns:
   - `our_amount`, `provider_amount`, `provider_fee`, `delta`
3. If `delta == provider_fee` for all rows → the tenant is on a "net" settlement (provider keeps fees). Update the tenant's payment provider config to `settlement_mode: net` and re-run recon. The fee then maps to GL account `5XXXX — Payment Processor Fees`.
4. If `delta < 250 IQD` per row → IQD rounding drift. Annotate as accepted variance.
5. If `delta` is large and unexplained → escalate.

### 2.4 Double payments

**Cause:** Customer clicked "Pay" twice in 5 seconds; the hosted page debounce
failed; OR the provider sent two webhooks for the same `intent_id`.

Steps:
1. Pull all Payment docs for the invoice:
   ```
   SELECT * FROM tenants/{id}/payments
   WHERE invoice_id = "INV_ID" AND status = "paid"
   ```
2. Confirm both are real settlements at the provider.
3. Refund one via the provider-specific flow in §4. Use the second (chronologically later) one for the refund — the first is the legitimate payment.
4. File audit entry: `payment_double_refund` with both payment_ids.

---

## 3. Per-provider triage

### 3.1 Cash

- No webhook. All `Payment`s with `provider: cash` are manually entered at the POS or in the back office.
- Reconciliation is between the POS cash drawer count (Z-report) and the sum of cash Payments for that shift.
- **Discrepancy procedure:**
  1. Open the POS session: `tenants/{id}/pos_sessions/{session_id}`.
  2. Compare `cash_in_drawer_close` − `cash_in_drawer_open` − `cash_paid_out` vs sum of `cash` Payments in that session.
  3. If positive → operator forgot to record a sale. Investigate from receipts.
  4. If negative → operator either made change wrong or there's a theft / shrinkage event. Flag to manager.
  5. Acceptable variance per session: **±500 IQD**. Anything above goes to the cash overage/shortage GL account.

### 3.2 COD (Cash on Delivery)

- Webhook on state changes: `pending → out_for_delivery → delivered → settled`.
- Settlement only happens after the driver returns and remits cash.
- **Common issue:** driver returns cash but the courier admin doesn't push the `settled` event for 2-3 days.
- **Procedure:**
  1. Filter `tenants/{id}/payments` where `provider: cod` AND `status: delivered` AND `delivered_at < now-3d`.
  2. Contact courier admin with the list.
  3. Once settled webhook arrives, GL posts automatically.
  4. If courier closes the day without settling, escalate per §5.

### 3.3 Stripe

- Webhook: `payment_intent.succeeded`, `charge.refunded`, `charge.dispute.created`.
- Settlement: T+2 to the bank account; we record settlement separately from payment.
- **Procedure:**
  1. Match Payments to Stripe Dashboard → Payments → filter by date.
  2. Discrepancies usually mean: an authorization that never captured, OR a refund processed by Stripe support without going through our app.
  3. Check the Stripe Dashboard → Events log for the affected `payment_intent`.
  4. If a refund was processed externally, mirror it manually:
     ```bash
     python -m backend.app.payments.admin_refund \
       --tenant TENANT_ID \
       --payment-id PAYMENT_ID \
       --amount-minor 50000 \
       --reason "Stripe support refund, ref CR-xxxxxx"
     ```

### 3.4 FastPay (PENDING — R7.2)

> **Status:** Adapter scaffolded, **sandbox credentials not yet obtained**. The
> procedure here is the planned workflow once R7.2 lands. Until then, FastPay
> payments are recorded manually with `provider: cash` and a `note: "FastPay"` field.

Planned procedure (once sandbox is live):
- Webhook: `payment_completed`, `payment_failed`, `refund_completed`.
- Settlement: T+1 to the merchant's FastPay merchant balance.
- Daily reconciliation against the FastPay merchant export (CSV, currently expected via API).

### 3.5 Qi Card (PENDING — R7.3)

> **Status:** Business API access not granted. No production traffic.

Planned procedure:
- Webhook contract not finalized; settlement is reported to be T+2.
- Until the contract is signed and KYC complete, treat Qi as manual entry only.

### 3.6 Zain Cash (PENDING — R7.4)

> **Status:** Merchant API documentation not received. No production traffic.

Planned procedure:
- Per industry norms (Asia Cell parent operator), expect OTP-based confirmation and webhook.
- Until merchant ID and webhook contract are confirmed, treat Zain Cash as manual entry only.

---

## 4. Manual reconciliation (when automated job fails)

If the nightly job exited with status `failed`, do this:

### 4.1 Diagnose the failure

```bash
# Last run logs
gcloud logging read 'resource.type="cloud_run_job"
  resource.labels.job_name="payments-recon-nightly"
  severity>=ERROR' --limit=20 --format=json
```

Common failure modes:
- Firestore read timeout on a large tenant → re-run with `--tenant <id>` for just that one.
- Provider API rate-limited during the export pull → wait 1 hour, re-run.
- New provider added without recon adapter → file issue, fall back to manual.

### 4.2 Manual procedure per tenant

1. Export Payments for the day:
   ```bash
   python -m backend.app.payments.export --tenant TENANT_ID --date YYYY-MM-DD --format csv > payments.csv
   ```
2. Pull provider settlement report (Stripe Dashboard → Reports → Balance change from activity; or provider API export).
3. Load both into a spreadsheet (the `xlsx` skill can help).
4. Diff by `provider_payment_id`. Investigate everything that doesn't match.
5. Once reconciled, manually create the recon document:
   ```bash
   python -m backend.app.payments.recon.manual_close \
     --tenant TENANT_ID \
     --date YYYY-MM-DD \
     --status clean \
     --note "manual recon, automated job failed"
   ```

---

## 5. Refund procedures (per provider)

### 5.1 Cash

- "Refund" means the cashier hands cash back. Recorded as a negative Payment via POS refund flow.
- GL: Debit Sales Returns, Credit Cash.
- No provider call.

### 5.2 COD

- If delivered and settled: refund via cash (§5.1) at customer pickup, or via bank transfer.
- If delivered but not settled: cancel the COD payment; courier just won't remit.
- If not yet delivered: cancel the order; no payment was ever recorded.

### 5.3 Stripe

- UI: Settings → Payments → Find Payment → Refund. Backend calls `stripe.Refund.create(...)`.
- Webhook `charge.refunded` confirms; GL posts reversal.
- Full refunds within 90 days have no Stripe fee deduction.
- Partial refunds: provide amount in minor units.

### 5.4 FastPay / Qi / Zain

PENDING. Once live: refund via provider API or merchant dashboard, mirror in our system.

---

## 6. Customer dispute handling

### 6.1 Stripe dispute (chargeback)

Webhook `charge.dispute.created` flips the Payment to `disputed`.

Steps:
1. Within 7 days, gather evidence: invoice, delivery confirmation, customer correspondence.
2. Submit via Stripe Dashboard → Disputes → Submit evidence.
3. If lost: Stripe debits the disputed amount + a fee. Our GL: Debit Bad Debt + Debit Dispute Fee, Credit Cash.
4. Block the customer at the tenant if the dispute is clearly fraudulent.

### 6.2 Cash / COD dispute

Customer says "I didn't pay" or "I didn't get my goods":
1. Pull the receipt (cash) or delivery confirmation (COD) from `tenants/{id}/audit_log`.
2. If we have evidence: present to customer. No system action.
3. If we don't: tenant decision. Document the decision in the audit log via the admin tool.

---

## 7. Escalation to provider support

| Provider | Channel | Typical response |
|----------|---------|------------------|
| Stripe | Dashboard chat or `support@stripe.com` | 2-6 hours |
| FastPay | TBD (per R7.2) | TBD |
| Qi Card | TBD (per R7.3) | TBD |
| Zain Cash | TBD (per R7.4) | TBD |

Include in the escalation:
- Provider payment ID, our payment ID, our tenant ID, timestamp UTC, amount + currency, what we believe vs what they report, screenshots.

Internal escalation: Slack `#oncall-backend` for engineering, `#finance-ops` for the bookkeeper.

---

## 8. Related runbooks and docs

- [`saas-dunning.md`](./saas-dunning.md) — when we're the merchant being chased
- [`onboarding-troubleshooting.md`](./onboarding-troubleshooting.md) — payment setup during wizard
- [`docs/dev/payments-architecture.md`](../dev/payments-architecture.md) — system design
- ADR-LR-004 — PaymentGateway abstraction
- ADR-LR-002 — IQD without decimals (rounding rules)

---

*Last reviewed: 2026-05-29 by Safa Othman. Re-review when FastPay/Qi/Zain sandbox creds land.*
