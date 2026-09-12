# Pregnancy prenatal exact-time reminders — Phase 36 contract

**Status:** CYCLE PHASE 36 — OWNER-OPTED EXACT-TIME PRENATAL CARE REMINDERS FINAL-FROZEN  
**Date:** 2026-09-11  
**App version:** mobile `59.0.0`

Phases 1–35 remain FINAL-FROZEN. This phase adds **one** capability: an optional **EXACT_TIME** reminder mode when the owner has entered both `plannedDate` and `plannedTime` **and** explicitly selects that mode.

Not a medical scheduler. Not a catalog-due engine. Not an automatic upgrade from Phase 35 time.

**Related:** `docs/PREGNANCY_CARE_REMINDER_CONTRACT.md` (Phase 33 DATE_BASED), `docs/PREGNANCY_CARE_APPOINTMENT_TIME_CONTRACT.md` (Phase 35 `plannedTime`), `docs/PREGNANCY_CARE_PLANNER_CONTRACT.md`, `docs/PREGNANCY_CARE_CALENDAR_EXPORT_CONTRACT.md`, `docs/CYCLE_NOTIFICATION_CONTRACT.md`, `docs/PREGNANCY_CARE_VISIT_PLACE_CONTRACT.md`.

---

## Product purpose

Support two mutually exclusive reminder models on one care item:

| Mode | Fire time | Requires |
| --- | --- | --- |
| `DATE_BASED` | `plannedDate − offsetDays` at **09:00 local**, then Phase 33 `bumpOutOfQuiet` | `plannedDate` + explicit reminder opt-in |
| `EXACT_TIME` | `plannedDate + plannedTime − lead minutes` as local wall-clock | `plannedDate` + `plannedTime` + explicit `EXACT_TIME` |

Meaning remains `USER_PLANNED_EVENT`. Never `MEDICAL_DUE_ITEM`.

---

## Phase 33 compatibility

DATE_BASED is unchanged:

- offsets `0 | 1 | 3` civil days
- 09:00 local daypart
- quiet-hour bump via `bumpOutOfQuiet` (same as Cycle calendar reminders)
- candidate id: `pregnancy_care:{user}:{episode}:{item}:{plannedDate}:{offsetDays}`

`plannedTime` is **ignored** in DATE_BASED. Adding Phase 35 time never changes fire math.

---

## Explicit exact-time opt-in

Choosing EXACT_TIME is a separate owner action (UI: **დაგეგმილი დროით**).

Default after explicitly choosing EXACT_TIME: **1 hour before**.

Choosing EXACT_TIME itself must be explicit. Presence of `plannedTime` does **not** auto-enable, auto-select, or auto-upgrade the mode.

Phase 35 `reminderSchedulingUsesPlannedTime()` / `exactTimeReminderAdded()` remain `false` — those functions document that **adding time is not a reminder change**.

---

## Required planned date and time

Exact-time reminder requires all three:

1. `plannedDate`
2. `plannedTime`
3. `reminderMode = EXACT_TIME`

Missing any one: no exact-time reminder. No invented clock. No catalog-window fallback.

---

## Reminder modes and fields

Schema (additive on `PregnancyCarePlanItemState`):

| Field | Meaning |
| --- | --- |
| `reminderEnabled` | Owner preference (unchanged) |
| `reminderOffset` | Civil **days** `0 \| 1 \| 3` (DATE_BASED only). Never reinterpreted as hours. |
| `reminderMode` | `DATE_BASED` \| `EXACT_TIME`. **null = DATE_BASED** (legacy). |
| `exactReminderOffsetMinutes` | `0 \| 30 \| 60 \| 120`. Null unless EXACT_TIME is active. |

Canonical resolver (single fire-math owner):

`resolvePrenatalCareReminderSchedule(state, { timeZone? })`

Mobile UI may display that result. It must not invent a second timezone engine.

Derived preview (`reminderPreview.fireCivilDate` / `fireClock`) is additive on the read model. **Not a DB column.**

---

## Exact lead options (V1)

- `AT_TIME` — 0 minutes (owner-entered clock; not a verified appointment)
- `30_MIN_BEFORE` — 30
- `1_HOUR_BEFORE` — 60 (default after explicit EXACT_TIME)
- `2_HOURS_BEFORE` — 120

No after-start offsets. One reminder per care item. Modes are mutually exclusive — never date-based **and** exact for the same item.

---

## No catalog scheduling

Never derive candidates from `startWeek`, `endWeek`, `IN_WINDOW` / `AFTER_WINDOW`, current pregnancy week, due date, or care recommendation timing.

---

## Schedule ownership

Notification Brain is the sole delivery authority.

- No direct Cycle push API
- No second prenatal scheduler
- No OS Calendar alarm
- Caps: same user-alarm pipeline as Phase 33 (not Engage companion pool, not medication channel)
- Priority: not emergency / not critical

Server write validation + Brain `shouldDeliverNotification` → `deliverPregnancyCareReminder` remain the path.

Device scheduling:

- DATE_BASED: 09:00 then `bumpOutOfQuiet`
- EXACT_TIME: `new Date(fireAtMs)` from the canonical resolver — **no quiet-hour bump**

---

## Timezone

`plannedDate` + `plannedTime` are **user/device-local wall-clock**. Not stored as UTC. Not a hospital timezone.

- Production Brain path omits `timeZone` and uses the runtime `Date` constructor (device local).
- Deterministic tests pass `Europe/Brussels`.

Do not infer clinic location.

---

## DST

User intent is local wall-clock.

- **Non-existent local time** (spring forward gap): fail closed (`NONEXISTENT_LOCAL_TIME`). Do not silently move the appointment. Neutral UI: «არჩეული ადგილობრივი დრო ამ დღეს არ არსებობს.»
- **Ambiguous local time** (fall back overlap): first occurrence (ICU / `Date` local). Same as platform/Brain canonical policy. Medicard does not invent a second resolver.

---

## Midnight crossover

Wall-clock minute subtract, not UTC:

- `00:00` − 1 hour → previous civil day `23:00`
- `00:30` − 1 hour → previous civil day `23:30`
- `23:59` at-time is valid

---

## Quiet hours

Reuse existing local user-alarm policy. Do not invent prenatal-specific bumping.

| Mode | Policy |
| --- | --- |
| DATE_BASED | Phase 33: `bumpOutOfQuiet` after 09:00 |
| EXACT_TIME | Same as visit alarms: fire at calculated wall-clock, **no quiet-hour bump** |

Never turn an exact-time user reminder into a random time.

---

## Permissions

Unchanged from Phase 33: reminder preference ≠ OS permission. Store preference even if permission is denied. Do not claim delivery. Do not nag. Brain suppresses if permission is revoked.

---

## Revalidation (send time)

Immediately before delivery confirm:

- same user
- mode is `PREGNANCY`
- ACTIVE episode matches
- catalog item still renderable
- status still `PLANNED`
- `plannedDate` unchanged
- reminder still enabled
- `reminderMode` still matches
- if EXACT_TIME: `plannedTime` still matches
- offset still matches (days or exact minutes)
- not COMPLETED / DISMISSED / NOT_APPLICABLE / CLEAR
- fire time not in the past (no catch-up)

Stale candidate: fail closed. Do not send.

---

## Dedupe / candidate identity

DATE_BASED (unchanged):

`pregnancy_care:{userId}:{episodeId}:{careItemId}:{plannedDate}:{offsetDays}`

EXACT_TIME:

`pregnancy_care:{userId}:{episodeId}:{careItemId}:{plannedDate}:{plannedTime}:EXACT:{minutes}`

Sync cancels prefix `pregnancy_care:` then rebuilds. One candidate per item.

---

## Invalidation

| Change | Effect |
| --- | --- |
| Date changed | Old candidate invalid |
| Time changed | Old exact candidate invalid; new fire uses new time |
| Offset changed | Old candidate invalid |
| Mode changed | Only the new mode is deliverable |
| Time removed while EXACT | `reminderEnabled = false`; exact config cleared; **no 09:00 fallback** |
| Date cleared | Reminder invalidated (Phase 35 also clears time) |
| COMPLETED / DISMISSED / NOT_APPLICABLE / CLEAR | Suppress |
| Episode end | Suppress |
| New pregnancy | No carryover |
| Cross-user | No leak |
| Logout | Cancel prefix (existing `appPermissions`) |

Silent EXACT → DATE_BASED while still enabled is forbidden (that would send 09:00). Invalidation **disables** first.

UI copy when time is removed: «დაგეგმილი დრო წაიშალა, ამიტომ დროითი შეხსენება გამოირთო.»

---

## Past fire / today future

If calculated fire time is already past: no catch-up.

UI: «არჩეული შეხსენების დრო უკვე გასულია.»

Today + future fire: allowed. At-time after the appointment clock: no retrospective push.

---

## Privacy

Phase 33 privacy-minimal default stays.

Masked lock-screen:

- title: `Medi-სგან შეხსენება`
- body: `შენი დაგეგმილი მოვლის შეხსენება`

Exact clock and care-item title do **not** appear in the default lock-screen body.

Unmasked (existing user privacy preference only):

`შეგახსენებთ: შენ დაგეგმე ${item}.`

No “starts in 1 hour”. Medicard only knows user-entered time.

Deep link unchanged: `/cycle/pregnancy/care-plan?item=:careItemId`

Opening a notification never infers completed / missed / attended.

---

## Calendar / OS alarms

Phase 34/35 Calendar export is separate. Reminder mode never alters calendar title, time, event, or ownership.

Calendar export may be off while exact Medicard reminder is on, and vice versa.

Medicard still adds **no** OS Calendar alarms.

---

## Surfaces that must not change

No reminder config/time on Overview, Home, Cycle Calendar, Journal, Quick Log, doctor summary, partner, or Medi/OpenRouter.

No completion inference. No missed-care state. Forecast engine arithmetic unchanged. Dating, timeline, baby-size unchanged.

---

## Analytics

Do not log `careItemId`, `plannedDate`, `plannedTime`, exact fire time, offset, or notification content.

---

## Export / offline / writes

Personal export includes: `reminderEnabled`, `reminderOffset`, `reminderMode`, `exactReminderOffsetMinutes` (actual schema names).

Writes remain **online-required** (Phase 33). No offline scheduler state.

Failed save must not leave the UI falsely enabled. Mode + offset + enabled persist in one PUT so the scheduler never sees mixed config.

---

## Migration

Existing Phase 33 rows: `reminderMode` null → canonical DATE_BASED.

No mass reschedule to `plannedTime`. No owner migration UI.

SQL: `server/prisma/phase36-pregnancy-care-exact-time-reminder.sql`

---

## UI (care-item detail only)

When reminder is on:

- **თარიღით** — existing 0 / 1 / 3 day options
- **დაგეგმილი დროით** — only if `plannedTime` exists

Exact options: at planned time / 30 minutes / 1 hour / 2 hours.

Hint: «შეხსენება გამოიყენებს შენ მიერ მითითებულ თარიღსა და დროს.»

Adding time later only **makes the option available**. It does not activate EXACT_TIME.

Optional preview from the canonical resolver: `შეხსენება: 13:30`

---

## Tests

See `mobile/src/lib/pregnancyCareExactTimeReminderContract.test.js` and planner write tests.

Brain traces: `qa/cycle-phase36-exact-time-reminder/brain-traces.json`

Android shots: `qa/cycle-phase36-exact-time-reminder/`

Phase 37 `plannedPlace` does not enter reminder fire math, candidate identity, or notification copy (`docs/PREGNANCY_CARE_VISIT_PLACE_CONTRACT.md`).
