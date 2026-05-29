# Deploy State — Live Tracker

> Fill in as you go. One row per step. This is for YOU to remember where you paused.
> ئەمە بۆ توە کە بزانیت لە کوێ ڕاوەستاویت.

**Started at:** _________________ (fill when you run step 01)
**GCP Project:** _________________
**Git commit at deploy:** _________________

---

## Steps

Status legend: ⏳ pending · 🔄 in-progress · ✅ done · ❌ failed · ⏭️ skipped

| Step | Status | Started (HH:MM) | Finished (HH:MM) | Duration | Notes / Errors |
|------|:------:|------|------|---------|----------------|
| 01 prereqs                 | ⏳ |   |   |   |   |
| 02 install + build         | ⏳ |   |   |   |   |
| 03 tests                   | ⏳ |   |   |   |   |
| 04 push to GitHub          | ⏳ |   |   |   |   |
| 05 GitHub Actions secrets  | ⏳ |   |   |   |   |
| 06a GCP one-time setup     | ⏳ |   |   |   |   |
| 06 Cloud Run deploy        | ⏳ |   |   |   |   |
| 07a Vercel project link    | ⏳ |   |   |   |   |
| 07 Vercel deploy           | ⏳ |   |   |   |   |
| 08 smoke test              | ⏳ |   |   |   |   |
| 09 post-deploy checklist   | ⏳ |   |   |   |   |

---

## URLs after deploy

- Backend (Cloud Run): _______________________
- Frontend (Vercel):   _______________________
- Sentry frontend:     _______________________
- Sentry backend:      _______________________

---

## If you paused

The resume command (replace N with the next pending step):
```powershell
cd C:\Users\SAFA\zoho\deploy
.\00-deploy-everything.ps1 -Project YOUR-GCP-PROJECT -FromStep N
```

## If something failed

Read the master log:
```powershell
Get-Content C:\Users\SAFA\zoho\deploy\logs\master-*.log -Tail 80
```

Find the per-step log named for the failing step (e.g. `cloudrun-deploy-*.log` for step 06).

---

## Post-deploy long-running checks (don't forget)

- [ ] Day +1: Sentry showing events from production
- [ ] Day +1: Cloud Run logs are clean
- [ ] Day +7: error rate < 0.5% over rolling window
- [ ] Day +28: RUM window full — check `scripts/rum-summary.mjs`
- [ ] Day +28: API SLO probe has 28 days of data — check V-PR.1 in scorecard
- [ ] Day +90: First backup restore drill
- [ ] Quarter +1: DR drill (24h offline POS sim)
