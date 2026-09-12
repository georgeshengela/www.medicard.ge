# Cycle Postpartum mode — Phase 38 foundation

**Status:** CYCLE PHASE 38 — POSTPARTUM MODE FOUNDATION  
**Date:** 2026-09-11  
**App version:** mobile `61.0.0`  
**iOS QA:** deferred by product decision

Phases 1–37 remain FINAL-FROZEN. Cycle product is not final.

`POSTPARTUM` is an **explicit owner-selected tracking context**. It is not a pregnancy outcome Medicard infers.

Capability matrix: `docs/CYCLE_MODE_CAPABILITIES_CONTRACT.md`.

**Phase 40** (presentation only): postpartum Journal / summary empty states must not assume menstruation. Contract: `docs/CYCLE_POSTPARTUM_COPY_ISOLATION_CONTRACT.md`. App version `63.0.0`.

**Phase 41** (owner classification): the owner may mark a postpartum bleed episode as their period. Default remains unknown bleeding. Forecast stays suppressed in POSTPARTUM. Contract: `docs/CYCLE_POSTPARTUM_PERIOD_CLASSIFICATION_CONTRACT.md`. App version `64.0.0`.

**Phase 42** (explicit return to TRACK): the owner may return to `TRACK_PERIOD`. Mode and forecast readiness are separate. Contract: `docs/CYCLE_POSTPARTUM_RETURN_TO_TRACK_CONTRACT.md`. App version `65.0.0`.

---

## 1. Canonical mode

`CycleProfile.mode` (string, not a Prisma enum):

`TRACK_PERIOD` | `TRY_TO_CONCEIVE` | `PREGNANCY` | `PERIMENOPAUSE` | `POSTPARTUM`

There is no `isPostpartum` column or duplicate boolean.

Existing users keep their existing mode. POSTPARTUM is never a default.

---

## 2. Explicit entry only

Entry: Cycle Settings → tracking goal → **მშობიარობის შემდეგ** → compact onboarding → confirm (`postpartumConfirm: true`).

Never auto-enter because:

- Pregnancy episode ended
- due date / week 40 / 41 / 42 passed
- care planner / birth-planning / newborn-prep items completed
- pregnancy reminders stopped
- bleeding, breast symptoms, fatigue, sleep loss, or a date was logged
- AI inferred anything

Onboarding requires network. Failed switch does **not** set local mode to POSTPARTUM.

---

## 3. Outcome firewall

Entering POSTPARTUM is **not** proof of:

live birth · vaginal birth · C-section · miscarriage · stillbirth · abortion · ectopic pregnancy · neonatal outcome · pregnancy loss · infant status

No outcome field is stored. Do not store `LIVE_BIRTH` implicitly.

Georgian entry copy is tracking-context wording. Do not ship “ბავშვი დაიბადა”, “მშობიარობა დასრულდა”, or “Pregnancy successful”.

---

## 4. Pregnancy → POSTPARTUM

Uses the frozen Pregnancy transition: `applyPregnancyEpisodeTransition` ends the ACTIVE pregnancy episode (`ENDED` + `endedAt`) with **no outcome reason**. Then `applyPostpartumEpisodeTransition` in the **same** profile transaction creates a postpartum episode.

Do not invent a second pregnancy-ending mechanism.

Historical Pregnancy data is preserved: episode, care planner state, pregnancy logs, snapshots, prenatal OS Calendar ownership.

Active Pregnancy-only routes (`/cycle/pregnancy/timeline`, `/cycle/pregnancy/care-plan`, `/cycle/week/[week]`) already redirect when `showPregnancyOverview` is false.

---

## 5. Non-Pregnancy entry

TRACK / TTC / PERIMENOPAUSE may enter POSTPARTUM without a prior Pregnancy episode. A user may begin Medicard postpartum without having tracked the pregnancy.

---

## 6. Reference date

Optional owner-entered civil `YYYY-MM-DD` on `CyclePostpartumEpisode.referenceDate`.

**Not** `birthDate`. Never derived from due date, gestational week, care planner, last pregnancy log, episode `endedAt`, first postpartum log, notification, Calendar, or AI.

- Missing date: mode works; no elapsed week/day.
- Future date: **rejected** (HTTP 400). Not clamped.
- Add / change / clear: elapsed display only. Health logs are not rewritten.
- Clear: mode stays POSTPARTUM; elapsed disappears.

Shared `CycleDateField` lookback is 18 months (frozen last-period picker). Server accepts any past civil date.

---

## 7. Elapsed math (server-owned)

`postpartumElapsed(reference, today)` via canonical `daysBetween`:

```
days
week = floor(days / 7)
day  = days % 7
```

Same civil day = `0 კვირა + 0 დღე`. Example: 23 days → `3 კვირა + 2 დღე`.

This is elapsed time from the date the owner entered. **Not** recovery progress. No recovery %, healing score, or normality score.

Mobile does not recompute week/day.

---

## 8. Episode architecture

**Decision: yes — `CyclePostpartumEpisode`.** Needed for clean history, one-active isolation, re-entry, and flow stamps. Meaning: “owner used postpartum tracking during this interval.” Nothing more.

```
CyclePostpartumEpisode
  id, userId
  referenceDate     civil YYYY-MM-DD | null
  startedAt, endedAt nullable
  status            ACTIVE | ENDED
```

One ACTIVE episode per user (SQL partial unique `CyclePostpartumEpisode_one_active`).

Leaving any other mode ends the ACTIVE episode. No medical reason required.

Re-entry creates a **new** episode. Do not reuse an ended row. No cross-episode stale read.

No pregnancy-outcome field.

---

## 9. Mode capabilities

New flags (both server + mobile matrices):

| Flag | POSTPARTUM |
|---|---|
| `showPostpartumOverview` | Y |
| `showPostpartumTracking` | Y |
| classic / TTC / pregnancy / peri overviews | N |
| next-period / late / fertile / ovulation / fertility / pregnancy-test | N |

Presentation uses capabilities. Direct `mode === 'POSTPARTUM'` remains valid for transition, read model, notification suppression, AI mapping.

---

## 10. Forecast suppression and isolation

**Arithmetic in `cycle.js` is unchanged.** `PERIOD_FLOWS` remains `light|medium|heavy`. No postpartum formulas. No return-of-fertility / lactation-amenorrhea / breastfeeding fertility logic.

Presentation: no next-period, late-period, fertile window, or ovulation decorations.

Highest-risk issue: postpartum flow must not become menstrual history.

### Flow isolation

Historical `CycleLog` has **no mode-at-log**. Additive, never backfilled:

- `CycleLog.trackingContext` — `null | POSTPARTUM`
- `CycleLog.postpartumEpisodeId` — optional FK (`onDelete: SetNull`)

Writes while `mode=POSTPARTUM` stamp both (log upsert + `upsertBleedDay`). The stamp is never stripped later.

Engine input boundary (`engineLogWhere` / `filterLogsForEngine`):

```
OR: [{ trackingContext: null }, { trackingContext: { not: 'POSTPARTUM' } }]
```

Prisma `NOT trackingContext = 'POSTPARTUM'` would drop NULLs. Do not use that form.

Legacy logs without a stamp stay under existing TRACK/TTC/Pregnancy/Peri semantics. **No fake historical postpartum backfill.** Do not infer postpartum from date proximity to a Pregnancy episode.

---

## 11. Surfaces

**Overview:** postpartum tracking mode → optional elapsed → today’s logged facts → Quick Log. No fruit, gestational week, due date, pregnancy milestones, prenatal planner, pregnancy trends, or `plannedPlace`.

**Home:** mode label + optional elapsed. No symptoms. Home section order unchanged (`buildHomeSectionOrder`).

**Calendar:** existing Cycle Calendar. Logged facts remain. Future fertile / ovulation / predicted-period / late suppressed via capabilities. Logged bleed a11y/legend in postpartum = **სისხლდენა**, not მენსტრუაცია.

Engine `predictions.calendar` overlay uses engine-eligible logs only (postpartum-stamped flow is excluded there). Presentation copies display-log `flow` onto marks (`mergeLoggedFlowOntoMarks`) so factual bleed cells still paint. This does not change `cycle.js` arithmetic or LMP.

**Journal:** same three tabs. Postpartum factual history (`recentLogs` for the active episode). Hide prediction-history and period-history charts in this mode.

**Quick Log:** canonical CycleLog. Reused observations only: flow, pain, sleep, energy, mood, fatigue, dizziness, headache/migraine, swelling, constipation, nausea, frequent_urination. No giant questionnaire. No assessments / rates / EPDS.

**Day Details:** factual groups; menstrual group title = სისხლდენა. Do not call every bleed “period”, “lochia”, or “postpartum hemorrhage”.

Icon: HeartPulse. Not a baby tracker.

---

## 12. Observation reuse (registry only)

Phase 38 does **not** invent new observation keys.

Reusable existing keys (Quick Log / Overview facts): bleeding/flow, painEntries, sleepQuality, energy, moods, fatigue, dizziness, headache, migraine, swelling, constipation, nausea, frequent_urination.

Out of foundation: breastfeeding, baby tracking, C-section / delivery type, perineal/incision, contraception product, pelvic-floor, exercise plan, return-to-sex guidance.

Sexual/private fields stay under existing privacy. Not widened.

Phase 28–31 assessment / rates / comparison / explainability are **not** extended to postpartum.

---

## 13. Read model

`GET /api/cycle/postpartum` (`CYCLE_POSTPARTUM_HTTP_PATH`). Compact `bundle.postpartum` for Home.

Minimal owner payload: `active`, `referenceDate`, `elapsed | null`, `todayObservations`, `recentLogs`, `episode`, `capabilities`, `honesty`.

`PUT /api/cycle/postpartum` `{ referenceDate: string | null }` — only while already in POSTPARTUM.

Auth: pending ≠ empty. 401 ≠ fake “no postpartum data”. Cross-user: `scopePostpartumQueryToUser`.

Offline mode switch: online-required. Failed switch does not persist POSTPARTUM locally.

---

## 14. Firewalls

**Postpartum is not an AI-supported Cycle mode in Phase 38. Its Cycle context is omitted rather than mapped to another mode.**

| Channel | Phase 38 |
|---|---|
| Medi / OpenRouter | **Fail-closed.** Postpartum is not an AI-supported Cycle mode. `profileModeForAiPrompt(POSTPARTUM) = null` (omitted). Do **not** map to `TRACK_PERIOD` or `PREGNANCY`. Cycle user prompt is empty. `CYCLE_WELLNESS` OpenRouter is not called. General Medi still runs; patient extras omit `ციკლის რეჟიმი` rather than sending `POSTPARTUM`. No reference / elapsed / episode / stamped logs / forecast in any AI payload. |
| Partner | Default-deny. Leak keys include `postpartum`, `postpartumEpisode`, `CyclePostpartumEpisode`, `postpartumReferenceDate`, `trackingContext`, `elapsed`. |
| Doctor summary | **Phase 39:** current `postpartumContext` on the existing doctor-summary when mode is POSTPARTUM and an ACTIVE episode exists. Not obstetric history. Contract: `docs/CYCLE_POSTPARTUM_DOCTOR_SUMMARY_CONTRACT.md`. |
| ProductEvent analytics | No reference date, week, bleeding, mood, pain, or sexual data. |
| Notification Brain | No postpartum pushes. Period/fertility/late candidates skip POSTPARTUM (`POSTPARTUM_SUPPRESSED`). `log_nudge` unchanged. |
| Personal export | Includes `profile.mode`, postpartum episodes, `trackingContext`, `postpartumEpisodeId`. No outcome field. |

---

## 15. Prenatal reminders and OS Calendar

Phase 33/36 send-time revalidation already requires Pregnancy + ACTIVE episode. Switching to POSTPARTUM fails `pregnancyCareReminderEligibility` with **`MODE_EXIT`** (and episode ended). No separate cancellation hack.

Phase 34/35 OS Calendar events remain owner-owned external artifacts. **Do not auto-delete** on mode exit.

Phase 37 `plannedPlace` stays historical Pregnancy planner metadata. Not surfaced in postpartum UI.

---

## 16. Georgian copy (locked)

| Use | Copy |
|---|---|
| Settings label | მშობიარობის შემდეგ |
| Title | მშობიარობის შემდგომი თვალყური |
| Reference | თვალთვალის საწყისი თარიღი |
| Elapsed hint | შენს მითითებულ თარიღიდან. არ არის გამოჯანმრთელების პროგრესი. |
| Bleeding | სისხლდენა |
| Not diagnosis | ეს არის თვალთვალის რეჟიმი, რომელსაც თქვენ ირჩევთ. არ არის გამოჯანმრთელების დიაგნოზი. |

Do not use დაბადების თარიღი for the reference field.

---

## 17. Database

Additive SQL: `server/prisma/migrations/20260911120000_cycle_postpartum_mode/migration.sql`.

Neon may lack `_prisma_migrations`. Use `prisma db execute` (Phase 8 pattern). Do not fabricate migrate history.

---

## 18. Explicitly not in Phase 38

Postpartum care planner · newborn tracker · breastfeeding tracker · depression screening / EPDS · pelvic-floor program · C-section recovery · contraception product · return-to-sex guidance · exercise plan · AI recommendations · postpartum notifications · recovery scoring · two-window comparison · observation rates.

---

## 19. Tests (A–Z)

Covered in `server/src/lib/cyclePostpartum.test.js`, capability parity, presentation guard, notification E3, pregnancy-care `MODE_EXIT`, postpartum query lifecycle.

---

## 20. Android QA

Artifacts: `qa/cycle-phase38-postpartum/`.

iOS native QA deferred by product decision.
