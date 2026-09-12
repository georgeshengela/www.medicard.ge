# Cycle Pregnancy contract — Phase 18 freeze

**Status:** CYCLE PHASE 18 — PREGNANCY MODE FOUNDATION FINAL-FROZEN. Not Cycle-product-final.  
**Date:** 2026-09-09  
**App version:** mobile `41.0.0`  
**iOS QA:** deferred by product decision

Mode changes **presentation / user goal**. It does **not** change cycle forecast arithmetic.

Canonical field: `CycleProfile.mode` (`TRACK_PERIOD` | `TRY_TO_CONCEIVE` | `PREGNANCY`). There is no `isPregnant` boolean.

**Phase 27 presentation matrix:** `docs/CYCLE_MODE_CAPABILITIES_CONTRACT.md`. Pregnancy UI requires `showPregnancyOverview` **and** a valid Pregnancy read (loading ≠ empty product). Direct episode checks stay on `applyPregnancyEpisodeTransition` / `isPregnancyProfileMode`.

---

## Purpose

Pregnancy mode is an **explicit** owner-entered product mode. It:

- keeps prior Cycle / TTC history
- stops presenting fertile-window / ovulation / next-period / late-period as **active** guidance
- shows a pregnancy timeline from a user-confirmed reference date
- supports ordinary CycleLog observations (spotting, pain, nausea, tests, notes)
- stays factual and observational
- stays owner-private (not partner, not AI-widened, not analytics)

---

## Non-goals

Not in Phase 18:

- diagnosis, “you are pregnant”, viability, implantation, miscarriage/ectopic risk
- OpenRouter / Medi pregnancy interpretation
- Perimenopause mode
- baby-size fruit copy, week-by-week fetal stories, kick counters, vitamin checklists
- prenatal appointment manager (visits module already exists)
- medications / weight / hydration / steps duplicated into Cycle
- obstetric history questionnaire (parity, C-section, blood group, prior loss)
- pregnancy-specific Notification Brain campaigns
- outcome enums (live birth / miscarriage / abortion / ectopic)
- doctor-confirmed ultrasound dating flag
- client-side gestational math

---

## Explicit mode entry

Pregnancy **never** activates from:

- a positive pregnancy test
- late / missed period
- symptoms
- TTC mode
- OPK / BBT
- Medi / AI output

Entry: Cycle Settings → tracking goal → Pregnancy → compact onboarding → **confirm**.

Onboarding requires network. Offline confirm fails without mutating local mode.

A positive test remains a user-logged `CycleLog.pregnancyTest`. It does not mean confirmed pregnancy or `mode=PREGNANCY`.

A negative test while in Pregnancy does **not** exit the mode.

---

## Episode architecture

**Decision: `CyclePregnancyEpisode` is required.** A single mutable `CycleProfile.dueDate` cannot represent re-entry, later TTC, or historical export.

```
CyclePregnancyEpisode
  id, userId
  referenceDate     civil YYYY-MM-DD
  referenceType     LMP | USER_SELECTED
  startedAt, endedAt nullable
  status            ACTIVE | ENDED
```

Invariants:

- at most one ACTIVE episode per user (partial unique index + server check)
- `mode=PREGNANCY` after a successful enter has exactly one ACTIVE episode
- leaving Pregnancy ends the ACTIVE episode (`ENDED`, `endedAt`); history is kept
- later enter creates a **new** episode; the old reference is not reused
- no outcome enum

Mode switch + episode create/end run in one Prisma transaction with the profile write.

`CycleProfile.dueDate` is a derived cache of estimated due date for the active episode (Naegele: reference + 280). It is not an independent medical source.

Legacy `PregnancyLog` remains in the schema (additive freeze) and is not the Phase 18 product observation store. New logging uses `CycleLog`.

---

## Reference date semantics

Preferred source: user-confirmed **last menstrual period** (`referenceType: LMP`).

Wording: LMP-ზე დაფუძნებული შეფასება. Not ultrasound. Not embryo age.

If the chosen date is not the stored last period, type is `USER_SELECTED`.

Do **not** infer the reference from a positive test, OPK, BBT, or fertile-window estimate.

Validation (civil dates, Cycle clock `today`):

| Case | Result |
|---|---|
| future date | 400 |
| 0–308 days ago (≤ 44 weeks) | accepted; week/day + estimated due date shown |
| 309–365 days ago | accepted; `reviewRequired`; **no** week/day, **no** due date |
| > 365 days | 400 |

Editing the reference recomputes display. CycleLog rows are not rewritten.

---

## Week / day and due date

Server-owned. Helper: `gestationalAgeFromReference` in `server/src/lib/cyclePregnancy.js`.

- elapsed = `daysBetween(referenceDate, today)` (civil)
- same day = 0 weeks + 0 days
- week = `floor(elapsed / 7)`, day = `elapsed % 7`
- estimated due date = `addDays(reference, 280)` (Naegele), labeled **სავარაუდო მშობიარობის თარიღი**, `estimated: true`

Timezone: existing Cycle civil-date contract (device TZ → stored quest TZ → Asia/Tbilisi). No extra pregnancy shifting.

Mobile must not compute week/day independently. `GET /api/cycle/pregnancy` and `bundle.pregnancy` are the source.

The frozen `gestationalAge(dueDate)` helper remains in `cycle.js` for compatibility and is **not** the Phase 18 product path.

`fetalInsightForWeek` / `FETAL_SIZE_KA` are unused by product UI.

---

## Mode transitions

| From | To | Episode |
|---|---|---|
| TRACK or TTC → PREGNANCY | requires `pregnancyConfirm: true` + reference | create ACTIVE |
| PREGNANCY → TRACK or TTC | settings save | end ACTIVE |
| PREGNANCY while already PREGNANCY | reference edit | update ACTIVE |

History (logs, snapshots, Journal, doctor-summary documents, TTC observations) is never deleted by a mode change.

---

## Presentation suppression (not engine rewrite)

Forecast `buildPredictions` is unchanged. Pregnancy presentation hides:

- active fertile window / ovulation guidance (`showFertilityUi` false)
- next-period forecast overlays (`showPredicted` false)
- late-period banner (also frozen `detectLatePeriod` reason `pregnancy_mode`)
- TTC overview / OPK / BBT shortcuts

Calendar still shows logged period / spotting history.

---

## Pregnancy test

Observation only. Positive does not enter. Negative does not exit. History remains visible as facts.

---

## Privacy / AI / partner / analytics / notifications

- Episode and mode are owner-only. Not auto-shared.
- Partner leak keys already exclude `pregnancy` / `dueDate` / `pregnancyTest`; also `referenceDate`, `estimatedDueDate`, `estimatedGestationalAge`.
- AI prompt is **not** widened with episode id, reference type, or due date. Existing “mode = PREGNANCY” line is not expanded.
- Doctor-summary defaults unchanged (no automatic pregnancy header; tests remain document-scoped opt-in).
- Personal export includes `pregnancyEpisodes` as owner data.
- No pregnancy ProductEvent values (mode, week, due date, test result).
- Notification Brain unchanged. No “baby is growing” / vitamins / call-your-doctor pushes. Existing pregnancy suppression of period candidates remains.

Privacy mask: no lock-screen pregnancy health text.

---

## Offline / cold start

Mode switch and episode create require network.

`GET /api/cycle/pregnancy` is gated: `auth.ready` AND authenticated AND server `mode=PREGNANCY` AND reachable. Failures are not stored as empty. Logout / user switch scopes the query (`cyclePregnancyQuery.js`).

Logging continues through the existing CycleLog offline queue.

Wipe (`POST /api/cycle/wipe`) deletes pregnancy episodes.

---

## Bounded history

Owner pregnancy read: last **280** days of CycleLog. No 5-year fetch.

---

## Empty / missing data

Missing log ≠ symptom absent. Empty copy: not “no pregnancy symptoms”.

---

## Future extensions

Possible later phases (not this freeze): medically sourced week content, doctor-summary pregnancy header, richer observations, ultrasound dating with explicit source, outcome types. Do not start them here.

---

## Android QA (Phase 18)

Artifacts: `qa/cycle-phase18-pregnancy/01–12`.

| Shot | Surface |
|---|---|
| 01 | Settings → Pregnancy onboarding sheet (confirm + reference) |
| 02 | Overview: pregnancy header, week/day, estimated due date |
| 03 | Settings reference date + read-only estimated due date |
| 04 | Calendar: logged period/spotting legend only |
| 05 | Quick Log: pregnancy test, no OPK/BBT as active TTC metrics |
| 06 | Day details: logged facts, no cycle-day / predicted period |
| 07 | Journal pregnancy context above history |
| 08 | Journal history / stats (prior cycles kept) |
| 09 | Spotting + pain on a logged pregnancy day |
| 10 | Large text (`font_scale` 1.6) |
| 11 | Dark |
| 12 | Small screen (`960x1800`) |

**Related:** Phase 19 baby-size / week-by-week visual guide is a separate additive contract (`docs/PREGNANCY_BABY_SIZE_CONTRACT.md`). It consumes Phase 18 gestational week and does not change dating or the forecast engine.

**Related:** Phase 32 pregnancy prenatal care planner (`docs/PREGNANCY_CARE_PLANNER_CONTRACT.md`, `docs/PREGNANCY_CARE_PLANNER_DATA.md`) consumes the same Phase 18 week/day and does not change dating, engine, timeline, doctor summary, partner, or AI.

