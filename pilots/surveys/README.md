# Pilot Surveys — NPS + CSAT instruments (T-SF.6.12)

> Spec: scale-foundation SF6, design.md §6.6.
> Trilingual: **Kurdish (Sorani) / Arabic / English**. Send in the respondent's preferred language.

## When to send

| Touchpoint | Instruments | Audience |
|------------|-------------|----------|
| **Day 14** | NPS + CSAT | Owner + each trained staff member |
| **Day 30** | NPS + CSAT | Owner + each trained staff member |

Target: **10 survey responses per pilot** (2 touchpoints × ~5 respondents) → **50 across the 5-pilot program**.

## How to send

Keep it dead simple for an Iraqi shopkeeper:

1. **Primary channel: WhatsApp.** Paste the question block (right language) into the chat; the respondent replies with a number + optional voice note. The caller transcribes the comment into the day/exit log.
2. **Optional: Google Form** mirroring these exact questions (one form per language) if the pilot prefers a link. Keep wording identical to these files so results aggregate cleanly.

## Scoring

### NPS
- Question is **0–10**. Classify: **9–10 Promoter**, **7–8 Passive**, **0–6 Detractor**.
- **NPS = %Promoters − %Detractors** (range −100…+100).
- **Program gate: median NPS ≥ 30** at day 14 and day 30 (SF6 exit criterion).

### CSAT
- Five faceted questions, each **1–5** (1 = very dissatisfied, 5 = very satisfied).
- **CSAT score = mean of all answered facets** (report per facet too — the facets map to our weak spots: speed, reliability, printing, ease, support).
- **Target: CSAT ≥ 4.0.**

## Where results go

- Raw responses → the pilot's day/exit logs (`pilots/<code>/log/`, `exit-interview.md`).
- Roll-up → `pilots/results.md` (per-pilot and program medians).

## Optional telemetry hook (in-app surveys)

If/when we surface these in-app instead of over WhatsApp, emit the response as a lightweight event to the existing RUM ingest (`POST /api/rum/vitals` — see `backend/app/api/rum.py`) **or** add a dedicated `/api/pilot/survey` endpoint. For SF6 we deliberately keep it manual/WhatsApp-first because that is how Iraqi shopkeepers actually respond; do not block the program on building survey UI.

## Privacy

- Store only first name + role against a response in git. National IDs / phone numbers stay in Notion/DMS.
- Tell respondents the survey is about the software, responses are used to improve it, and individual answers are not shared with their employer in a way that identifies them where they ask for that.
