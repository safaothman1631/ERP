# Runbook — Core Web Vitals regression

> **Owner:** FE on-call
> **Trigger:** Cloud Monitoring alert
> `rum.lcp.p75 > 2500` for 30 min,
> or `rum.inp.p75 > 200`,
> or `rum.cls.p75 > 0.1`.
>
> Thresholds match the web.dev "good" CWV definition.

A CWV regression is typically (in order of likelihood):

1. A new third-party script was added.
2. A new lazy-loading boundary moved, increasing main-thread work on a hot route.
3. A new image/asset was shipped without optimization.
4. A new font face was added without `font-display: swap`.
5. The Vercel edge POP serving a region is degraded.

## 1. Identify the metric, route, region, device class

The RUM dashboard ("CWV by route × device × region") is the first stop.
Open it and slice:

* **Which metric?** — LCP, INP, CLS, TTFB, FCP.
* **Which route?** — `/`, `/pos`, `/invoices`, `/dashboard` are the four most often broken.
* **Which device class?** — `mobile-low` regressions are tolerable up to a point; `desktop` regressions usually mean a shipped JS bug.
* **Which network class?** — `slow-2g`/`2g` are noisy; do not panic unless `4g`+`wifi` also regressed.

If the regression is concentrated on **one network class only**, it's likely a CDN/edge regression — jump to §5. Otherwise it's a code regression — §2-§4.

## 2. LCP regression

Likely causes:

* Hero image not lazily loaded or not in modern format.
* Critical CSS not inlined.
* A new font is render-blocking (FOIT).
* A redirect was added at the edge that adds a hop.

Investigation:

```bash
# Find the largest contentful elements reported in RUM
gcloud logging read \
  'jsonPayload.metric="LCP"
   jsonPayload.value > 2500
   timestamp > "$(date -u -d '1 hour ago' +%FT%TZ)"' \
  --format='value(jsonPayload.route, jsonPayload.lcp_element)' \
  --limit 50
```

* If `lcp_element` is consistently an `<img>`, the image was not lazy or not the right size. Run Lighthouse against the route and fix.
* If `lcp_element` is `<h1>` or text, render-blocking JS or CSS is the cause. Diff `dist/` between the last good build and the current; look for new entries.

## 3. INP regression (Interaction to Next Paint)

Likely causes:

* A new useEffect that does a sync expensive computation.
* A virtualized list that lost its `keyExtractor` and re-renders the whole window.
* A new global keypress listener firing on every key.

```bash
gcloud logging read \
  'jsonPayload.metric="INP"
   jsonPayload.value > 200
   timestamp > "$(date -u -d '1 hour ago' +%FT%TZ)"' \
  --format='value(jsonPayload.route, jsonPayload.event_type, jsonPayload.long_task_ms)'
```

`event_type=click` regressions on `/pos` are urgent — they directly affect the cashier's per-sale throughput.

Fix path: long-task profile in Chrome DevTools → "Performance" tab → record an INP-bad interaction → find the > 50ms task. Almost always React reconciliation or a serialized JSON parse.

## 4. CLS regression

Likely causes:

* A new component without size attributes (image, ad slot, dynamic banner).
* A late-arriving font swapping in.
* A modal mounted by a fetch that re-flowed the page.

Look for elements with high `cls_delta` in RUM. Add explicit `width` + `height` (or `aspect-ratio`) and the regression evaporates.

## 5. CDN / edge regression

If RUM shows the metric is fine for users on `country=US/EU` but bad for `country=IQ` and similar, the cause is regional:

* Vercel status: https://www.vercel-status.com/
* Run an edge probe from Iraq via WebPageTest with a Baghdad Pixel 6 vTest agent. Compare TTFB to the historical median.

Mitigation: nothing on our side except wait. Document in the incident note.

## 6. Diff the last 10 deploys

```bash
git log --oneline -10 frontend/
```

If a deploy timestamp aligns with the regression start, that's the
prime suspect. Revert it on a branch, ship a preview deploy via Vercel,
have the FE on-call lighthouse it locally with Network: Slow 4G and
CPU: 4x slowdown.

## 7. Roll back

```bash
vercel rollback <prev-deployment-url>
```

Vercel rollback is instant (90 s) and reversible. Use it freely if the
CWV regression is user-impacting.

## 8. Confirm green

* RUM p75 returns below thresholds within 30 minutes.
* No new CWV alerts in 1 hour.
* Lighthouse CI in CI reports back to green budgets.

## 9. Post-incident

* `audit/incidents/YYYY-MM-DD-cwv-<metric>.md`.
* If the regression made it past CI, the Lighthouse CI budget is too lenient — open an issue to tighten the relevant assertion in `lhci.config.cjs`.
