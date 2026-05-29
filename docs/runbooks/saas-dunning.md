# Runbook — SaaS Dunning / دوواندنی پارەی بەشداری

> **Spec ref:** `.kiro/specs/launch-readiness` T-LR.6.5, T-LR.5.5
> **Owner:** Safa (billing ops) + Backend on-call
> **Audience:** Billing ops, customer success
> **Language:** Kurdish + English + Arabic (customer comms templated below)

This runbook covers our subscription dunning lifecycle for tenants
whose SaaS subscription payment fails — both for Stripe-billed tenants
(global) and FastPay / cash / bank-transfer Iraqi tenants.

---

## 1. Dunning sequence overview

When a renewal payment fails (or doesn't arrive for a manual payer),
the dunning engine (`backend/app/billing/dunning.py`) moves the tenant
through these stages.

| Day | Stage | Customer action | System action | Tenant access |
|-----|-------|-----------------|---------------|---------------|
| **0** | Payment failed | Email + in-app banner | Stripe retry scheduled; manual payer marked `past_due` | Full |
| **+3** | First reminder | Email + SMS (if number on file) | Stripe retries (smart retries) | Full |
| **+7** | Second reminder | Email + SMS + in-app modal on every login | Stripe retries again | Full, modal must be dismissed |
| **+14** | Final reminder | Email + SMS + phone call from CS (Pro tier only) | Stripe stops retries; manual flag for outreach | Read-only after 14d |
| **+30** | Suspension | Email "service suspended" | Tenant `status: suspended`; reads of own data still allowed for export | Suspended (export only) |
| **+90** | Termination | Email "data deletion in 30 days unless paid" | Tenant marked `pending_deletion` | Data export only |
| **+120** | Deletion | Final email | Hard delete after legal review | None |

> Trial expiry follows a separate flow (see §8). Day-0 there is the trial
> end, not a payment failure.

### 1.1 Where the state lives

Per tenant:
```
tenants/{tenant_id}/billing/subscription
  ├── status: active | past_due | suspended | pending_deletion | canceled
  ├── dunning_stage: 0 | 3 | 7 | 14 | 30 | 90 | 120
  ├── dunning_paused: bool
  ├── next_action_at: timestamp
  ├── last_email_sent_at: timestamp
  ├── manual_override: { by: <user>, reason: string, expires_at: timestamp }
  └── plan: starter | growth | pro
```

### 1.2 How transitions fire

A Cloud Scheduler cron at `02:00 UTC` daily runs:
```bash
python -m backend.app.billing.dunning.advance
```

It picks up every subscription where `next_action_at <= now()` and runs
the stage handler. Stage handlers are idempotent (safe to retry).

---

## 2. Manual override — Pause dunning for a customer

When the customer is in active conversation with us (paying a bank
transfer, waiting for finance approval on their side, etc.), pause
dunning so emails stop.

### 2.1 UI (preferred)

1. Super-admin → Billing → Tenants → `<tenant_id>` → Dunning → "Pause"
2. Provide a reason (free text, required, logged).
3. Choose duration (max 30 days; longer requires VP approval).

### 2.2 CLI (fallback)

```bash
python -m backend.app.billing.dunning.pause \
  --tenant TENANT_ID \
  --reason "customer paying via bank transfer, awaiting confirmation, ref ticket #1234" \
  --until 2026-06-15T00:00:00Z
```

Writes:
- `tenants/{id}/billing/subscription.dunning_paused = true`
- `tenants/{id}/billing/subscription.manual_override = { by, reason, expires_at }`
- Audit log entry `dunning_paused`

While paused: no emails, no SMS, no status transitions.

### 2.3 Unpause

```bash
python -m backend.app.billing.dunning.resume --tenant TENANT_ID
```

Or via UI ("Resume" button). The system **does not** automatically
advance the stage on resume — it picks up wherever it was paused.

---

## 3. Manual override — Skip a stage

Use when the next reminder is inappropriate (e.g. tenant just paid via
bank transfer 2 hours ago; the day-7 email is queued for tonight and
we want to skip it).

```bash
python -m backend.app.billing.dunning.skip \
  --tenant TENANT_ID \
  --from-stage 7 --to-stage 0 \
  --reason "payment received via bank transfer, applied manually, see receipt #BR-9988"
```

Or via UI: Dunning panel → "Skip to stage" dropdown.

Skipping to `stage 0` resets the tenant to good standing. The next
renewal cycle starts fresh.

---

## 4. Mark a manual payment as received (FastPay / cash / bank transfer)

For tenants who pay outside Stripe (the majority of Iraqi customers
until Stripe alternatives are wired), we record their payment
manually.

### 4.1 UI

Super-admin → Billing → Tenants → `<tenant_id>` → "Record manual payment"
- Amount (minor units; IQD has no decimals — so `250000` = 250,000 IQD)
- Currency: IQD or USD
- Provider: `bank_transfer` / `fastpay_manual` / `cash`
- Reference: bank reference number, FastPay tx id, or receipt number
- Date paid (defaults to now)
- Attach proof (PDF/JPG of receipt or bank slip)

The system:
1. Creates a `Payment` record with `created_via: admin_manual`.
2. Marks the subscription `paid_through: <next_period_end>`.
3. Transitions `status: active`, `dunning_stage: 0`, clears `manual_override`.
4. Emails the customer the receipt.
5. Audit log entry `manual_payment_recorded`.

### 4.2 CLI

```bash
python -m backend.app.billing.manual_payment \
  --tenant TENANT_ID \
  --amount-minor 250000 \
  --currency IQD \
  --provider bank_transfer \
  --reference "BR-9988" \
  --paid-at 2026-05-28T14:00:00+03:00 \
  --proof /path/to/receipt.pdf
```

---

## 5. Suspend / reactivate a tenant

### 5.1 Suspend (manual)

Auto-suspension happens at stage 30. Manual suspension is rare — only
for non-payment escalations or abuse.

```bash
python -m backend.app.billing.suspend \
  --tenant TENANT_ID \
  --reason "non-payment, see ticket #1234"
```

Effect:
- `status: suspended`
- Tenant users see a banner "Account suspended — contact billing"
- Login is allowed but all write APIs return 402 (Payment Required)
- Read APIs allowed for 90 days for export purposes

### 5.2 Reactivate

```bash
python -m backend.app.billing.reactivate --tenant TENANT_ID
```

Effect:
- `status: active`
- `dunning_stage: 0`
- Writes restored
- If reactivation is during the grace period (30 < day < 90), prior data is intact

If reactivation is after termination (day 120+) the data is gone — see legal review.

---

## 6. Customer communication templates

Each stage email/SMS exists in three languages. The system picks the
language from `tenants/{id}/billing/contact.preferred_language`.

### 6.1 Day 0 — Payment failed

**Kurdish (`ku-CKB`):**

> Subject: پارەدانی بەشداری سەرکەوتوو نەبوو
>
> سڵاو {{ contact_name }}،
>
> پارەدانی مانگانەی بەشداریت بۆ {{ company_name }} لە سیستەمی Zoho Kurdish ERP سەرکەوتوو نەبوو. تکایە لە {{ billing_url }} هەوڵبدەرەوە. ئەگەر پێویستت بە یارمەتیە، وەڵامی ئەم ئیمێڵە بدەوە یان زەنگ بدە بە +964-XXX-XXXX.
>
> سپاس،
> تیمی Zoho Kurdish ERP

**English:**

> Subject: Your subscription payment didn't go through
>
> Hi {{ contact_name }},
>
> The monthly payment for your {{ company_name }} subscription didn't go through. You can retry at {{ billing_url }}. If you need help, reply to this email or call +964-XXX-XXXX.
>
> Thanks,
> The Zoho Kurdish ERP team

**Arabic (`ar-IQ`):**

> Subject: لم تنجح عملية الدفع للاشتراك
>
> مرحبًا {{ contact_name }}،
>
> لم تنجح عملية الدفع الشهري لاشتراك {{ company_name }} في نظام Zoho Kurdish ERP. يمكنك إعادة المحاولة عبر {{ billing_url }}. إذا كنت بحاجة إلى مساعدة، فقط رد على هذه الرسالة أو اتصل بنا على +964-XXX-XXXX.
>
> شكرًا،
> فريق Zoho Kurdish ERP

### 6.2 Day 3 — First reminder

**Kurdish:**
> سڵاو {{ contact_name }}، پارەدانی بەشداریت هێشتا چاوەڕێیە. تکایە لە {{ billing_url }} تەواوی بکە. سپاس.

**English:**
> Hi {{ contact_name }}, your subscription payment is still outstanding. Please complete it at {{ billing_url }}. Thanks.

**Arabic:**
> مرحبًا {{ contact_name }}، لا يزال هناك دفعة معلقة لاشتراكك. يرجى استكمالها عبر {{ billing_url }}. شكرًا.

### 6.3 Day 7 — Second reminder (more urgent)

**Kurdish:**
> سڵاو {{ contact_name }}، پارەدانی بەشداریت ٧ ڕۆژە دواکەوتووە. ئەگەر تا ڕۆژی {{ day_14_date }} نەکرێ، هەژمارەکەت دەکرێتە تەنها خوێندنەوە. تکایە پەیوەندیمان پێوە بکە.

**English:**
> Hi {{ contact_name }}, your subscription payment is 7 days overdue. If not received by {{ day_14_date }}, your account will become read-only. Please get in touch.

**Arabic:**
> مرحبًا {{ contact_name }}، تأخر دفع اشتراكك لمدة 7 أيام. إذا لم يتم استلامه بحلول {{ day_14_date }}، سيصبح حسابك للقراءة فقط. يرجى التواصل معنا.

### 6.4 Day 14 — Final reminder + phone call (Pro tier only)

**Kurdish:**
> ئاگاداری کۆتایی: هەژمارەکەت بۆ {{ company_name }} لە ڕۆژی {{ day_30_date }}دا بێ کار دەکرێ. تکایە پارەدانەکە تەواو بکە یان زەنگمان بکە لە +964-XXX-XXXX.

**English:**
> Final notice: Your {{ company_name }} account will be suspended on {{ day_30_date }}. Please complete payment or call us at +964-XXX-XXXX.

**Arabic:**
> إشعار أخير: سيتم تعليق حساب {{ company_name }} في {{ day_30_date }}. يرجى استكمال الدفع أو الاتصال بنا على +964-XXX-XXXX.

### 6.5 Day 30 — Suspension notification

**Kurdish:**
> هەژمارەکەت ئێستا بێ کار کراوە. داتاکانت سەلامەتە و دەتوانیت دەریان بهێنیت. بۆ چالاککردنەوە، پارەدانەکە تەواو بکە لە {{ billing_url }}.

**English:**
> Your account is now suspended. Your data is safe and you can export it. To reactivate, complete payment at {{ billing_url }}.

**Arabic:**
> تم تعليق حسابك. بياناتك آمنة ويمكنك تصديرها. لإعادة التفعيل، أكمل الدفع عبر {{ billing_url }}.

### 6.6 Day 90 — Pending deletion

**Kurdish:**
> داتاکانت لە {{ day_120_date }}دا دەسڕێنرێتەوە مەگەر هەژمارەکە چالاک بکرێتەوە. ئەمە کۆتا دەرفەتە.

**English:**
> Your data will be deleted on {{ day_120_date }} unless the account is reactivated. This is the final notice.

**Arabic:**
> سيتم حذف بياناتك في {{ day_120_date }} ما لم يتم إعادة تفعيل الحساب. هذا هو الإشعار الأخير.

---

## 7. Edge cases — Iraq-specific

### 7.1 Iraqi bank holidays

Iraq's banking system observes:
- Eid al-Fitr (3 days)
- Eid al-Adha (4 days)
- Islamic New Year (1 day)
- Prophet's Birthday (1 day)
- Iraqi National Day, Jan 1
- Newroz, Mar 21 (especially KRG region)
- Plus governorate-specific holidays

**Policy:** Bank holidays of ≥ 2 consecutive days automatically extend
the dunning timer for affected tenants by the holiday length. The
config lives in `backend/app/data/iq_bank_calendar.yaml`.

When a tenant is in a payment-failed stage during a multi-day holiday,
the engine pauses transitions; no emails are sent during the holiday;
the timer resumes the next business day.

### 7.2 Ramadan

During Ramadan, business hours in Iraq compress and decisions slow.
**Policy:** During Ramadan (auto-detected from Hijri calendar):
- Day-3 and day-7 reminders extend to day-5 and day-10.
- Day-14 and day-30 remain (to protect us from runaway non-payment).
- Phone call outreach (day 14 Pro) is daytime only (08:00-13:00 Baghdad).

### 7.3 End of fiscal year (December)

Many Iraqi SMBs delay payments to next fiscal year for tax reasons.
**Policy:** From Dec 15 to Jan 15:
- Suspension is held at day-45 (not day-30) for tenants > 6 months tenure.
- Manual outreach prioritized over auto-emails.
- The exception is logged per tenant for audit.

### 7.4 KRG vs Federal Iraq

Tenants in KRG region (Erbil, Sulaymaniyah, Duhok, Halabja) follow KRG
public-holiday calendar; tenants in federal Iraq follow the Baghdad
calendar. The system reads `tenants/{id}/region_code` and picks the
correct calendar automatically.

---

## 8. Free-trial expiration (separate from payment failure)

90-day trial (ADR-LR-006). At day 75 we start nudging:

| Day | Action |
|-----|--------|
| 75 | Email: "15 days left in your trial" + in-app banner |
| 83 | Email: "7 days left" + ask which plan |
| 89 | Email: "1 day left" |
| 90 | Trial ends. If payment method on file → charge; if not → grace stage 0 |
| 90 + 14 | Read-only |
| 90 + 30 | Suspension |

Manual extension: `python -m backend.app.billing.extend_trial --tenant TENANT_ID --days N --reason "..."`.

---

## 9. When to escalate to engineering / finance

| Situation | Escalate to |
|-----------|-------------|
| Dunning email sent in wrong language | Engineering — locale resolution bug |
| Multiple tenants in stage 14+ at once | Finance + Engineering — possible Stripe outage or webhook backlog |
| Customer disputes a charge with bank | Finance ops |
| Customer requests data export after deletion | Legal review |
| Customer abusive in email — auto-pause needed | Customer Success + Legal |

---

## 10. Related runbooks and docs

- [`payment-reconciliation.md`](./payment-reconciliation.md) — for tenant-side payments (different system)
- [`docs/dev/billing-architecture.md`](../dev/billing-architecture.md) — engine design
- ADR-LR-005 — dunning day-3/7/14/30 rationale
- ADR-LR-006 — 90-day free trial rationale
- ADR-LR-003 — Stripe choice for SaaS billing

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review after first 10 dunning cycles complete.*
