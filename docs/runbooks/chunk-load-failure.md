# Runbook — Chunk-load failure spike

> **Owner:** FE on-call
> **Trigger:** Sentry "ChunkLoadError" group exceeds 50 events / 5 min,
> **or** Cloud Logging filter `severity=ERROR jsonPayload.message:"ChunkLoadError"` exceeds 100 events / 5 min.

A "chunk-load failure" means the browser asked for a code-split JS chunk
(e.g. `assets/POSTerminal-abc123.js`) and the request 404'd, 502'd, or
hash-mismatched. The user sees a white screen or a `try again` dialog
from our retry shell (R3.5).

## 1. First-30-seconds triage

1. Open the [Sentry dashboard for the alert](https://sentry.io/organizations/zoho-kurdish/issues/?query=ChunkLoadError).
2. Note the **app version(s)** in the affected events. If they are all
   pinned to one version, this is a release problem; jump to §3.
3. Note the **routes** in the breadcrumbs. If all complaints are
   `/pos` or all `/settings/*`, this is a single-chunk problem; jump to §4.

## 2. Are we mid-deploy?

```bash
gcloud run revisions list --service=zoho-erp \
  --region=me-central1 --project=erp-system-494716 \
  --limit=5 --format='table(name, deploymentTime, active)'
```

If a deploy completed in the last 10 minutes **and** Vercel deployed in
the last 10 minutes, the cause is almost certainly **asset version
skew** — users have an old `index.html` cached at the edge that
references chunks the new deploy already evicted.

**Action:**
* Purge the Vercel edge cache for `/` and `/index.html` only:
  ```bash
  vercel env pull
  # In the Vercel dashboard: Project → Settings → Domains → Purge cache for index.html
  ```
* Wait 60 seconds; the next user load picks up the new HTML, which references the new chunks.

## 3. Bad release — roll forward or roll back?

If the spike is concentrated on a single new release:

```bash
# Roll back Cloud Run (backend served the bad index.html if Vercel rewrites are on)
gcloud run services update-traffic zoho-erp \
  --region me-central1 --project erp-system-494716 \
  --to-revisions=PREVIOUS_REV=100

# Roll back Vercel
vercel rollback <deployment-url>
```

If the release contains a critical security fix and rolling back is
unacceptable, **force-update** the affected users:

* Push a Vercel deployment whose `index.html` references a new SW
  version (`?v=` cache-bust the SW URL in `index.html`). The SW
  registration logic in `frontend/src/sw/register.ts` reads the version
  and calls `skipWaiting()` on mismatch.

## 4. CDN single-chunk gone

The chunk has been pushed but is missing on the edge POP that serves
some users. Causes seen in production:

* A truncated upload from `vercel build` — incredibly rare; happens after a Vercel internal incident.
* `Cache-Control: immutable` masking a corrupted edge object.

**Action:**

* Hit the chunk URL directly from a curl with `--resolve` against multiple POPs:
  ```bash
  for pop in fra1 cdg1 sfo1; do
    curl -sI "https://${pop}.vercel.app/assets/POSTerminal-abc123.js"
  done
  ```
* If one POP is 404, file a Vercel support ticket with the URL + POP.
* As a workaround, push a small change (whitespace) to bust the chunk hash and force a re-publish.

## 5. Service worker stuck on an old shell

The SW (Workbox) precaches the previous app shell, including the now-stale `index.html`. On the next deploy, the SW serves the cached `index.html` which references chunks that have been replaced.

**Action (one-time per user):**
* Our app-shell registration in `frontend/src/sw/register.ts` is configured with `skipWaiting + clientsClaim`. The user must reload **twice** to clear the cached shell.
* If a user reports the error in support, send them:
  > "Open the page, press Ctrl/Cmd + Shift + R twice. If it still fails, go to Settings → Privacy → Clear site data for `erp.zoho.kurd.iq`."

**Action (systemic, if a single deploy left many users stranded):**
* Ship a SW version bump (`SW_VERSION` constant in `frontend/src/sw/index.ts`). Next visit invalidates the cache.

## 6. Confirm green

* Sentry `ChunkLoadError` group new-event rate returns to baseline (< 5 / 5 min).
* RUM dashboard for `error_rate{event:chunkLoad}` returns below the 0.5% threshold.
* No new tickets in support's `pos-broken` board for 30 minutes.

## 7. Post-incident

* File a note in `audit/incidents/YYYY-MM-DD-chunk-load.md` with: trigger, scope, action, root cause, follow-up.
* If the trigger was a deploy race, add a regression test to `frontend/tests/deploy-race.test.ts` — assert that `index.html` and the chunks it references have matching version metadata.
