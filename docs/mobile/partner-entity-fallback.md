# Partner-Entity Fallback — Apple Developer Program

> Spec refs: requirements.md §R5.2 + §R5.16, design.md §5.10, tasks.md
> T-G.5.2, T-G.5.20.

This document outlines the contingency for Apple rejecting the Zoho
Kurdish ERP's Iraqi-entity Apple Developer Program enrollment, and the
recommended pivot to a partner LLC in Turkey or Jordan.

---

## 1. Why Apple may reject Iraqi entity enrollment

Apple has historically restricted Apple Developer Program enrollment from
Iraqi legal entities, citing:

1. **OFAC and US Treasury compliance complexity** — Iraq is not under
   broad sanctions but specific persons + entities are; Apple's
   automated compliance system errs conservative.
2. **Verification challenges** — Iraq lacks D&B DUNS coverage in most
   provinces; Apple requires a DUNS number for organizational enrollment.
3. **Payment processing** — Apple disburses to bank accounts in
   countries where it operates a local entity; Iraqi banking is not on
   that list as of 2026.

Historical signal: roughly 60–70% of Iraqi LLC applications are rejected
or stalled indefinitely (per Yemeni / Lebanese developer community
reports — closest comparable markets). Some succeed, but planning around
success is reckless.

---

## 2. Decision flow

```
       ┌─────────────────────────────────────────┐
       │ Submit Iraqi LLC + DUNS to Apple ADP   │
       └──────────────────┬──────────────────────┘
                          │
              ┌───────────┴──────────┐
              ▼                      ▼
         ACCEPTED                 STALLED ≥ 60 days
              │                      │ OR REJECTED
              │                      │
              ▼                      ▼
       Proceed normally     ┌────────────────────────────┐
                            │ Pivot to partner entity:   │
                            │  Turkey LLC (preferred)    │
                            │  Jordan LLC (alt)          │
                            └────────────┬───────────────┘
                                         │
                                         ▼
                         Submit partner entity's DUNS to Apple
                                         │
                            ┌────────────┴──────────────┐
                            ▼                            ▼
                       ACCEPTED                    REJECTED
                            │                            │
                            ▼                            ▼
                Hold app under partner    Final fallback: Apple ADP
                + rights assignment       under founder's personal
                + royalty agreement       Apple ID (individual tier)
```

---

## 3. Turkey LLC — preferred fallback

**Why Turkey?**
- 2-week LLC formation via online (e-tuzuk system) for foreigners.
- ~USD 1,500 total cost (incorporation + first-year accounting).
- D&B DUNS issuance reliable.
- Apple disburses to Turkish bank accounts (Garanti, Akbank, Yapı Kredi).
- Stronger legal infrastructure for IP transfer than Jordan.
- Active Iraqi business community in Istanbul (existing trust signals).

### Formation outline

| Step | Time | Cost (USD) | Owner |
|---|---|---|---|
| Engage local Istanbul lawyer | 1 day | $500 retainer | Founder |
| Reserve company name (MERSIS) | 1 day | $30 | Lawyer |
| Notarize founder docs | 2 days | $200 | Lawyer + founder |
| Register with Trade Registry | 3 days | $300 | Lawyer |
| Open business bank account | 5 days | $0 | Founder (in person, 1 visit) |
| Obtain DUNS via D&B Turkey | 5 days | $0 | Lawyer |
| Submit to Apple ADP | 1 day | $99 | Eng B |
| Apple verification | 7-14 days | — | Apple |
| **Total elapsed** | **~3 weeks** | **~$1,500** | |

### Recommended law firm tier

- Mid-tier (e.g. Pekin & Pekin, Esin Attorney Partnership) — $2k–$3k total
  but fastest + lowest risk.
- Budget local firm — $800–$1,000 but takes 5+ weeks; not recommended if
  launch timeline is tight.

---

## 4. Jordan LLC — alternative

**Why Jordan?**
- 3-week LLC formation via JEPA.
- ~USD 2,000 total cost.
- Stronger Arabic legal documentation (helpful for IP agreement language).
- Active diaspora ties to Iraqi business networks (Erbil-Amman flights daily).

**Why NOT Jordan first?**
- More expensive than Turkey.
- Slower D&B DUNS issuance (10-14 days vs 5).
- Jordanian dinar's USD peg makes cost predictable but Apple disbursement
  in JOD requires a manual annual FX adjustment.

---

## 5. Reseller / rights agreement template

When the partner entity holds the Apple Developer account, the Iraqi
parent company (operating entity) needs a written agreement assigning:

1. **All app rights** — including IP, trademarks, source code,
   user data ownership.
2. **Royalty obligations** — partner entity collects net Apple revenue
   (after Apple's 30% commission), keeps a service fee, remits the rest
   to the Iraqi parent.
3. **Transfer pricing compliance** — service fee should be at arm's
   length; recommend 3–5% of net revenue as a "distribution administration
   fee", with full Apple revenue otherwise flowing to the Iraqi parent.
4. **Termination clause** — parent can demand transfer of the Apple
   account to a new entity at any time on 30 days notice.

Template (outline only — engage a lawyer for the final draft):

```
SERVICE & RIGHTS AGREEMENT

This Agreement is between:
  ZOHO KURDISH ERP LTD ("Operator"), an Iraqi LLC
  and
  [Turkey Partner Entity Name] LTD ("Distributor"), a Turkish LLC

WHEREAS Operator owns the mobile application "Zoho Kurdish" (the "App")
and seeks distribution on the Apple App Store;
WHEREAS Apple Inc. has declined to enroll Operator in the Apple Developer
Program but has accepted Distributor's enrollment;

NOW THEREFORE the parties agree:

1. RIGHTS. Operator retains 100% ownership of the App, its source code,
   trademarks, customer data, and any derivative works. Distributor's
   role is limited to acting as the Apple Developer Program enrollee
   and bank-account recipient for App Store proceeds.

2. APP STORE PROCEEDS. Distributor shall remit 95% of net Apple App Store
   proceeds (defined as gross Apple payments minus Apple's commission)
   to Operator's nominated bank account within 7 banking days of receipt.
   Distributor retains 5% as a Distribution Administration Fee.

3. CONFIDENTIALITY. … standard NDA terms …

4. TRANSFER OF DEVELOPER ACCOUNT. Upon Operator's written request and
   on 30 days' notice, Distributor shall cooperate with Apple's account
   transfer process to migrate the App to an Operator-controlled Apple
   Developer Program account.

5. TERM. This Agreement is in effect for an initial 24 months,
   automatically renewing for additional 12-month periods unless either
   party provides 60 days' written notice.

6. GOVERNING LAW. This Agreement shall be governed by Turkish law,
   with disputes resolved in the courts of Istanbul.

7. SIGNATURES. …
```

---

## 6. Legal precedents

The following Iraqi / Yemeni / Lebanese apps reportedly use a partner-
entity fallback (public information; mention without endorsement):

- **Tarjama** (Yemen-origin, Turkey-published) — Arabic translation app.
- **Mathaqi** (Lebanon-origin, Jordan-published) — restaurant rating.
- Several Iraqi e-commerce apps under Turkish parent LLCs (founder
  community knowledge; not publicly confirmed).

There are no known regulatory or Apple-policy issues with this pattern
provided the rights assignment is clean and the partner entity does not
itself appear on sanctions lists.

---

## 7. Cost summary

| Path | One-time cost | Annual cost | Time to first IPA upload |
|---|---|---|---|
| Iraqi LLC (accepted) | $0 | $99 ADP fee | 2 weeks |
| Iraqi LLC (rejected) → Turkey LLC | $1,500 + $99 | $99 + $400 accounting | 5 weeks |
| Iraqi LLC (rejected) → Jordan LLC | $2,000 + $99 | $99 + $500 accounting | 6 weeks |
| Final fallback: founder personal Apple ID | $0 | $99 | 1 day BUT no "company" branding |

Recommendation: budget $1,500 + $400/yr for the Turkey LLC fallback,
treat it as insurance, and pivot at day 60 of Iraqi-LLC limbo.

---

## 8. Push fallback (related — FCM access risk)

Separately tracked, but mentioned in spec R5.16: if Iraqi networks ever
block FCM's edge endpoints (`fcm.googleapis.com`), the app falls back
to a WebSocket long-poll channel at `wss://api.zoho-kurdish.iq/push`.
The backend monitors per-tenant delivery success; the fallback is
auto-enabled at the tenant level when delivery drops below 80%.

That mitigation is implemented in `backend/app/services/push_notifications.py`
+ a future `backend/app/api/ws_push.py` (Phase post-G5).
