# Pregnancy timeline & milestones — Phase 21 contract

**Status:** implementation contract for Cycle Phase 21. Phases 1–20 remain FINAL-FROZEN.  
**Date:** 2026-09-10  
**App version:** mobile `44.0.0`  
**Dataset:** `PREGNANCY_TIMELINE_VERSION = cycle.pregnancy-timeline.v1`

Educational calendar journey only. Not diagnosis. Not an obstetric outcome model. Not AI.

---

## Scope

When `mode = PREGNANCY` and an ACTIVE episode has valid dating, the owner can see:

- current gestational week/day (Phase 18 fields, passthrough)
- current trimester (server-owned, same formula as Phase 18)
- calendar progress along a 40-week rail
- 13 source-backed milestones (not 40 weekly cards)
- current / past / upcoming states
- estimated due date at the end of the rail
- compact Overview + Journal CTAs
- a dedicated screen `/cycle/pregnancy/timeline`

---

## Non-goals

- ended-pregnancy obstetric history, miscarriage / birth / termination / ectopic classification
- OpenRouter / Medi timeline copy or interpretation
- risk scores, growth interpretation, symptom diagnosis
- personalized prenatal appointment / medication / nutrition checklists
- calendar day milestone badges
- Home hub milestone detail
- doctor-summary milestone prose
- partner auto-share
- Notification Brain pushes
- analytics of week / trimester / due date
- development %, health %, baby-readiness, XP, badges

---

## Overlap with existing Pregnancy UI

| Surface | Phase 21 |
| --- | --- |
| Overview hero (`CyclePregnancyCard`) | unchanged week/day/due/review + Phase 19 metrics. Compact **ორსულობის გზა** peek is added below, not a second hero. |
| Week Detail `/cycle/week/[week]` | canonical week copy. Timeline **deep-links** here. |
| Baby-size catalog | unchanged values and sources. No fruit / cm / g in timeline rows. |
| Journal | one compact CTA. No full timeline embed. |
| Calendar | no milestone badges. |
| Home Cycle card | week/day only. No milestone detail. |
| Doctor summary | Phase 20 header unchanged. No milestone prose. |
| Settings / reference date | unchanged. Timeline does not re-explain reference dating. |

---

## Current week

Timeline consumes `estimatedGestationalAge.week` and `.day` from `presentPregnancyDating`. It does **not** call `daysBetween` or recompute age from `referenceDate`.

---

## Trimester convention

**Owner:** `trimesterFromCompletedWeek(week)` in `server/src/lib/cyclePregnancy.js`, used by `gestationalAgeFromReference`. Timeline **passes through** `estimatedGestationalAge.trimester`.

Completed-week bands (NHS week-number convention, identical to the pre-Phase-21 inline formula):

| Trimester | Completed weeks | Georgian label |
| --- | --- | --- |
| 1 | 0–12 | პირველი ტრიმესტრი |
| 2 | 13–26 | მეორე ტრიმესტრი |
| 3 | 27+ | მესამე ტრიმესტრი |

UI trimester chips label T3 as 27–40 on the standard calendar. Week 41–44 stays T3 without “overdue”.

This is **not** ACOG’s 13w6d / 28w0d cutover. Copy states that clinical boundaries may differ.

---

## Progress semantics

`progress.kind = gestational_calendar`. Label: **კვირა N / 40**. Hint: calendar position on a 40-week line — not a development score.

The rail fill is `min(1, (week + day/7) / 40)`. Never labeled “62% developed” or “62% pregnancy completed”.

---

## Milestone model

Language-neutral keys on the server. Status from comparing `milestone.week` to **server** `currentWeek`:

- `PAST` — earlier (UI: **ადრე**, never “completed successfully”)
- `CURRENT` — same completed week
- `UPCOMING` — later (UI: **შემდეგ** / typically around week N)

Categories: `PREGNANCY_STAGE` | `GENERAL_DEVELOPMENT` | `MATERNAL_CHANGE` | `CLINICAL_WINDOW`.

Clinical windows use “ხშირად ინიშნება / განიხილება”, never “do this now”.

Dataset + citations: `docs/PREGNANCY_TIMELINE_DATA.md`.

---

## reviewRequired

If dating is `reviewRequired` (or age is missing): `timeline.available = false`, `currentWeek/day/trimester/progress = null`, `milestones = []`. No random week fallback.

---

## Week 40+

Week 40: end of the standard calendar + estimated due date (always estimated).  
Week 41–44: `beyondStandardTerm`, copy **სტანდარტული 40-კვირიანი ხაზის მიღმა**. No overdue / medical alarm.

---

## Server / client ownership

- Dating, trimester, due date: Phase 18 server helpers (unchanged arithmetic).
- Timeline attachment: `buildCyclePregnancyData` → `timeline` via `presentPregnancyTimeline`.
- `bundlePregnancyView` (Home) does **not** include the timeline.
- Mobile renders `payload.timeline`. Offline fallback may re-run the **same** presenter on cached age fields; it still must not date from LMP.

---

## Shared pregnancy content architecture

Phase 19 catalog stays in `mobile/src/lib/pregnancyWeekData.js` (server already imports it). Metro does not watch a repo-root `shared/` folder.

**Decision: defer `shared/pregnancy/`.** New timeline catalog lives beside Phase 19 at `mobile/src/lib/pregnancyTimelineData.js`. Moving both catalogs later is a dedicated chore, not this freeze.

---

## Privacy / AI / partner / notifications / export

Unchanged firewalls. Timeline is owner Pregnancy GET only.

- No new Notification Brain campaigns
- No ProductEvent with week / trimester / due date
- Partner payload must not contain timeline keys
- Doctor summary / personal export do not include the milestone catalog
- Medi / OpenRouter prompts do not receive timeline copy

---

## Accessibility

Each row exposes status, week, and title in text (not color-only). Progressbar `accessibilityValue` is week 0–40, not a development percent. Reduced motion skips entrance animation. Titles wrap at large text. Dark rail uses muted/rose, not neon.

---

## Copy safety

Warm, factual Georgian. No “miracle”, no assumed live birth, no “when you meet your baby”. Past ≠ confirmed development.

---

## Future extensions

Not in Phase 21: user-logged visits on the rail, viability education, ACOG trimester switch, EN/FR/RU product UI, iOS native QA.
