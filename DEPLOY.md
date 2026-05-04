# 🚀 Deploy Zoho ERP بۆ `erpiq.systems`

> Stack: **Google Cloud Run** (free tier) + **Firestore** (Spark) + **name.com DNS**
> کۆی نرخ: **$0/مانگ** بۆ ERP بچووک–ناوەند

---

## 📋 پێش دەستپێکردن

ئەم فایلانە ئامادە کراون لە repo:
- [Dockerfile](Dockerfile) — multi-stage (frontend build + backend runtime)
- [.dockerignore](.dockerignore) + [.gcloudignore](.gcloudignore)
- [.github/workflows/deploy-cloudrun.yml](.github/workflows/deploy-cloudrun.yml) — auto-deploy
- `firebase_client.py` چاککراوە بۆ ADC (بێ JSON file لە Cloud Run)

---

## 🅰️ هەنگاو ١ — `gcloud` CLI دامەزرێنە (یەک جار)

```powershell
# Install (Windows)
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:TEMP\gcloud.exe")
& "$env:TEMP\gcloud.exe"

# Login
gcloud auth login
gcloud auth application-default login
```

---

## 🅱️ هەنگاو ٢ — GCP Project ئامادە بکە

```powershell
# گۆڕە PROJECT_ID بۆ ID ـی پڕۆجێکتی Firestore ـت
$env:PROJECT = "your-firebase-project-id"

gcloud config set project $env:PROJECT

# APIs چالاک بکە (یەک جار)
gcloud services enable `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    artifactregistry.googleapis.com `
    firestore.googleapis.com `
    secretmanager.googleapis.com
```

---

## 🆎 هەنگاو ٣ — Secret دروست بکە بۆ JWT

```powershell
# random 64-char secret
$secret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$secret | gcloud secrets create zoho-secret-key --data-file=-

# Cloud Run service account ـی default ڕێگا بدە بیخوێنێتەوە
$projectNumber = gcloud projects describe $env:PROJECT --format="value(projectNumber)"
gcloud secrets add-iam-policy-binding zoho-secret-key `
    --member="serviceAccount:$projectNumber-compute@developer.gserviceaccount.com" `
    --role="roles/secretmanager.secretAccessor"
```

---

## 🆑 هەنگاو ٤ — یەکەم deploy (manual)

```powershell
cd c:\Users\SAFA\zoho

gcloud run deploy zoho-erp `
    --source . `
    --region me-central1 `
    --allow-unauthenticated `
    --memory 1Gi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 3 `
    --timeout 300 `
    --set-env-vars "ENVIRONMENT=production,CORS_ORIGINS=https://erpiq.systems,https://www.erpiq.systems" `
    --set-secrets "SECRET_KEY=zoho-secret-key:latest"
```

پاش ١٠–١٥ خولەک URL ـێکی وەک ئەمە وەرگرە:
```
https://zoho-erp-xxxxx-uc.a.run.app
```
بیکەوە لە browser → دەبێت کاربکات. ✅

---

## 🆔 هەنگاو ٥ — Firestore IAM (یەک جار)

Cloud Run service account پێویستە دەسترەسی Firestore هەبێت:

```powershell
gcloud projects add-iam-policy-binding $env:PROJECT `
    --member="serviceAccount:$projectNumber-compute@developer.gserviceaccount.com" `
    --role="roles/datastore.user"
```

---

## 🌐 هەنگاو ٦ — Domain mapping (`erpiq.systems`)

### 6.1 Domain verify بکە
```powershell
gcloud domains verify erpiq.systems
```
ئەمە browser دەکاتەوە بۆ Google Search Console. TXT record پێت دەدات کە دایبنێیت لە **name.com → Manage DNS Records**:

| Type | Host | Answer | TTL |
|------|------|--------|-----|
| TXT | @ | `google-site-verification=...` | 300 |

پاش 5–10 خولەک، لە Search Console کلیک "Verify".

### 6.2 Domain mapping دروست بکە
```powershell
gcloud beta run domain-mappings create `
    --service zoho-erp `
    --domain erpiq.systems `
    --region me-central1

gcloud beta run domain-mappings create `
    --service zoho-erp `
    --domain www.erpiq.systems `
    --region me-central1
```

GCP پێت دەڵێت کام records دابنێیت. نموونە:

**name.com → Manage DNS Records:**

| Type | Host | Answer | TTL |
|------|------|--------|-----|
| A | @ | `216.239.32.21` | 300 |
| A | @ | `216.239.34.21` | 300 |
| A | @ | `216.239.36.21` | 300 |
| A | @ | `216.239.38.21` | 300 |
| AAAA | @ | `2001:4860:4802:32::15` | 300 |
| AAAA | @ | `2001:4860:4802:34::15` | 300 |
| AAAA | @ | `2001:4860:4802:36::15` | 300 |
| AAAA | @ | `2001:4860:4802:38::15` | 300 |
| CNAME | www | `ghs.googlehosted.com.` | 300 |

> ⚠ records ـە ڕاستەقینەکان لە output ـی gcloud وەربگرە (دەکرێت گۆڕابن).

پاش ١٠–٣٠ خولەک:
- HTTPS ئۆتۆماتیک چالاک دەبێت (Google managed cert).
- `https://erpiq.systems` کاردەکات. 🎉

---

## 🤖 هەنگاو ٧ — GitHub Actions auto-deploy

### 7.1 Service account بۆ GitHub
```powershell
gcloud iam service-accounts create github-deployer `
    --display-name "GitHub Actions Deployer"

$sa = "github-deployer@$env:PROJECT.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $env:PROJECT --member "serviceAccount:$sa" --role "roles/run.admin"
gcloud projects add-iam-policy-binding $env:PROJECT --member "serviceAccount:$sa" --role "roles/cloudbuild.builds.editor"
gcloud projects add-iam-policy-binding $env:PROJECT --member "serviceAccount:$sa" --role "roles/artifactregistry.admin"
gcloud projects add-iam-policy-binding $env:PROJECT --member "serviceAccount:$sa" --role "roles/iam.serviceAccountUser"
gcloud projects add-iam-policy-binding $env:PROJECT --member "serviceAccount:$sa" --role "roles/storage.admin"
```

### 7.2 سادەترین ڕێگا — JSON key
```powershell
gcloud iam service-accounts keys create gha-key.json --iam-account $sa
Get-Content gha-key.json | Set-Clipboard
```

پاشان لە GitHub repo:
- Settings → Secrets and variables → Actions → **New secret**
- `GCP_PROJECT_ID` = your project id
- `GCP_SA_KEY` = (paste JSON ـەکە)

دواتر `.github/workflows/deploy-cloudrun.yml` چاکبکە (Option B uncomment، Option A comment).

ئێستا هەر `git push` بۆ `main` خۆکار deploy دەکات. ✨

---

## 🔐 هەنگاو ٨ — Hardening (پێش ئەوەی production کاربەر هەبێت)

### Demo password بگۆڕە
```powershell
# لە Firestore Console، collection: users → demo@zohoerp.example.com
# password_hash نوێ بکەوە یان user ـەکە بسڕەوە و یەکی نوێ دروست بکە
```

### Firestore Security Rules
لە Firestore Console → Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // هەموو read/write لە backend ـەوە دەچێت (admin SDK rules تێپەڕ دەکات)
    // بەڵام بۆ زیادە سەلامەتی، client direct access ـی Firestore ببەستە:
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Backups (هەفتانە)
```powershell
# GCS bucket
gcloud storage buckets create gs://erpiq-backups --location=me-central1

# Manual export
gcloud firestore export gs://erpiq-backups/$(Get-Date -Format yyyy-MM-dd)

# Schedule weekly (Cloud Scheduler — free tier 3 jobs)
gcloud scheduler jobs create http firestore-backup `
    --location me-central1 `
    --schedule "0 2 * * 0" `
    --uri "https://firestore.googleapis.com/v1/projects/$env:PROJECT/databases/(default):exportDocuments" `
    --http-method POST `
    --message-body "{\"outputUriPrefix\":\"gs://erpiq-backups/scheduled\"}" `
    --oauth-service-account-email "$projectNumber-compute@developer.gserviceaccount.com"
```

### Monitoring
- https://uptimerobot.com — free 50 monitors
  - URL: `https://erpiq.systems/api/ready`
  - Interval: 5 min

---

## 🧪 Local docker test (پێش push)

```powershell
cd c:\Users\SAFA\zoho

docker build -t zoho-erp .
docker run --rm -p 8080:8080 `
    -e ENVIRONMENT=production `
    -e CORS_ORIGINS="http://localhost:8080" `
    -e SECRET_KEY="local-test-secret-1234567890" `
    -v "${PWD}\backend\serviceAccountKey.json:/app/backend/serviceAccountKey.json:ro" `
    zoho-erp

# Test
curl http://localhost:8080/api/ready
```

---

## 📊 Free tier limits (واقیعی)

| Resource | Free | بۆ تۆ بەسە؟ |
|----------|------|-------------|
| Cloud Run requests | 2M/مانگ | ✅ |
| Cloud Run CPU-sec | 180k | ✅ |
| Firestore storage | 1 GiB | ✅ |
| Firestore reads | 50k/ڕۆژ | ✅ ~10–20 active user |
| Firestore writes | 20k/ڕۆژ | ✅ |
| Egress NA | 1 GB/مانگ | ⚠ زۆر کاربەر = $0.12/GB |

ئەگەر تێپەڕی: نرخ زۆر کەمە (~$2–10/مانگ بۆ 100 active user).

---

## 🆘 Troubleshooting

| کێشە | چارەسەر |
|------|---------|
| `Permission denied on Firestore` | هەنگاو ٥ کۆپی بکە — IAM role |
| `Domain mapping pending` | DNS هێشتا propagate نەبووە — ٣٠ خولەک چاوەڕێ بکە |
| `502 Bad Gateway` | logs پشکنە: `gcloud run services logs read zoho-erp --region me-central1` |
| `CORS error` | `CORS_ORIGINS` env var پشکنە — comma-separated بێ space |
| `serviceAccountKey not found` لە local | فایلەکە دانە لە `backend/serviceAccountKey.json` |

---

## 📞 پشتیوانی

- Cloud Run docs: https://cloud.google.com/run/docs
- Firestore: https://firebase.google.com/docs/firestore
- name.com DNS: https://www.name.com/support/articles/115004095707
