<!--
Daily check-in log. One file per call: pilots/<PILOT-CODE>/log/YYYY-MM-DD.md
Protocol: design.md §6.3. Filed by the caller of the day (T-SF.6.9).
Keep it fast — this should take < 5 minutes to fill right after the 10-min call.
PRIVACY: first name + role only. No phone numbers, no national IDs, no customer PII.
-->

# Daily check-in — `<PILOT-CODE>` — YYYY-MM-DD

- **Pilot day #:** _<1–30>_
- **Caller:** _<Founder / Support Lead — first name>_
- **Reached:** _<Yes / No — if No, note attempt + reschedule and stop here>_
- **Call length:** _<minutes>_
- **Pre-call dashboard scan:** _<RUM + error rate + crash signal for this org_id — one line, e.g. "no errors, INP good, 0 crashes">_

## The 4 standard questions

**1. Anything BROKEN today?** (errors, crashes, wrong data, wrong money)
> _<answer, verbatim where useful>_

**2. Anything SLOW today?** (waited, spinner, lag, sync delay)
> _<answer>_

**3. Anything CONFUSING today?** (couldn't find it, didn't understand it)
> _<answer>_

**4. Anything you WISH it did?** (wishlist)
> _<answer>_

## Operational pulse

- **Transactions today (approx):** _<n>_  (target ≥ 50/day)
- **Used the system today?** _<Yes / No>_  (rolls into DAU ≥ 80% of operating days)
- **Power cuts / offline episodes:** _<n, duration, did offline POS hold?>_
- **Printer / hardware issues:** _<none / describe>_

## Tickets opened from this call

| Ticket / ref | Severity (P0–P3) | One-line summary | Edge-case? (link to iraq-edge-cases.md) |
|--------------|:----------------:|------------------|------------------------------------------|
| | | | |

## Wins / quotable moments

> _<anything that could become a case-study "win" — time saved, error avoided, a happy quote. Mark if the owner is OK being quoted.>_

## Carry-overs for Monday review

- _<items the founder/eng should see at the weekly Pilot Review>_
