# Engineering Onboarding — 30 / 60 / 90 Day Plan

> **Spec ref:** `.kiro/specs/scale-foundation` — T-SF.1.3, T-SF.1.6; design.md §1.8.
> **Owner:** Hiring manager (Founder until Ops/SRE transfer).
> **Purpose:** Take a new engineer from "fresh clone" to "primary on-call and
> shipping P0 fixes" in 90 days — and make the founder replaceable for a
> two-week absence (Assumption A1).

This is a **real, checkable plan**, not a vibe. Each phase has explicit exit
criteria. At day 30, 60, and 90 there is a check-in; if a check fails we decide
**explicitly**: extend, reassign, or part ways (design.md §1.8). A failed check
is information, not a verdict — but we don't let it slide silently.

Read [`engineering-handbook.md`](./engineering-handbook.md) end-to-end in week
one; it is the map for everything below.

---

## Before Day 1 (hiring manager checklist)

The new hire should be unblocked on arrival. Owner: hiring manager.

- [ ] GitHub access to the monorepo; added to the right team.
- [ ] Google Workspace account; added to relevant groups.
- [ ] **Not** added to `gcp-admins@` yet (production access comes after the
      day-30 security walkthrough — least privilege, ch. 4 of the handbook).
- [ ] Slack: `#eng`, `#incident`, `#ops`, `#releases`.
- [ ] PagerDuty account created, **muted** (they join the rotation at day 61,
      not before — `docs/oncall/rotation.md`).
- [ ] A buddy assigned (an existing engineer for "stupid questions").
- [ ] First-week calendar seeded: handbook reading block, product tour, two
      customer-call shadows, daily buddy 15-min.
- [ ] Laptop can run the stack locally (see "Local setup" below).

---

## Local setup (Day 1, with the buddy)

Goal: see the app run on the new machine by end of Day 1.

1. Clone the monorepo. Read `CLAUDE.md` and the handbook ch. 1 (repo layout).
2. **Backend:**
   - Python venv lives at `backend/venv/`; interpreter is
     `backend/venv/Scripts/python.exe` on Windows.
   - `pip install -r backend/requirements.txt`.
   - Copy `backend/.env.example` → `backend/.env`. Dev defaults are insecure on
     purpose; `validate_env()` will *warn* locally (it only hard-fails when
     `ENVIRONMENT=production`).
   - Run the app; confirm `GET /api/live` returns `{"status":"alive"}` and
     `GET /api/docs` renders the OpenAPI UI.
3. **Frontend:**
   - `cd frontend && npm install --legacy-peer-deps` (the `--legacy-peer-deps`
     flag is mandatory — ADR-0020).
   - `npm run dev`; log in against the local/staging backend.
4. **Tests:** run `pytest` for one backend suite (e.g.
   `backend/tests/quick_create/`) and the frontend typecheck. Green tests on
   day one means the environment is real.

If anything here is wrong, **fix the doc in your first PR** — onboarding friction
is a bug.

---

## Days 1–30 — Learn the product and the codebase

**Theme:** absorb context, make small safe changes, build a mental model of the
data flow.

### Activities

- **Product tour.** Click through every Wave-A module as a real tenant:
  invoices, quotes, bills, POS, accounting, inventory, projects. Create an
  invoice end-to-end; refund a POS sale; run a report.
- **Shadow 2 customer calls.** Our customers are Iraqi SMBs on intermittent
  connectivity — feel the offline-POS and Kurdish/Arabic-RTL reality firsthand.
- **Read all ADRs** in `docs/adr/` (there are 20 + the earlier ones). These
  explain *why* the system is shaped the way it is — Firestore over Postgres,
  JWT auth, `org_id` multi-tenancy, the payment-gateway abstraction, IQD with no
  decimals, the 90-day trial, etc.
- **Trace one request end-to-end.** Pick `POST /api/invoices`. Follow it:
  `main.py` middleware stack → `api/invoices.py` (`require_module`, totals calc)
  → `firestore/invoices.py` → `firestore/base.py` (`create`, versioning,
  caching). Write up what you learned as a comment on an issue.
- **Pair** with the buddy on at least two of their PRs (as reviewer).

### Ship

- [ ] Open **3 well-scoped issues** from things you noticed (a stale doc, a
      missing test, a confusing UX, a small bug). Quality over quantity.
- [ ] **Fix 1** of them and merge it (CI green, one approval). Your first PR
      should be small and boring — a doc fix or a test is perfect.

### Day-30 check-in (exit criteria)

- [ ] Can explain the **3-layer multi-tenancy** model (JWT `org_id` → repository
      scoping → Firestore rules) without notes (handbook ch. 12).
- [ ] Can name the deploy path for all three artifacts (Cloud Run, Vercel,
      Firestore rules) and the **two-project split** (`zoho-83cda` data vs the
      compute project).
- [ ] 1 PR merged; 3 issues filed.
- [ ] **Security walkthrough completed** with the hiring manager: secret access,
      customer-data access / break-glass, impersonation read-only rule. *Only
      after this* are they considered for `gcp-admins@` (and only if their role
      needs it).

> Founder-bus-factor note: by day 30 a second person can describe how a customer
> request becomes a tenant-scoped Firestore write. That alone reduces the bus
> factor.

---

## Days 31–60 — Own a module, ship real work, learn ops

**Theme:** depth. Take real ownership of a slice of the product and start
learning how we keep it running.

### Activities

- **Own 1 module end-to-end.** Pick a Wave-A module (e.g. expenses, quotes, or a
  POS surface). You are now the default reviewer and first responder for it.
  Read its router, repository, schemas, and frontend page.
- **Run 1 deploy** to production (pair with on-call the first time). Use
  `docs/runbooks/deploy.md`. Watch the new revision smoke-check before traffic
  shifts; know how you'd roll it back (`docs/runbooks/rollback.md`).
- **Shadow on-call for a full week.** Sit on the bridge for any incident; read
  the runbook the responder uses; note where it's wrong.
- **Learn the observability surface:** Sentry, Cloud Monitoring dashboards,
  `GET /api/metrics/routes`, `GET /api/jobs` (APScheduler run history), and how
  `X-Request-Id` correlates logs.

### Ship

- [ ] Land **at least 2 non-trivial PRs** in your module (a feature or a real
      bug fix, with tests).
- [ ] **Write 1 runbook** (or substantially improve one) for a scenario in your
      area, with the YAML front-matter (`title`, `severity`, `owner`,
      `last_drilled`) — see `docs/runbooks/` for the format.
- [ ] Add a composite index + the matching query at least once, so you've felt
      the `audit-firestore-queries.py` CI gate.

### Day-60 check-in (exit criteria)

- [ ] Ran 1 production deploy and can describe rollback from memory.
- [ ] Owns a module: can answer "how does X work?" for it without reading along.
- [ ] 1 runbook authored/improved and merged.
- [ ] Shadowed at least one real incident (or a drill if it was a quiet two
      weeks).

---

## Days 61–90 — Carry the pager, lead, and decide

**Theme:** autonomy. The new hire now operates the system and contributes to its
direction.

### Activities

- **Primary on-call for 1 week.** PagerDuty unmuted; you're Layer 0
  (`docs/oncall/escalation-policy.md`). The secondary and founder are behind
  you; let escalation happen if you're stuck — that's the system working.
- **Lead 1 customer call.** Not just shadow — run it. Translate a customer pain
  into an issue or an ADR.
- **Run 1 runbook drill.** Pick a runbook (yours or another), execute it against
  staging, time each step, file gaps (T-SF.1.15 cadence: one drill per runbook
  over the quarter).

### Ship

- [ ] **Ship 1 P0/P1 fix** (or a high-impact feature) under realistic time
      pressure.
- [ ] **Contribute 1 ADR** — a real decision you made or want to make, in the
      Michael Nygard format (`docs/adr/0000-template.md` style, but note the repo
      uses the table-header variant for ADRs 0001+).

### Day-90 check-in (exit criteria — the bar)

- [ ] Completed a primary on-call week with no unhandled escalations they should
      have caught.
- [ ] Led 1 customer call; shipped 1 P0/P1 fix; contributed 1 ADR.
- [ ] Could **cover a one-week on-call for the founder** without supervision.

> If any of these fail, the hiring manager decides explicitly within a week:
> extend the ramp with a concrete plan, reassign scope, or part ways. Silence is
> not an option (design.md §1.8).

---

## Role-specific tracks

The 30/60/90 above is the common spine. Layer these on top.

### Senior Frontend / Full-Stack (T-SF.1.3)

- Deep-dive `frontend/src/App.routes.tsx` (`lazyWithRetry` code-splitting),
  `layouts/AppShell.tsx`, the design system, and the Zustand POS stores
  (`posCart`/`posSession`/`posOffline`) — POS is offline-first on IndexedDB.
- Module ownership should be a **frontend-heavy** Wave-A module.
- Day-60 deploy can be a frontend (Vercel) deploy; day-90 P0 fix should touch
  the API too (full-stack).

### Ops / SRE (T-SF.1.6)

- **This hire takes runbook ownership and GCP admin from the founder.** Exit at
  the end of the ramp: runs 1 deploy + 1 incident drill solo, owns the
  escalation policy and the weekly IAM audit
  (`scripts/ops/iam-leaver-audit.py`).
- Day 1–30: get added to `gcp-admins@` (this role needs it), learn both cloud
  projects, read `DISASTER_RECOVERY.md` cover to cover.
- Day 31–60: own the alert policies and dashboards; run the DR PITR drill on
  staging (`DISASTER_RECOVERY.md` §8).
- Day 61–90: be the primary pager for two consecutive weeks; take over the
  monthly ADR review and doc-hygiene Friday.

---

## What "done onboarding" means

A fully ramped engineer:

1. Ships to their module without hand-holding.
2. Carries the pager and runs an incident from the runbook.
3. Has contributed to the institutional memory (a runbook, an ADR, doc fixes).
4. **Reduces the founder bus factor** — the whole point of the SF1 stream.

---

*Last reviewed: 2026-05-29. Owner: Hiring manager. Update this plan whenever the
stack, the on-call model, or the exit bar changes.*
