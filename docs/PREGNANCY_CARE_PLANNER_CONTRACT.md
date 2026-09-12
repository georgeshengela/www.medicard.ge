# Pregnancy prenatal care planner — Phase 32 contract

**Status:** CYCLE PHASE 32 — PREGNANCY PRENATAL CARE PLANNER FINAL-FROZEN  
**Date:** 2026-09-10  
**App version:** mobile `55.0.0`  
**Catalog:** `prenatal-care-v1` (`PREGNANCY_CARE_CATALOG_VERSION`)  
**Reviewed:** 2026-09-10  
**Source set:** `who-nhs-nice-acog-2026`

Phases 1–31 remain FINAL-FROZEN. This phase does not change forecast arithmetic, Pregnancy dating, baby-size, timeline, observation assessment/rates/comparison/explainability, doctor summary, partner, AI, Notification Brain, Home order, Calendar, Journal, or Quick Log.

**Related:** `docs/PREGNANCY_CARE_PLANNER_DATA.md`, `docs/CYCLE_PREGNANCY_CONTRACT.md`, `docs/CYCLE_MODE_CAPABILITIES_CONTRACT.md`, `docs/PREGNANCY_CARE_REMINDER_CONTRACT.md`, `docs/PREGNANCY_CARE_CALENDAR_EXPORT_CONTRACT.md`, `docs/PREGNANCY_CARE_APPOINTMENT_TIME_CONTRACT.md`, `docs/PREGNANCY_CARE_VISIT_PLACE_CONTRACT.md`.

---

## Product purpose

Informational + organizational planner that answers:

> What kinds of routine prenatal care commonly happen around this stage?

The owner may track upcoming items, an optional planned civil date, completed status, and a short private note.

It is **not** a medical-order engine, diagnosis, risk score, or Medi-generated plan.

Copy uses “ხშირად განიხილება ამ პერიოდში” / “შენი ექიმის გეგმა შეიძლება განსხვავდებოდეს.” Never “you must have this test.”

---

## Source hierarchy

Authoritative public guidance only. V1 hierarchy:

1. WHO antenatal care (2016 8-contact model; 2022 ultrasound-before-24-weeks update)
2. NHS Pregnancy antenatal-care pages
3. NICE NG201 antenatal care
4. ACOG public patient/clinical guidance (PATH 2025; GDM / GBS / screening FAQs)

No invented milestones. No country billing/protocol details. Dataset + deterministic merge only (no OpenRouter).

Full item-level URLs: `docs/PREGNANCY_CARE_PLANNER_DATA.md`.

---

## Dating ownership / week semantics

Gestational age comes **only** from Phase 18 `presentPregnancyDating` / `gestationalAgeFromReference`.

Completed week = `floor(elapsedCivilDays / 7)`. Care windows `[startWeek, endWeek]` are inclusive completed-week integers.

- First day of week N = elapsed `N * 7` (day-of-week 0)
- Last day of week N = elapsed `N * 7 + 6`
- `IN_WINDOW` iff current completed week ∈ [start, end]

No second GA or due-date function.

If `reviewRequired = true`: educational catalog only. No “you are in this window”, no next-for-you, no date projection.

---

## Care timing relationship

Planner timing states (not health alerts): `BEFORE_WINDOW` | `IN_WINDOW` | `AFTER_WINDOW`.

After-window copy: “ამ დროის ფანჯარა გასულია” + clinician-may-differ. **No** missed / overdue / late / danger / red alarm.

User planned date is display-priority. It does **not** rewrite the catalog window. Dates outside the informational window are allowed; copy: “შენი დაგეგმილი თარიღი ამ საინფორმაციო ფანჯრის გარეთაა.”

---

## Catalog vs database

Catalog is versioned code (`mobile/src/lib/pregnancyCareCatalog.js`). DB stores **owner overrides only**.

If a future catalog removes an item, historical owner rows remain in export/history and must not be shown as current medical guidance.

Stable `careItemId`s. Do not rename casually.

---

## User states

Persisted (user-managed only): `PLANNED` | `COMPLETED` | `DISMISSED` | `NOT_APPLICABLE`.

Do **not** persist UPCOMING / IN_WINDOW. Do **not** auto-set `NOT_APPLICABLE`. Restore dismissed via `CLEAR` (delete override).

Completion is never inferred from labs, visits, documents, or calendar.

Planned / completed dates are civil `YYYY-MM-DD`. Catalog window is **not** a validation constraint.

Note: max 400 characters. Owner-only. Not partner, AI, analytics, or doctor summary.

---

## Episode scope

`PregnancyCarePlanItemState` is keyed by `pregnancyEpisodeId + careItemId` (unique). Cascade on episode delete.

Leaving Pregnancy **ends** the episode; plan rows are historical, not deleted.

A new Pregnancy episode starts clean. Statuses never carry forward.

TRACK / TTC / PERI cannot access the active planner.

---

## Server

- Compact `carePlannerSummary` on `GET /api/cycle/pregnancy` (next item, window, status). Not the full list.
- `GET /api/cycle/pregnancy/care-plan` — full items, language-neutral keys.
- `PUT /api/cycle/pregnancy/care-plan/:careItemId`

Auth: authenticated owner, `PREGNANCY` mode, ACTIVE episode.

Server owns dating, timing relation, episode scope, status/date validation. Mobile owns copy/layout.

---

## Capability / deep link

`showPregnancyCarePlanner` is **derived from** `showPregnancyOverview` (Phase 27 matrix). No new direct mode check.

Route `/cycle/pregnancy/care-plan`. Unsupported mode: `router.replace('/cycle')`.

---

## Surfaces

| Surface | Phase 32 |
|---|---|
| Overview | One compact card “ორსულობის მოვლის გეგმა” |
| Full planner | `/cycle/pregnancy/care-plan` — NOW / upcoming / passed / completed / dismissed |
| Timeline | Unchanged (development education). Not merged. |
| Home | Unchanged (week/day preview) |
| Calendar | No planner clutter |
| Journal | No planner section |
| Quick Log | No planner controls |
| Visits module | Not linked in V1 |

---

## Privacy / firewalled systems

| Channel | Planner |
|---|---|
| Partner | Not exposed |
| Medi / OpenRouter / AI prompt | Not sent |
| Doctor summary | Not included (checklist ≠ clinical history) |
| Analytics | No care-item / status / date / note / week events |
| Notification Brain | Not bypassed. Phase 33 adds **user-opted planned-date reminders only** (`docs/PREGNANCY_CARE_REMINDER_CONTRACT.md`). Catalog windows never create reminders. |
| OS Calendar | Phase 34 owner-opted export of `plannedDate`. Date-only stays all-day. Phase 35 optional `plannedTime` creates a timed event after explicit export/update (`docs/PREGNANCY_CARE_APPOINTMENT_TIME_CONTRACT.md`). Catalog windows never create events. |
| Personal export | Includes `careItemId`, status, dates, optional `plannedTime`, note, reminderEnabled, reminderOffset, catalog version, episode id. Device-local `calendarEventId` is **not** exported. |

---

## Offline

Read-only catalog opens offline (educational, no personalized windows if the dedicated GET cannot run). Writes are **online-required** in V1. No second offline engine.

---

## Exclusions (V1)

No medication (aspirin, iron, folic dosing, insulin, anti-D, antibiotics, supplements). No diagnosis. No risk score. No twin-specific schedule. No age/condition personalization. No kick counting, contraction timer, birth bag, hospital checklist, emergency/ectopic planning. No rigid every-4/2/1-week visit cadence.

---

## Future source review

When WHO/NHS/ACOG/NICE guidance changes: bump `datasetVersion` / `reviewedAt`, keep stable IDs, re-run catalog validator tests, fail closed if a source record is incomplete.
