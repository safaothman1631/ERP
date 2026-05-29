# Runbook — Onboarding Troubleshooting / چارەسەری کێشەکانی Onboarding

> **Spec ref:** `.kiro/specs/launch-readiness` T-LR.6.3, design §4 (Onboarding Wizard)
> **Owner:** Safa (Customer Success) + Frontend on-call
> **Audience:** Tier-1 / Tier-2 support, on-call engineers
> **Language:** English (engineer-facing) + Kurdish (customer-facing scripts)

This runbook covers the four highest-volume failure modes seen during
tenant onboarding for the Kurdish ERP and the procedure for triaging,
fixing, and communicating each one.

---

## 0. Triage Checklist — Read this first

When a customer reports an onboarding problem, in this order:

1. **Get the `tenant_id`.** Ask "ID ـی کۆمپانیا چییە؟" or pull it from the support ticket. Every other step uses it.
2. **Pin the wizard step.** Ask "لە کام هەنگاودایت؟" (which step?). The wizard has 5 steps:
   `company_info → region → coa → pos_hardware → first_sale`. Step name appears in the URL: `/onboarding/<step>`.
3. **Open Cloud Logging** and filter to that tenant in the last 60 minutes:
   ```
   resource.type="cloud_run_revision"
   labels.tenant_id="TENANT_ID_HERE"
   timestamp >= "now-1h"
   ```
4. **Open the onboarding Firestore doc:**
   ```
   tenants/{tenant_id}/onboarding/state
   ```
   Fields to check: `current_step`, `completed_steps[]`, `last_error`, `coa_template_id`, `region_code`.
5. **Check the wizard telemetry** (T-LR.3.12) at `tenants/{tenant_id}/telemetry/onboarding`
   to see which step the user has retried.

If the issue is not in §1–§4 below, jump to **§5 Escalation**.

---

## 1. Symptom — Wizard Stuck / Wizard ناڕێژەی نییە

**Customer says:** "دوگمەی 'دواتر' (Next) کار ناکات" / "Page is frozen" / "Saving forever"

### 1.1 Common root causes

| Cause | Frequency | Where it shows |
|-------|-----------|----------------|
| Firestore write blocked by security rule | High | Cloud Logging: `PERMISSION_DENIED` from `tenants/{id}/onboarding/state` |
| `PUT /api/onboarding/state` 5xx because backend can't reach Firestore | Medium | Cloud Logging: 500 with stack trace |
| Browser localStorage corrupted (legacy migrate) | Medium | DevTools → Application → `onboarding-state-v1` key has malformed JSON |
| Network drop mid-write — optimistic UI froze on retry | Medium | Network tab: pending POST, no response |
| User on outdated cached SW with the old state machine | Low | DevTools → Application → Service Workers: registered version is more than one release behind |

### 1.2 Triage commands

```bash
# Find the failing request in Cloud Logging (last 15m)
gcloud logging read 'resource.type="cloud_run_revision"
  AND labels.tenant_id="TENANT_ID"
  AND severity>=ERROR
  AND timestamp >= "2026-05-29T00:00:00Z"' \
  --limit=20 --format=json

# Read the Firestore doc directly
gcloud firestore documents get \
  "tenants/TENANT_ID/onboarding/state" \
  --database="(default)"
```

### 1.3 Fix steps

1. If `last_error` field is populated, copy it; this is the most reliable signal.
2. If `PERMISSION_DENIED`: confirm the user's claim `tenant_id` matches the doc path. If not, the user logged in to the wrong workspace — direct them to log out and back in to the correct one.
3. If 5xx backend: check `/healthz` for the backend region; if Firestore is degraded, **wait** and re-try. Do not delete the doc.
4. If corrupted localStorage: have customer run in DevTools console:
   ```js
   localStorage.removeItem('onboarding-state-v1');
   location.reload();
   ```
   The wizard re-hydrates from Firestore.
5. If SW is stale: tell customer to do a hard reload (`Ctrl+Shift+R`).

### 1.4 Customer-facing message (Kurdish)

> "ببورە لە دواکەوتن. ئێمە کێشەکەمان دۆزیوەتەوە. تکایە لاپەڕەکە بە (Ctrl+Shift+R) دووبارە بکەرەوە. ئەگەر دووبارە ڕووی دا، ئەم پەیامەمان بۆ بنێرە: 'TENANT_ID=<...>' بۆ ئەوەی زیاتر بپشکنین."

### 1.5 Customer-facing message (English)

> "Sorry for the delay — we've identified the issue. Please hard-reload the page (`Ctrl+Shift+R`). If it persists, send us this message: `TENANT_ID=<...>` so we can look further."

---

## 2. Symptom — COA Apply Fails / دامەزراندنی COA سەرکەوتوو نییە

**Customer says:** "هەنگاوی هەژمارەکان (Chart of Accounts) سەرکەوتوو نییە" / "Got an error after picking the template"

### 2.1 Common root causes

| Cause | Frequency | Signal |
|-------|-----------|--------|
| Customer already has accounts (re-onboarding) and template would conflict | High | `POST /api/onboarding/coa/apply` returns 409 with `existing_accounts: [<codes>]` |
| Region preset references account codes outside Iraqi 5-digit range | Low | 422 with `invalid_account_code: "XXX"` |
| Race: user double-clicked Apply, second call hit while first wrote | Medium | Two `applied_at` timestamps in `tenants/{id}/accounts/_meta` |
| Backend out of memory writing 200+ accounts at once | Low | 502 from Cloud Run; logs show OOM |

### 2.2 Triage

```bash
# How many accounts already exist?
gcloud firestore collections list "tenants/TENANT_ID/accounts" \
  --database="(default)" | wc -l

# What template did they try to apply?
gcloud firestore documents get \
  "tenants/TENANT_ID/onboarding/state" \
  --format="value(coa_template_id)"
```

### 2.3 Fix steps

**Case A — Existing accounts (most common):**
1. Confirm with customer they want to **replace** their existing COA (rare — they usually want to keep).
2. If they want to keep, mark the step complete without re-applying:
   ```bash
   gcloud firestore documents update \
     "tenants/TENANT_ID/onboarding/state" \
     --update-mask=completed_steps,current_step \
     --data='{"completed_steps":["company_info","region","coa"],"current_step":"pos_hardware"}'
   ```
3. If they want to replace, this is destructive. **Get written confirmation in the ticket.** Then run the admin reset:
   ```bash
   python -m backend.app.tools.admin_coa_reset --tenant TENANT_ID --confirm
   ```
   Then ask customer to re-apply.

**Case B — Invalid account code (rare):**
1. Look at `backend/app/data/coa_templates/<template>.yaml`. Find the offending code.
2. This is a bug — file an issue, then deliver a one-off COA by writing accounts directly via the admin SDK. Do not change the template in prod without going through a release.

**Case C — Double-click race:**
1. The `_meta` doc has `applied_at` from the first call. The second call's accounts may or may not have landed. Run the audit:
   ```bash
   python -m backend.app.tools.coa_audit --tenant TENANT_ID
   ```
2. If duplicates exist, run dedup with `--fix`. Otherwise, mark step complete (see Case A step 2).

### 2.4 Customer-facing message (Kurdish)

> "هەژمارەکان لە سیستەمی تۆدا بوون پێشتر. ئەو کاتە لیستەکەی ئێستات بەکار دێت — پێویست بە دامەزراندنی نوێ ناکات. ئێمە هەنگاوەکە بەلای سیستەمەوە تەواوکرد. تکایە بەردەوام بە بۆ هەنگاوی دواتر."

---

## 3. Symptom — Web Bluetooth Doesn't Pair Printer / پرینتەری Bluetooth جووت نابێت

**Customer says:** "پرینتەرەکە نادۆزرێتەوە" / "Nothing happens when I click Pair"

### 3.1 Common root causes

| Cause | Frequency | Signal |
|-------|-----------|--------|
| Browser is not Chrome / Edge on desktop, or not Chrome on Android | Very High | `navigator.bluetooth` is undefined |
| Customer using iOS Safari (no Web Bluetooth at all) | High | User-agent contains `iPhone` or `iPad` |
| Bluetooth turned off on the device | High | OS-level dialog dismissed without picking a device |
| HTTPS not active (Web Bluetooth requires secure context) | Low | Customer is on `http://` — only possible if our DNS broke |
| Printer is not in pairing mode (Xprinter XP-58/80 need the feed-button hold for 3s) | Medium | Browser shows "No device found" |
| Printer paired to a different host already (Sunmi V2) | Medium | Picker shows the device but pairing rejects |

### 3.2 Triage commands (have customer paste into DevTools Console)

```js
// 1. Bluetooth API present?
console.log('bt:', typeof navigator.bluetooth);

// 2. Secure context?
console.log('secure:', window.isSecureContext);

// 3. List nearby devices (Chromium only)
navigator.bluetooth.requestDevice({
  filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
  optionalServices: ['battery_service']
}).then(d => console.log('device:', d.name, d.id))
  .catch(e => console.error('reject:', e));
```

### 3.3 Fix steps

1. **Browser check:** If they're on iOS Safari or Firefox, the answer is: switch browser. There is no fix.
   - Recommend: Chrome on Android, or Chrome/Edge on Windows.
2. **Pairing mode:** Walk through the printer-specific reset:
   - **Xprinter XP-58 / XP-80:** Hold the FEED button for 3 seconds while powering on. The blue LED should flash rapidly.
   - **Sunmi V2 Pro built-in:** No pairing; it's USB-internal. Use the "Internal printer" option, not Bluetooth.
   - **Bixolon SPP-R200III:** Hold the feed button and POWER together until you hear two beeps.
4. **Already paired elsewhere:** Tell the customer to unpair from the OS Bluetooth settings first. Web Bluetooth cannot grab a printer that the OS holds.
5. **HTTPS:** Confirm the URL bar shows the padlock. If not, our DNS / cert is broken — escalate to platform.

### 3.4 Skip-and-pair-later flow

The wizard step is optional. Tell the customer:
> "تۆ دەتوانیت ئەم هەنگاوە لێ بگەڕێیت ئێستا و دواتر لە Settings → Hardware → Printers جووت بکەیت."

Mark the step complete with `skipped: true`:
```bash
gcloud firestore documents update \
  "tenants/TENANT_ID/onboarding/state" \
  --update-mask=completed_steps,skipped_steps,current_step \
  --data='{"completed_steps":["company_info","region","coa","pos_hardware"],"skipped_steps":["pos_hardware"],"current_step":"first_sale"}'
```

---

## 4. Symptom — Region Preset Doesn't Auto-Fill Tax Rates / ڕێژەی باج بە خۆکاری پڕ نابێتەوە

**Customer says:** "پارێزگاکەم هەڵبژارد بەڵام ڕێژەی باج ٠ یە" / "Selected my region but VAT is empty"

### 4.1 Common root causes

| Cause | Frequency | Signal |
|-------|-----------|--------|
| Region picked has `last_verified` older than 12 months → preset disabled | High | `iraqRegionPresets.ts` entry shows `verified_until < today` |
| Customer picked "Other / دیکە" instead of a specific governorate | Medium | `region_code` is `IQ-OTHER` |
| Tax rates are placeholder values (R7.1 not resolved) | High (today) | All rates show `null` with a banner "ڕێژەکان دواتر تەواو دەکرێن" |
| Browser locale = `ar-IQ` but preset only loaded `ku-CKB` strings | Low | UI shows region name but no rates |

### 4.2 Fix steps

1. **Placeholder values (today's reality):** Confirm via the placeholder banner in the wizard. Tell the customer:
   > "ئێستا ڕێژەی باج ئاسایی پارێزگاکەت ٠ یە لە سیستەمی ئێمە چونکە هێشتا فەرمیانە لە ژمێریاری عێراق دانامەنرابوون. تکایە ڕێژەی پێویست بە دەستی تۆمار بکە (یان لێی بگەڕێ بۆ ئەو کاتەی ئێمە تەواوی دەکەین)."
2. **Old `last_verified`:** This is intentional — we hide stale data. Tell the customer to set the rate manually in Settings → Taxes once. We'll update the preset in the next release.
3. **`IQ-OTHER`:** Walk them through the manual tax-rate entry.
4. **Locale mismatch:** Have the customer hard-reload after switching language; the preset re-resolves on mount.

### 4.3 Reference data location

| What | Where |
|------|-------|
| Region presets | `frontend/src/data/iraqRegionPresets.ts` |
| Backend tax YAML | `backend/app/data/iraq_tax_rates.yaml` |
| Open question on real rates | R7.1 in `_deltas/launch-readiness-REMAINING-WORK.md` |

---

## 5. Escalation

Escalate to the dev team (Slack `#oncall-frontend` or `#oncall-backend`) when:

- The error is a 5xx that does **not** match any pattern in §1–§4.
- The customer's data appears corrupted (mismatched `completed_steps` / `current_step`).
- Firestore writes are failing for more than one tenant in the same window (broad outage signal).
- The customer is enterprise tier (any tenant on `Pro` plan or a contracted account).
- The customer threatens to churn or escalates to legal/regulator language.

Include in the escalation:
- `tenant_id`, the wizard step, the time window (UTC + Baghdad), the Cloud Logging filter you used, what you've already tried.

Expected response times:
- `Pro` tier customer: 1 hour (business hours), 4 hours (off-hours)
- `Growth`: 4 hours business hours
- `Starter`: next business day

---

## 6. Postmortem template (if customer was affected > 30 min)

Create `audit/onboarding-incidents/YYYY-MM-DD-<tenant>.md`:

```markdown
# Onboarding incident — TENANT_ID — YYYY-MM-DD

* **Reported:** YYYY-MM-DD HH:MM (Baghdad, +03:00)
* **Resolved:** YYYY-MM-DD HH:MM
* **Duration of impact:** Nh Nm
* **Customer:** <name>, <plan tier>
* **Step affected:** company_info / region / coa / pos_hardware / first_sale
* **Severity:** SEV-1 (blocked launch) / SEV-2 (workaround) / SEV-3 (cosmetic)

## What the customer experienced
<1-2 sentences from their POV>

## Root cause
<1 paragraph, link to commit/PR if a bug>

## What we did
- [time] action
- [time] action

## Why it took N minutes
<honest assessment>

## Preventive actions
- [ ] Code fix: <link to issue>
- [ ] Runbook update: <link to PR>
- [ ] Customer follow-up: <date>

## Customer comms
- Initial reply at: HH:MM
- Resolution at: HH:MM
- Apology / credit: yes/no, amount
```

The file is committed to the repo on the same day.

---

## 7. Related runbooks

- [`pos-offline-drill.md`](./pos-offline-drill.md) — POS connectivity drill
- [`slow-firestore-read.md`](./slow-firestore-read.md) — When the wizard hangs on a read
- [`saas-dunning.md`](./saas-dunning.md) — When the wizard finishes but billing fails

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review after first 10 production tenants completed onboarding.*
