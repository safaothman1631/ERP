# 🚀 FINAL OPERATOR GUIDE — ناردنی سیستەمی ERP

> ئەمە تەنیا دۆکیومێنتە کە دەبێت بیخوێنیتەوە. هەموو شتێکی تر بۆ پاڵپشتییە.
> This is THE only document you need. Everything else is supporting reference.

---

## ⚡ سەرەتا (٣٠ چرکە)

PowerShell ISE یان PowerShell 7 بکەرەوە، ئەم سێ هێڵە بنووسە:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
cd C:\Users\SAFA\zoho\deploy
.\00-deploy-everything.ps1 -Project YOUR-GCP-PROJECT -RepoName zoho
```

**هیچ شتێکی تر ناوێت.** سکریپتەکە خۆی هەموو هەنگاوەکان جێبەجێ دەکات.
ئەگەر هەنگاوێک شکستی هێنا، پەیامێکی ڕوون نیشانت دەدات لەگەڵ فەرمانی resume.

---

## ✅ پێش ئەوەی دەستپێ بکەی — Checklist

ئەم خاڵانە یەک بە یەک پشکنە. هەر یەکێک هەستە، پێش کلیک کردن چارەسەری بکە.

- [ ] **GCP project دروستکراوە و billing ئەکتیڤە**
  بڕۆ [console.cloud.google.com](https://console.cloud.google.com/billing) — دەبێت billing account لینک بێت.

- [ ] **`gh` CLI لۆگین کراوە**
  تاقیکردنەوە: `gh auth status` — دەبێت `Logged in to github.com` ببینیت.

- [ ] **`gcloud` CLI لۆگین کراوە و project سێت کراوە**
  ```powershell
  gcloud auth login
  gcloud config set project YOUR-GCP-PROJECT
  gcloud auth configure-docker me-central1-docker.pkg.dev
  ```

- [ ] **`vercel` CLI لۆگین کراوە** (پێشتر کراوە — safaothman1631 ✓)
  تاقیکردنەوە: `vercel whoami`

- [ ] **Sentry account + 2 projects** (frontend + backend) DSN-ەکانیان ڕاگرتووە
  دەبێت دوو DSN لە بەردەستدا بێت — یەکێک بۆ frontend، یەکێک بۆ backend.

- [ ] **GitHub repo `safaothman1631/zoho` بوونی هەیە**
  ئەگەر نا: `gh repo create safaothman1631/zoho --private --source=. --remote=origin`

- [ ] **(پێشنیاری) ‍`deploy\.env.deploy` پڕکراوەتەوە پێش هەنگاوی ٥**
  copy لە `.env.example`، 16 secret تێدا دانێ. ئەگەر نەکرابێت، هەنگاوی ٥ یەک بە یەک لێت دەپرسێت.

---

## 🪜 هەنگاوەکانی deploy (~٤٥ خولەک تەواو)

| هەنگاو | ئەرک | ئەوەی تۆ دەینووسیت | کات |
|--------|------|---------------------|------|
| 01 | prereqs — پشکنینی ئامێرەکان | هیچ | 30 چ |
| 02 | npm install + Vite build + pip install | هیچ | 8 خ |
| 03 | تێستەکان (Vitest, Playwright, pytest) | ڕەنگە داوای Playwright install بکات یەک جار | 5 خ |
| 04 | git commit + push | پەسەندکردنی commit message | 1 خ |
| 05 | 16 GitHub Actions secrets | 16 بەها، یان `.env.deploy` پێشتر پڕکراوە | 5-10 خ |
| 06a | ڕێکخستنی GCP — یەک جار | پەسەندکردنی خەرجی (Redis ~$50/مانگ) | 5 خ |
| 06 | Cloud Run deploy | هیچ | 8 خ |
| 07a | لینکی Vercel — یەک جار | پەسەندکردنی scope | 1 خ |
| 07 | Vercel deploy | هیچ | 3 خ |
| 08 | smoke test لە production | هیچ | 2 خ |
| 09 | لیستی پاش-deploy | تیکی بۆکسەکان | 2 خ |
| **کۆ** | | | **~٤٥ خ** |

> 06a و 07a خۆکارانە تێپەڕێنرێن ئەگەر پێشتر تەواو کرابن (idempotent).

---

## 🔧 ئەگەر کێشە ڕووی دا

| نیشانە | فایلی پێویست بخوێنرێت | فەرمانی چارەسەر |
|--------|-----------------------|------------------|
| `01-prereqs` شکستی هێنا | `deploy\prereqs-report.txt` | ئامێرە وونبوەکان دامەزرێنە |
| `02-build` شکستی هێنا | کۆتایی `deploy\logs\build-*.log` | `cd frontend; npm install --legacy-peer-deps` |
| Playwright کێشە | `deploy\logs\tests-*.log` | `cd frontend; npx playwright install chromium` |
| `04-push` `gh auth` کێشە | — | `gh auth login` پاشان `-FromStep 4` |
| `06a` GCP IAM ڕەتکردەوە | `deploy\logs\gcp-setup-*.log` | پڕۆژەی GCP پێویستی بە Owner یان Editor هەیە |
| `06` Cloud Run شکست | `deploy\logs\cloudrun-deploy-*.log` | `gcloud auth configure-docker me-central1-docker.pkg.dev` |
| `07` Vercel شکست | `deploy\logs\vercel-deploy-*.log` | `-FromStep 8` بۆ ئەوەی 07a دووبارە بکات |
| `08` smoke شکست | URL لە `cloudrun-url.txt` و `vercel-url.txt` | Cloud Run console بپشکنە — خزمەتگوزاری error نییە؟ |

**resume command گشتی:**
```powershell
.\00-deploy-everything.ps1 -Project YOUR-GCP-PROJECT -FromStep N
```

**dry-run بۆ بینینی پلانەکە بێ جێبەجێکردن:**
```powershell
.\00-deploy-everything.ps1 -Project YOUR-GCP-PROJECT -DryRun
```

**تەنیا یەک قۆناغ:**
```powershell
.\00-deploy-everything.ps1 -Phase verify       # تەنیا 01
.\00-deploy-everything.ps1 -Phase build        # 02 + 03
.\00-deploy-everything.ps1 -Phase push         # 04 + 05
.\00-deploy-everything.ps1 -Phase deploy       # 06a + 06 + 07a + 07
.\00-deploy-everything.ps1 -Phase verify-prod  # 08 + 09
```

---

## ⏳ پاش deploy — ئەو شتانە کە کات-بەندە (Claude ناتوانێت بیکات)

ئەمانە پێویستیان بە کات-پەنجەرەی واقیعی هەیە. هیچ سکریپتێک ناتوانێت زوویان بکات.

| تاسک | پەنجەرە | پەیوەندیدار بە |
|------|---------|-----------------|
| RUM (Core Web Vitals) ٢٨ ڕۆژ کۆبکاتەوە | 28 ڕۆژ | V-PR.2 |
| API SLO (latency, errors) ٢٨ ڕۆژ | 28 ڕۆژ | V-PR.1, V-PR.11 |
| Backup verify (restore drill) | 90 ڕۆژ | V-PR.12 |
| Quarterly DR drill (full V-PR.4 24h offline POS) | هەر چارەکێک | V-PR.4 |
| Onboarding test (نوێ + ١ ڕۆژ) | هەر چارەکێک | V-LM.9 |
| 56 settings sections decomposition | ~٣٢ ڕۆژی کار | V-LM.1 |
| وەرگێڕانی عەرەبی | چەند هەفتە | V-LM.9 i18n |

---

## 📁 ئەو فایلانەی پاش deploy گرنگن

| فایل | بەکار |
|------|--------|
| `deploy\cloudrun-url.txt` | URL-ی backend (Cloud Run) |
| `deploy\vercel-url.txt` | URL-ی frontend (Vercel) |
| `deploy\gcp-resources-manifest.json` | لیستی هەموو ڕیسۆرسەکانی GCP |
| `deploy\vercel-link.json` | لینکی پڕۆژەی Vercel |
| `deploy\logs\master-*.log` | لۆگی تەواوی deploy |
| `deploy\STATE.md` | شوێنی ئێستات لە پایپلاینەکە — خۆت تیک بکە |

---

## 🆘 ئەگەر هەموو شتێک شکست هێنا

1. سکریپتەکە لۆگەکەی نیشانت دەدات (deploy\logs\master-*.log).
2. کۆتایی 50 هێڵ بخوێنە — هۆکارەکە لەوێیە.
3. ئەگەر هێشتا نازانیت: کۆتایی لۆگ + ناوی هەنگاوی شکست بنێرە بۆ Claude.

---

**یاداشتی کۆتایی:** ئەم سیستەمە بەدوای ئەمە دەگەڕێت کە "deploy کرابێت بێ ئەوەی کێشە ببینێت" — نەک "بێ کێشە بێت بۆ هەمیشە". پاش deploy، RUM و SLO پەنجەرەکان پێویستن بۆ بیسەلمێنیت کە بەرهەمهێنان world-class-ە. ئەو پەنجەرانە کاتیان لاسەنگە و ناتوانرێت زوویان بکرێت.
