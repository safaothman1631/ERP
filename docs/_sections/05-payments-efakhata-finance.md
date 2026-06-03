## ٥) پارەدانی عێراقی · e-Fakhata · GL/Decimal

> ئەم بەشە ڕێنمایی جێبەجێکردنی **پارەدانی عێراقی**، **e-Fakhata (فاکتوری ئەلیکترۆنیی وەزارەتی دارایی)**، و چاکسازیی **GL/Decimal**ـی دارایی دەگرێتەوە. هەموو ئەو شتانەی لێرە باسکراون لەسەر کۆدی ڕاستەقینەی `backend/app/` بنیاتنراون. **هیچ گۆڕانکارییەک هێشتا جێبەجێ نەکراوە** — ئەمە ڕێنماییەکی پشکنراوە (reviewed guide)؛ کۆدی کۆپی-پەیست لێرە هەیە بەڵام دەبێت لەسەر Windows جێبەجێ بکرێت + `pytest` ڕان بکرێت.

دۆخی ئێستا بەکورتی:

| پارت | دۆخ |
|------|-----|
| **Stripe** (نێودەوڵەتی) | ✅ **تەواو ڕاستەقینە** — PaymentIntents + webhook HMAC + reconciliation. تەنها `STRIPE_SECRET_KEY` پێویستە. |
| **Cash / COD** | ✅ کار دەکات — cash یەکسەر `succeeded`، refund بە zincîreی negative payment. |
| **FastPay / Qi / Zain Cash / Asia Pay** | ⏳ **سکێلێتۆن** — هەر پێنج میتۆد `NotImplementedError` دەدەن تا credential-ی merchant بێت (R7.2–R7.5). |
| **FIB / Zain Cash webhook (سپرینتی Iraq Payments)** | ✅ **HMAC-SHA256 verify** زیادکرا (P0 fix) — `app/api/iraq_payments.py`. |
| **e-Fakhata (MoF)** | ⏳ **پایپلاینی تەواو** (schema/sign/queue/worker/client) بەڵام endpoint-ەکان `# TODO: verify (R7.X)`ن و `MOF_BASE` بەتاڵە. |
| **GL/Decimal دارایی** | ⏳ ڕێنمایی پشکنراو لە `_deltas/P0-finance-correctness-IMPLEMENTATION.md` — **جێبەجێ نەکراوە**. |

---

### ٥.١) کۆنترات/Interfaceـی Gateway (پێنج میتۆد)

هەموو adapter-ەکانی پارەدان هەمان کۆنتراتی `PaymentGateway` جێبەجێ دەکەن — ئەمە لە `backend/app/payments/gateway.py` پێناسەکراوە وەک `Protocol`ـێکی تەسک. هەر adapter پێویستە `slug`ـێکی بێهاوتای هەبێت + ئەم **پێنج میتۆدە async**ـە:

```python
# backend/app/payments/gateway.py
@runtime_checkable
class PaymentGateway(Protocol):
    """Adapter contract. ``slug`` must be unique across registered providers."""

    slug: str

    async def initiate(self, amount: Money, order: PaymentOrder) -> InitiateResult: ...

    async def capture(self, payment_id: str) -> CaptureResult: ...

    async def refund(
        self, payment_id: str, amount: Optional[Money] = None, *, reason: str = ""
    ) -> RefundResult: ...

    async def verify_webhook(self, headers: dict[str, str], body: bytes) -> WebhookEvent: ...

    async def get_status(self, payment_id: str) -> PaymentStatus: ...
```

Value object-ە گرینگەکان (هەمان فایل):

- **`Money(amount: Decimal, currency: str)`** — هەموو بڕەکان `Decimal`ـن (نەک float). `minor_units()` بۆ IQD ژمارەی تەواو (بێ fils) دەگەڕێنێتەوە، بۆ USD/EUR ×100.
- **`PaymentOrder`** — `invoice_id` یان `line_items` + `metadata` (کە `org_id`ـی تێدایە — هەموو adapter پێویستی پێیەتی).
- **`InitiateResult`** — `next_action_kind` ∈ `'qr' | 'redirect' | 'confirm' | 'client_secret'` کە frontend پێی دیاری دەکات کام widget بنوێنێت.
- **`PaymentStatus`** (Enum) — `pending`, `requires_action`, `out_for_delivery`, `delivered`, `authorized`, `succeeded`, `settled`, `refunded`, `partially_refunded`, `returned`, `failed`, `cancelled`.
- **هەڵەکان** — `PaymentProviderNotConfigured` (credential نییە → 503)، `WebhookSignatureInvalid` (verify شکست → 401)، `PaymentNotFound`.

**Registry** (`backend/app/payments/registry.py`): adapter-ەکان لە کاتی import خۆیان `register()` دەکەن، API layer بە `get(slug)` دۆزینەوەیان دەکات، و per-tenant enablement بە `list_enabled(TenantPaymentConfig)` لەسەری دادەنرێت (دەخوێنرێتەوە لە `tenants/{tid}/payment_providers/{slug}`).

**گرینگ:** هەر چوار gateway-ی عێراقی (`FastPayGateway`, `QiCardGateway`, `ZainCashGateway`, `AsiaPayGateway`) ئێستا هەر پێنج میتۆدیان `raise NotImplementedError(_BLOCKED)` دەکەن (یان `PaymentProviderNotConfigured` لە `_require_configured()`). ساختاریان **تەواو وەک Stripe** دانراوە بۆ ئەوەی wiring-ی API layer هەمان بێت — کاتێک credential دێت، تەنها بدرکێنرێنەوە و route-ەکان زیندوو دەبن.

---

### A) Gateway-ە عێراقییەکان — سکێلێتۆنی پڕکردنەوە

هەر چوار فایل (`fastpay_gateway.py`, `qi_gateway.py`, `zain_cash_gateway.py`, `asia_pay_gateway.py`) ئێستا `__init__`ـیان credential وەردەگرن (بەڵام `None`ـن) و `_require_configured()`ـیان هەیە کە `PaymentProviderNotConfigured` دەداتەوە ئەگەر credential نەبێت. خوارەوە بۆ هەر یەکێک: پلانی پڕکردنەوەی میتۆد-بە-میتۆد + قاڵبی پڕکردنەوە.

> **یاسای هاوبەش بۆ هەموویان:** (1) هیچ secret/key لاگ مەکە. (2) لە `verify_webhook` هەمیشە `hmac.compare_digest` بەکاربهێنە (constant-time)، نەک `==`. (3) لە `initiate` بڕ بە `amount.minor_units()` بنێرە (IQD → integer). (4) `org_id` لە `order.metadata['org_id']` وەربگرە و `repo = self._repo_factory(org_id)` دروست بکە — هەمان نموونەی Stripe لە `stripe_gateway.py:91-94`. (5) status-ی provider مەپ بکە بۆ `PaymentStatus` بە dict (وەک `_STRIPE_STATUS_MAP`).

#### A.1) FastPay (`backend/app/payments/fastpay_gateway.py` — R7.2)

دۆکیومێنتی فلۆ لە سەرەی فایلەکە: sandbox base `https://sandbox.fastpaywallet.com/api/v1/`، OAuth `client_credentials` (TTL ~3600s)، `POST /payments` → `{id, qr_string, expires_at}` (QR ٥ خولەک دەمێنێتەوە — `QR_TTL_SECONDS = 300`)، webhook بە `HMAC_SHA256(secret, raw_body)`.

| میتۆد | TODO-ی تایبەتی FastPay | پلان |
|-------|------------------------|------|
| `initiate` | `# TODO(R7.2): POST /oauth/token, then POST /payments; persist QR.` | OAuth bearer بگرە → intent دروست بکە → QR persist بکە، `next_action_kind="qr"` بگەڕێنەوە. |
| `capture` | `# TODO(R7.2): FastPay captures on QR scan; this is effectively no-op.` | FastPay لە کاتی scan خۆی capture دەکات → no-op success. |
| `refund` | `# TODO(R7.2): POST /payments/{id}/refund — confirm FastPay supports refunds.` | پشتڕاست بکەوە FastPay refund پشتگیری دەکات. |
| `verify_webhook` | `# TODO(R7.2): HMAC_SHA256(secret, raw_body) constant-time compare.` | **بڕواننە A.5** — هەمان نموونەی P0 fix لە `iraq_payments.py`. |
| `get_status` | `# TODO(R7.2): GET /payments/{id}; map FastPay statuses to PaymentStatus.` | `GET /payments/{id}` → status mapping. |

قاڵبی پڕکردنەوە (هەر میتۆد بەهەمان شێوە):

```python
# fastpay_gateway.py — وەک نموونە بۆ initiate
async def initiate(self, amount: Money, order: PaymentOrder) -> InitiateResult:
    self._require_configured()
    import httpx
    org_id = order.metadata.get("org_id")
    if not org_id:
        raise ValueError("fastpay gateway requires order.metadata['org_id']")
    repo = self._repo_factory(org_id)

    base = self.SANDBOX_BASE if self._sandbox else "https://api.fastpaywallet.com/api/v1/"
    async with httpx.AsyncClient(timeout=30) as client:
        # 1) OAuth client_credentials → bearer
        tok = await client.post(f"{base}oauth/token", data={
            "grant_type": "client_credentials",
            "client_id": self._client_id,
            "client_secret": self._client_secret,
        })
        tok.raise_for_status()
        bearer = tok.json()["access_token"]   # TODO(R7.2): verify field name
        # 2) create intent
        resp = await client.post(
            f"{base}payments",
            headers={"Authorization": f"Bearer {bearer}"},
            json={
                "amount": amount.minor_units(),       # IQD integer
                "currency": amount.currency,          # 'IQD'
                "description": order.description or "",
                "merchant_reference": order.invoice_id or order.pos_sale_id or "",
                "callback_url": order.metadata.get("callback_url"),  # → /webhook/fastpay?org_id=
            },
        )
        resp.raise_for_status()
        data = resp.json()    # {id, qr_string, expires_at}

    payment = repo.create_payment(
        provider_slug=self.slug, amount=amount.amount, currency=amount.currency,
        status=PaymentStatus.pending, invoice_id=order.invoice_id,
        pos_sale_id=order.pos_sale_id, customer_id=order.customer_id,
        provider_reference=data["id"], provider_data={"qr": data.get("qr_string")},
        created_by=order.metadata.get("actor", "system"),
    )
    return InitiateResult(
        payment_id=payment["id"], provider_slug=self.slug, status=PaymentStatus.pending,
        next_action_kind="qr", next_action={"qr_string": data.get("qr_string")},
        provider_reference=data["id"],
    )
```

#### A.2) Qi Card (`backend/app/payments/qi_gateway.py` — R7.3)

فلۆ (لە سەرەی فایلەکە): sandbox `https://api.sandbox.qicard.iq/v1/`، **hosted payment page (PCI SAQ-A)** — کڕیار ڕەوانە دەکرێت بۆ URL-ی Qi، PIN لەسەر پەڕەی Qi دەنووسێت (3DS لای Qi)، Qi callback دەکات.

| میتۆد | TODO | پلان |
|-------|------|------|
| `initiate` | `# TODO(R7.3): POST /intents → returns hosted-page URL + intent_token.` | `next_action_kind="redirect"`, `next_action={"redirect_url": ...}`. |
| `capture` | `# TODO(R7.3): POST /intents/{id}/capture after auth code received.` | پاش وەرگرتنی auth code. |
| `refund` | `# TODO(R7.3): POST /charges/{id}/refund.` | — |
| `verify_webhook` | `# TODO(R7.3): Confirm signature scheme with Qi business team; placeholder HMAC.` | scheme لەگەڵ تیمی Qi پشتڕاست بکە؛ بەشێوەی پێشینە HMAC. |
| `get_status` | (بێ کۆمێنت) | `GET /intents/{id}` → mapping. |

#### A.3) Zain Cash (`backend/app/payments/zain_cash_gateway.py` — R7.4)

فلۆ: نموونەی **mobile-wallet OTP** (`merchant_id`, `secret`, `msisdn`). webhook signature method **TBD**.

| میتۆد | TODO | پلان |
|-------|------|------|
| `initiate` | `# TODO(R7.4): Push OTP to wallet MSISDN; return next_action 'otp_input'.` | `next_action_kind="otp_input"`. |
| `capture` / `refund` / `verify_webhook` / `get_status` | (بێ کۆمێنت، هەموو `NotImplementedError`) | پاش وەرگرتنی دۆکیومێنتی merchant. **ئاگاداری:** signature scheme دیاری نییە — پێش جێبەجێکردن لەگەڵ Zain پشتڕاست بکە. |

#### A.4) Asia Pay / Asia Hawala (`backend/app/payments/asia_pay_gateway.py` — R7.5)

فلۆ: زۆرتر بۆ import-export، **token-on-file** بۆ recurring. **کەمترین لەپێشینە** بۆ v1 مەگەر کڕیارێکی launch پێویستی پێی هەبێت. هەموو میتۆدەکان `NotImplementedError` تا R7.5.

#### A.5) Webhook HMAC verify — کرۆس-لینک بۆ P0 fix

پێش ئەوەی هیچ webhook-ێکی provider جێبەجێ بکرێت، نموونەی **P0 webhook fix**ـی جێبەجێکراو لە `backend/app/api/iraq_payments.py` ببینە — ئەمە لەمەوبەر چاککراوە بۆ FIB + Zain Cash و دەبێت وەک قاڵب بۆ هەر `verify_webhook`ـێک بەکاربهێنرێت:

```python
# backend/app/api/iraq_payments.py — P0 fix (جێبەجێکراو)
WEBHOOK_SIGNATURE_HEADER = "X-Webhook-Signature"

async def _verify_and_parse_webhook(request: Request) -> PaymentCallback:
    secret = (settings.IRAQ_PAYMENT_WEBHOOK_SECRET or "").strip()
    if not secret:
        # Safe-by-default: بێ secret ناتوانین caller authenticate بکەین → ڕەت بکەرەوە
        raise HTTPException(503, "webhook disabled: signature secret not configured")

    raw_body = await request.body()          # body یەک جار دەخوێنرێتەوە، پێش parse
    provided_sig = request.headers.get(WEBHOOK_SIGNATURE_HEADER, "")
    if not provided_sig:
        raise HTTPException(401, "invalid signature")

    expected_sig = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, provided_sig):   # constant-time
        raise HTTPException(401, "invalid signature")
    # body authenticated → ئێستا parse بکە
    ...
```

خاڵە گرینگەکان کە دەبێت هەر provider-ێک پەیڕەویان بکات:
- **secret unset → 503** (safe-by-default — هەرگیز callback-ی واژۆنەکراو پرۆسێس مەکە).
- **signature header نییە/هەڵە → 401**.
- raw body **یەک جار** بخوێنەرەوە و **پێش هەر parse** verify بکە (بۆ ئەوەی callback-ی فۆرج کراو نەگاتە لۆجیکی مارک-کردنی فاکتورا وەک paid).
- `hmac.compare_digest` (نەک `==`).

سکرتی شارەد لە `backend/app/config.py:96` → `IRAQ_PAYMENT_WEBHOOK_SECRET: str = ""` (دۆکیومێنت لە `config.py:90-96` + `env_docs.py:236`). بۆ provider-ە نوێیەکان (FastPay/Qi) لەوانەیە هەر یەکێک secret-ی جیاوازی هەبێت لە `tenants/{tid}/payment_providers/{slug}` — adapter ئەوە بەکاردەهێنێت نەک سکرتی گشتی.

> **تێبینی wiring:** دوو سیستەمی پارەدان هەن: (1) adapter-ی `app/payments/*_gateway.py` (نوێ، `PaymentGateway` protocol، Stripe/Cash/COD زیندوو)، (2) `app/api/iraq_payments.py` (سپرینتی Iraq Payments، FIB/Zain/Asia Hawala بە config + callback، webhook-ـی P0-fixed). adapter-ە عێراقییەکان (`FastPayGateway` هتد) بۆ سیستەمی یەکەمن؛ کاتێک پڕکرانەوە، `register_default_providers()` لە startup ئەکتیڤیان دەکات.

---

### B) ئەکتیڤکردنی e-Fakhata

پایپلاینی e-Fakhata بەتەواوی نووسراوە بەڵام **بۆ live نەکراوەتەوە**. کۆمپۆنێنتە بوونیارەکان:

- `backend/app/efakhata/schema.py` — مۆدێلی Pydantic + lxml بۆ XML v1.0. **١٤+ جێگا بە `# TODO: verify against published spec (R7.X)` نیشانکراون** (نموونە: `NS_EFK = "http://efakhata.mof.gov.iq/schema/v1"  # TODO: verify (R7.X)` لە `schema.py:32`، governorate validator لە `schema.py:78`).
- `backend/app/efakhata/mof_client.py` — HTTPS + mTLS client. `MOF_BASE` لە env (`mof_client.py:101`)؛ ئەگەر **بەتاڵ بێت → `MoFNotConfigured`** دەداتەوە بۆ ئەوەی queue کۆ بێتەوە بێ تەقینەوەی worker. هەر سێ endpoint بە `# TODO: verify (R7.X)` نیشانکراون:
  - `POST {MOF_BASE}/api/v1/invoices/submit` (`mof_client.py:118`)
  - `GET {MOF_BASE}/api/v1/invoices/{ack}/status` (`mof_client.py:135`)
  - `POST {MOF_BASE}/api/v1/invoices/{ack}/cancel` (`mof_client.py:147`)
  - هەروەها ناوی فیلدی `ack_number`/`ackNumber` لە `mof_client.py:130` بە `# TODO: verify (R7.X)`.
- `backend/app/efakhata/signing.py` — XAdES-BES بە `signxml` (4.x). cert لە PKCS#12 (password یەک جار دەخوێنرێتەوە و دەسڕێتەوە، هەرگیز لاگ نابێت).
- `backend/app/efakhata/submission_queue.py` — Firestore queue، state machine (`pending → submitting → submitted → acknowledged/rejected/failed/cancelled`)، dedup بە `invoice_id`، exponential backoff `BACKOFF_MINUTES = [1, 5, 30, 120, 720]`، `MAX_ATTEMPTS = 5`.
- `backend/app/efakhata/submission_worker.py` — `run_once()` / `process_tenant_queue(tid)`؛ ئەگەر `MoFNotConfigured` → `skipped_not_configured` و break (بێ شکاندنی queue).
- `backend/app/efakhata/version_registry.py` — `current_version = "1.0"`، notes: `"Initial public draft — verify against MoF release (R7.X)."` (`version_registry.py:36`).
- `backend/app/api/efakhata.py` — `POST /api/invoices/{invoice_id}/efakhata/submit` (`efakhata.py:126`).

> **تێبینی:** فلاگی `preview_mode` (default **`True`**) لە سیستەمی گشتیی e-invoice-دا (`app/services/einvoice_service.py:29`، `DEFAULT_EINVOICE_CONFIG`) دەستەمۆ دەکات کە هیچ شتێک بۆ portal نانێردرێت تا `preview_mode=False` بکرێتەوە. ئەمە لایەنی config-ی tenant-ـی e-invoice-ـە (جیاوازە لە queue-ی e-Fakhata-ی MoF کە بە `MOF_BASE` کۆنترۆڵ دەکرێت). بۆ live: هەردووکیان دەبێت ئەکتیڤ بکرێن.

**هەنگاوەکانی live-کردن** (دوای تەسدیقی سپێسی MoF — کرۆس-لینک: `docs/compliance/e-fakhata-mof-verification-checklist.md` ← ئەم چێک-لیستە دەبێت دروست بکرێت/پڕ بکرێتەوە بۆ R7.X پێش live):

1. **تەسدیقی سپێس (R7.X):** هەموو `# TODO: verify against published spec (R7.X)`ـەکان لە `schema.py` + `mof_client.py` + `version_registry.py` لەگەڵ سپێسی بڵاوکراوەی MoF بپشکنە — ناوی namespace، شێوەی فیلد، ڕێگەی endpoint، ناوی `ack_number`. ئەنجامەکان لە چێک-لیستی verification تۆمار بکە.
2. **`MOF_BASE` دابنێ:** env var `MOF_BASE=https://efakhata.mof.gov.iq` (بەڵگە: `env_docs.py:341`؛ دەبێت HTTPS بێت — `mof_client.py:110-111` هەر شتێکی تر ڕەت دەکاتەوە).
3. **Cert بار بکە:** PKCS#12-ـی tenant بار بکە (هەمان cert بۆ XAdES + mTLS). بۆ پڕۆداکشن لە GCP Secret Manager (`tenant-{tid}-efakhata-cert`)؛ بۆ dev/CI `EFAKHATA_LOCAL_CERT_STORE=1` (`cert_storage.py:60`، `env_docs.py:354`).
4. **Submission drain ئەکتیڤ بکە:** job-ـی `efakhata_submission_drain` پێشتر تۆمارکراوە لە scheduler (`scheduler.py:207-215`، `IntervalTrigger(seconds=30)`، `_job_efakhata_submission_drain` → `run_once()`). دەبێت scheduler-ـی **دەرەوەی پرۆسێس** ڕان بکات (APScheduler) — دڵنیابە لە دامەزراندنی production کە scheduler دەستی پێکردووە. کاتێک `MOF_BASE` بەتاڵ بێت، job بێ هەڵە ڕادەوەستێت (`scheduler.py:347`).
5. **ڕەیتە placeholder-ەکان بگۆڕە:** ڕەیتی باج (WHT لە `app/tax/withholding.py`، هەمووی `placeholder=True`) بە ڕەیتی واژۆکراوی ژمێریار بگۆڕەوە (R7.1) — بڕواننە بەشی C.
6. **`preview_mode` بکوژێنەوە:** لە config-ی tenant `preview_mode=False` + `portal_url` دابنێ (`einvoice_service.py:219`) بۆ سیستەمی e-invoice، و دڵنیابە `MOF_BASE` بۆ queue-ی MoF دانراوە.
7. **تێستی end-to-end submit:** فاکتورێکی تاقیکردنەوە دروست بکە → `POST /api/invoices/{id}/efakhata/submit` → دڵنیابە لە queue → چاوەڕێی worker بکە → status بگۆڕێت بۆ `submitted` → `acknowledged` (یان `rejected` بە هۆکار). ack-number لە sandbox-ـی MoF پشتڕاست بکەرەوە پێش پڕۆداکشن.

---

### C) GL/Decimal — ئامادە بۆ جێبەجێکردن

ڕێنماییەکی تەواو لە `_deltas/P0-finance-correctness-IMPLEMENTATION.md` هەیە (**جێبەجێ نەکراوە** — دارایی نابێت بێ تێست بگۆڕدرێت). سێ کەلێنی دروستی نیشان دەدات:

| # | کەلێن | فایل | مەترسی |
|---|------|------|--------|
| **1** | تایبکردنی (confirm/`send`) فاکتوری کڕیار **هیچ JE-یەک ناخات**؛ void/cancel هیچ reversal ناکات. | `app/api/invoices.py`, `app/services/invoice_gl.py` (نوێ) | GL Revenue & AR لە sub-ledger جیا دەبنەوە — لیستە داراییەکان هەڵە. **بێدەنگ** تا audit. |
| **2** | پارەی **وەرگیراو** بەس `balance_due` نوێ دەکات — هیچ Dr Cash / Cr AR ناخات. | `app/services/invoice_payments.py` | Cash & AR لە GL هەرگیز ناجوڵێن کاتێک کڕیار پارە دەدات. |
| **3** | حسابی balance بە **`float`**؛ `withholding.py` لە `round(x + 1e-9, 2)`ـی epsilon-hack بەکاردەهێنێت. | `invoice_payments.py`, `withholding.py` | لادانی ژێر-cent، rounding-ی نا-deterministic، شکستی audit. |

> **پلانی commit (سێ commit-ـی جیا بۆ bisect):** commit 1 = Fix 3 (Decimal — بچووکترین blast radius)؛ commit 2 = Fix 1 (GL on confirm)؛ commit 3 = Fix 2 (GL on payment). engine-ـی double-entry پێشتر ڕاست و atomic-ـە (`accounting.py`, `journal_entry_atomic.py`, `je_validation.py`) — Fix 1 و 2 زۆرتر **wiring + idempotency + reversal**ـن. نموونەی کۆپیکردن: AP side-ـی `bill_payments.create_payment_made_with_je_atomic`.

#### C.1) Fix 3 (دەستپێک — جیاکراوە، مەترسیی کەم): `withholding._round` Decimal

ئێستا لە `backend/app/tax/withholding.py:127-131` (epsilon-hack):

```python
def _round(value: float) -> float:
    """Round to 2 decimals, half away from zero — matches ``tax_calc._round``."""
    if value >= 0:
        return round(value + 1e-9, 2)
    return -round(-value + 1e-9, 2)
```

جێگرەوەی Decimal/ROUND_HALF_UP (کۆپی-پەیست):

```python
from decimal import Decimal, ROUND_HALF_UP

_CENT = Decimal("0.01")

def _round(value) -> float:
    """Round to 2 dp, HALF_UP, via Decimal. Returns float for the public API."""
    d = value if isinstance(value, Decimal) else Decimal(str(value or 0))
    return float(d.quantize(_CENT, rounding=ROUND_HALF_UP))
```

دواتر دوو دێڕی حسابکردن (ئێستا `withholding.py:275-276`) بگۆڕە بۆ Decimal:

```python
        gross_d = Decimal(str(gross))
        rate_d = Decimal(str(rate_pct))
        withheld = _round(gross_d * rate_d / Decimal("100"))
        net = _round(gross_d - Decimal(str(withheld)))
```

**بۆچی:** `round(value + 1e-9, 2)`ـی کۆن هەموو بەهایەک بەرەو سەرەوە پاڵ دەدات بۆ خۆلابوون لە banker's-rounding-ی Python؛ ئەمە لە tie-point نا-deterministic-ـە و audit-ـی reproducible سەرناخات. `Decimal.quantize(ROUND_HALF_UP)` tie-ـەکان بەرەو دوور لە سفر deterministic-ـانە round دەکات — کە ئەوەیە کۆمێنتی کۆد بانگەشەی دەکات بەڵام hack-ـەکە تەنها نزیکی دەکردەوە. (تێستە بوونیارەکانی `test_withholding.py` هێشتا سەوز دەمێننەوە — بڕواننە دۆکیومێنتی delta § 4.2.)

#### C.2) Fix 3 (بەردەوام): حسابی balance-ـی `invoice_payments`

ئێستا لە `backend/app/services/invoice_payments.py:13-17` (`float`، لە `<= 0` دادەخات):

```python
def _invoice_balance_after(inv: dict, amount: float) -> tuple[float, str]:
    current = float(inv.get("balance_due") or inv.get("total") or 0)
    new_balance = current - float(amount or 0)
    status = "paid" if new_balance <= 0 else "partially_paid"
    return max(0.0, new_balance), status
```

جێگرەوەی Decimal (کۆپی-پەیست):

```python
from decimal import Decimal, ROUND_HALF_UP

_CENT = Decimal("0.01")

def _money(value) -> Decimal:
    """Parse to Decimal via str() (never float()) and quantise to 2 dp, HALF_UP."""
    if isinstance(value, Decimal):
        d = value
    else:
        d = Decimal(str(value or 0))
    return d.quantize(_CENT, rounding=ROUND_HALF_UP)


def _invoice_balance_after(inv: dict, amount) -> tuple[float, str]:
    current = _money(inv.get("balance_due") if inv.get("balance_due") is not None else inv.get("total") or 0)
    new_balance = current - _money(amount)
    if new_balance <= _CENT:                       # <= 0.01 closes it (وەک AP side)
        return 0.0, "paid"
    status = "partially_paid"
    return float(new_balance), status
```

**تێبینی:** `Decimal(str(value))` بەکاربهێنە — هەرگیز `Decimal(float)` (binary float هەمان هەڵە هەڵدەگرێت کە دەیسڕینەوە). Firestore ژمارە وەک float هەڵدەگرێت، بۆیە return type لە boundary-دا `float` دەمێنێتەوە بەڵام هەموو arithmetic/comparison بە `Decimal`ـە. قاعیدەی داخستن لە `<= _CENT` لەگەڵ `bill_payments._bill_balance_after` یەکدەگرێتەوە (AR و AP وەک یەک هەڵس دەکەن؛ کۆد ئێستا لە `<= 0` دادەخات کە دەکرێت 0.004ـێک وەک "partially_paid" بۆ هەتاهەتایە بهێڵێتەوە). `apply_invoice_payment_atomic` و `create_payment_received_atomic` هەردووکیان بانگی `_invoice_balance_after` دەکەن، بۆیە دوای Decimal-کردنی helper، هەردووکیان rounding-ی ڕاست وەردەگرن بێ گۆڕانکاریی زیاتر.

#### C.3) Fix 1 + 2 — GL-on-confirm / GL-on-payment (pointer)

ئەمانە فایلی نوێ + wiring پێویستە، بۆیە لێرە تەنها ئاماژەیان پێ دەکەین (کۆدی تەواو لە `_deltas/P0-finance-correctness-IMPLEMENTATION.md` § 2–3):

- **Fix 1 (GL on confirm):** فایلی نوێ `app/services/invoice_gl.py` (`post_invoice_confirmation_je` + `reverse_invoice_je`، idempotent بە `uuid5` deterministic id + `gl_posted` guard). Wire لە `app/api/invoices.py` → `send_invoice` (پۆست)، `void_invoice`/`cancel_invoice` (reverse). builder-ـی `AccountingService.create_invoice_journal` پێشتر balanced lines دروست دەکات (Dr AR / Cr Revenue / Cr Tax 2140 / discount / shipping).
- **Fix 2 (GL on payment):** `create_payment_received_with_je_atomic` لە `invoice_payments.py` زیاد بکە (Dr Cash/Bank / Cr AR لە **هەمان transaction**ـی balance decrement، idempotent بە `uuid5("receipt-je:{payment_id}")`). نموونەی AP: `bill_payments.create_payment_made_with_je_atomic`.

> **هۆشداریی گرینگ:** هەموو ئەم چاکسازیانە **دەست لە پارە دەدەن**. دەبێت لەسەر **Windows** جێبەجێ بکرێن و بە `pytest`-ـی تەواوی backend پشتڕاست بکرێنەوە (sandbox-ـی Linux ناتوانێت backend ڕان بکات — venv-ـی Windows + بێ deps). تێستی property (Hypothesis) لە `test_accounting_integrity.py` بەهێزترین زەمانەتە کە debits==credits بۆ inputـی هەڕەمەکی. فەرمانی پشتڕاستکردنەوە:

```powershell
cd C:\Users\SAFA\zoho\backend
.\venv\Scripts\Activate.ps1
pytest -q
# فۆکەسی یەکەم:
pytest -q tests\test_withholding.py tests\test_atomic_money_paths.py `
          tests\test_accounting_integrity.py tests\test_accounting_balance.py
```

پاش جێبەجێکردن: boot-check (`python -c "import app.main"` + `/api/metrics`)، idempotency soak (هەمان confirm/payment دووجار → تەنها یەک JE)، و backfill-ـی مێژوویی (فاکتورا/پارەی پێش-فێکس بێ GL — بە ئیدێمپۆتانس، per-org/per-period، لە staging سەرەتا).
