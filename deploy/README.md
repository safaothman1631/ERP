# Deploy Kit - sistemi ERP kurdi

> rebari tewawi deploy kirdni sistem bo production.
> hemu scriptekan PowerShell 7+ nuusrawn u bo Windows amadan.

---

## peshpeshe (Prerequisites)

pesh dastpekirdn, em amerane daba damezraben:

| amer | kemtirin weshan | linki damezrandn |
|-------|----------------|-------------------|
| **Node.js** | 20.x | https://nodejs.org/ |
| **Python** | 3.11+ | https://www.python.org/downloads/ |
| **Git** | 2.40+ | https://git-scm.com/download/win |
| **GitHub CLI** (`gh`) | 2.40+ | https://cli.github.com/ |
| **Google Cloud SDK** (`gcloud`) | latest | https://cloud.google.com/sdk/docs/install |
| **Vercel CLI** (`vercel`) | latest | `npm i -g vercel` |
| **PowerShell** | 7.0+ | https://aka.ms/powershell |
| **Docker Desktop** (helbjardayi) | latest | https://docker.com/desktop |

### zaniari chuunajurewe (Login)

```powershell
gh auth login
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
vercel login
```

---

## chand katjmere (Timeline ~ 45 khulek)

| hangaw | kat | nawerok |
|--------|------|----------|
| 1. Prereqs | 2-3 khulek | pshknini amerakn |
| 2. Install & Build | 10-15 khulek | damezrandn + bnyatnan |
| 3. Tests | 8-12 khulek | testi tewaw |
| 4. Push to GitHub | 1-2 khulek | push kirdn |
| 5. Setup Secrets | 5 khulek | dani secretekn |
| **ko** | **~ 45 khulek** | |

---

## tumarkhanay Scriptekn

| nawi script | erki | kati pewist | peshina |
|--------------|--------|---------------|---------|
| `01-prereqs.ps1` | pshknini hamu amera pewistakn | 2 khulek | - |
| `02-install-and-build.ps1` | npm install + vite build + pip install | 10-15 khulek | 01 |
| `03-run-tests.ps1` | Vitest + Playwright + pytest | 8-12 khulek | 02 |
| `04-push-to-github.ps1` | git add + commit + push | 1-2 khulek | 03 |
| `05-setup-secrets.ps1` | dani hamu GitHub Actions secrets | 5 khulek | 04 |

---

## hangawekan (Step-by-step)

### hangawi 1 - pshknini amerekn

```powershell
cd C:\Users\SAFA\zoho
.\deploy\01-prereqs.ps1
```

**chi daket?** hamu amera pewistakn (node, python, gh, gcloud, vercel...) pshknin dakt u danosit le `deploy\prereqs-report.txt`.

**agar shkti henaa:** fayli `prereqs-report.txt` bkhwena u amera wnbukn damzrene.

---

### hangawi 2 - damezrandn u bnyatnan

```powershell
cd C:\Users\SAFA\zoho
.\deploy\02-install-and-build.ps1
```

**chi daket?**
- le `frontend/`: `npm install --legacy-peer-deps` + `npm run build`
- le `backend/`: `python -m venv venv` + `pip install -r requirements.txt`
- ziadkirdni `python-json-logger` (hotfix)

**Log:** `deploy\logs\build-<timestamp>.log`

---

### hangawi 3 - jebejekirdni testekn

```powershell
cd C:\Users\SAFA\zoho
.\deploy\03-run-tests.ps1
```

**chi daket?**
- Frontend: `vitest --run` + coverage
- Frontend: Playwright smoke tests (`nav:sweep`)
- Backend: `pytest --cov=app`
- Backend: import smoke test

**Log:** `deploy\logs\tests-<timestamp>.log`

---

### hangawi 4 - push bo GitHub

```powershell
cd C:\Users\SAFA\zoho
.\deploy\04-push-to-github.ps1 -RepoName "zoho" -Branch "main"
```

**chi daket?**
- pshknini working tree
- pshknini `origin` rast bet bo `github.com/safaothman1631/<RepoName>`
- `git add -A` + `git commit` + `git push`
- ratdaktwa agar `.env` yan fayli nheni staged bet

---

### hangawi 5 - dani Secrets

```powershell
cd C:\Users\SAFA\zoho
.\deploy\05-setup-secrets.ps1
```

**chi daket?** hamu GitHub Actions secretekn dadnet le `gh secret set` regay:
- `VITE_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`
- `CLOUDRUN_URL`, `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT`
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- `REDIS_URL`, `FIREBASE_PROJECT_ID`
- `LOAD_TEST_*`

**tebini:** behakan wek SecureString werdagiren (le terminal nanishan dadiren).

---

## agar keshe ruyi da (Troubleshooting)

### keshe bawekan

| keshe | charaseir |
|------|----------|
| `npm install` shkti dahenet | `--legacy-peer-deps` bekarbhena |
| `gcloud: command not found` | Google Cloud SDK damzrene u terminal duwbara bkrewa |
| `gh: not authenticated` | `gh auth login` jebejey bka |
| Permission denied bo scripts | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Python venv shkti dahenet | pshknin bka ke Python 3.11+ damezrawa |

---

## pash deploy chi bkam? (Post-deploy)

pash push kirdn u dani secretekn:

1. **GitHub Actions** bpshkne: https://github.com/safaothman1631/<RepoName>/actions
2. **Cloud Run** URL bhena:
   ```powershell
   gcloud run services describe backend --region me-central1 --format "value(status.url)"
   ```
3. **Vercel** projeyk bpshkne: https://vercel.com/dashboard
4. **Smoke test** bka le production: `curl https://<CLOUDRUN_URL>/health`

---

## pekhati deploy/

```
deploy/
├── README.md                    <- am fayla (master guide)
├── 01-prereqs.ps1               <- pshknini amerakn
├── 02-install-and-build.ps1     <- damezrandn + bnyatnan
├── 03-run-tests.ps1             <- jebejekirdni testekn
├── 04-push-to-github.ps1        <- push bo GitHub
├── 05-setup-secrets.ps1         <- dani secretekn
├── .env.example                 <- qaaibi env vars
├── .env.deploy                  <- (drustiy bka; .gitignore dakret)
├── prereqs-report.txt           <- raporti pshknin (auto-generated)
├── secrets-set-manifest.txt     <- listi secrete danrawakan
├── _DELIVERY-NOTES.md           <- tebini delivery
└── logs/                        <- log fayli hamu scriptekan
    ├── build-<timestamp>.log
    └── tests-<timestamp>.log
```

---

## asayash (Security)

- **hich kat** `.env` yan `.env.deploy` push maka bo GitHub.
- hamu scriptekan secretekan le logekan redact daken.
- `Read-Host -AsSecureString` bekardiret bo wargrtni nheni.
- `04-push-to-github.ps1` ratdaktwa agar fayli nheni staged bet.

---

## palpishti (Support)

- GitHub Issues: https://github.com/safaothman1631/zoho/issues
- barpirs: Safa Othman (safaothman1631)

---

**amada? bro bo hangawi 1**
