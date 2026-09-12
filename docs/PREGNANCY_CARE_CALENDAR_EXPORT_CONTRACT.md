# Pregnancy prenatal care OS calendar export — Phase 34 contract

**Status:** CYCLE PHASE 34 — OWNER-OPTED PRENATAL CARE CALENDAR EXPORT FINAL-FROZEN  
**Date:** 2026-09-10  
**App version:** mobile `57.0.0`

Phases 1–33 remain FINAL-FROZEN. This phase does not change catalog windows, dating, timeline, baby-size, observation math, doctor summary, partner, AI, Home, Cycle Calendar, Journal, Quick Log, Notification Brain, or forecast arithmetic.

**Related:** `docs/PREGNANCY_CARE_PLANNER_CONTRACT.md`, `docs/PREGNANCY_CARE_REMINDER_CONTRACT.md`, `docs/PREGNANCY_CARE_APPOINTMENT_TIME_CONTRACT.md`.

---

## Product purpose

One-way **local device** export of a **user-planned** prenatal care date to the OS Calendar.

It is an export/integration feature. It is **not** a medical scheduling engine.

Meaning: the owner already chose `plannedDate`. Medicard may create an all-day OS event for that date after an explicit tap.

Not: catalog-due, IN/BEFORE/AFTER_WINDOW, inferred appointment, completion, or missed care.

---

## One-way export

Medicard creates OS events. It does **not** import OS calendar events back into the care planner.

No background watcher. No polling. No event observer. No sync loop.

---

## Explicit opt-in

Export requires a separate tap: **კალენდარში დამატება**.

Do **not** export when:

- `plannedDate` is saved
- Phase 33 reminder is enabled
- the item becomes IN_WINDOW
- Pregnancy mode starts

V1 does **not** silently keep care-plan items synchronized with OS Calendar.

---

## User-planned date only

No `plannedDate` → no calendar export.

Catalog timing (`BEFORE_WINDOW` / `IN_WINDOW` / `AFTER_WINDOW`) is informational only and never creates an OS event.

`reviewRequired` does **not** block export of a user-owned `plannedDate`. Export uses that date, not computed GA.

Outside-window planned dates export unchanged. Calendar UI does not add a second warning beyond existing planner copy.

---

## All-day, no invented time

Phase 32/33 `plannedDate` is civil `YYYY-MM-DD`.

V1 creates an **all-day** event for that date. End date is the next civil day (exclusive).

Do **not** invent 09:00–10:00. Phase 33 reminder daypart (09:00) is a different concept.

Date-only plans remain all-day. Optional owner-entered `plannedTime` (`HH:mm`) is Phase 35 (`docs/PREGNANCY_CARE_APPOINTMENT_TIME_CONTRACT.md`): timed OS events only after the owner enters a clock, never as a default.

Today is allowed as an all-day event. Past dates: **no new V1 export**. Already-exported past events stay until the owner updates or removes them.

---

## Privacy title

Calendar titles can appear on widgets, lock screens, car displays, and shared calendars.

**Default title:** `Medicard — დაგეგმილი ვიზიტი`

Do **not** default to pregnancy / ultrasound / GBS / genetic screening names.

**Detailed title** (`Medicard — [care item title]`) only if the user explicitly chooses it per export.

Notification privacy / mask settings are **not** reused for calendar titles.

---

## Event notes

Default notes: `Created from Medicard care planner.`

Never copy:

- `PregnancyCarePlanItemState.note`
- pregnancy week
- medical history
- symptom data
- source URLs

Sources stay inside Medicard.

---

## Permissions

Calendar permission is separate from notification permission.

Copy:

> კალენდარში შენ მიერ არჩეული ჩანაწერის დასამატებლად საჭიროა კალენდარზე წვდომა.

Do **not** say Medicard needs access to “your appointments.”

Request Calendar read/write only (needed to pick a writable destination and manage the owned event). Do not request Contacts or iOS Reminders.

Request only on the explicit Add tap (not on screen open, not on a timer). Do not nag after denial. A later Add tap is a user retry, not a background prompt.

If denied: do not claim success. Care-plan state is unchanged.

If later revoked: do not claim Medicard can still update or remove the OS event.

---

## Calendar selection

List calendars only to pick a **writable destination**. Never search event titles.

Prefer `isPrimary`, then a local account, then owner-access. Do not silently pick contributor/editor/shared calendars when a safer writable calendar exists.

If the user later puts the event on a shared calendar themselves, that is their choice.

V1 does not ship a calendar-account manager.

---

## Event ownership (device-local)

Stored **on device**, user-scoped preference `medicard.pregnancy.careCalendar.v1.{userId}`:

- `eventId`
- `calendarId`
- `plannedDate` at export time
- `titleMode`
- `exportedAt`

Keyed by `userId + pregnancyEpisodeId + careItemId`.

**Not** on `PregnancyCarePlanItemState`. Not in the personal health API. Not synced across devices.

An iOS/Android event ID is meaningful only on the device that created it. A new device has no local ownership of an old-device event. Do not pretend export status is global.

---

## Duplicate prevention

If Medicard still has a valid owned event for this user / episode / item / date: do not create another.

Identity: user + Pregnancy episode + `careItemId` + `plannedDate` + device-local event id.

---

## Date change / explicit update

If the owner changes `plannedDate` after export: **do not** silently mutate the OS event.

Show:

> კალენდარში შენახული თარიღი განსხვავდება მიმდინარე დაგეგმილი თარიღისგან.

Then **განახლება** as an explicit action.

Users may have edited the OS event. An explicit Update may overwrite Medicard-owned fields (date / title / notes). Localization or catalog rename does not auto-rename old events.

---

## Manual OS deletion

If `getEventAsync` cannot find the owned id: clear the local reference. Do **not** recreate automatically. Offer Add again.

Copy: **კალენდარში აღარ არის**

---

## Remove

**კალენდარიდან წაშლა** deletes only the event Medicard created.

---

## Status / episode / wipe

COMPLETED, DISMISSED, NOT_APPLICABLE, CLEAR, and Pregnancy episode end **must not** automatically delete the OS event. Calendar data is now the user’s.

Medicard stops presenting active planner integration when the episode is no longer active. Historical OS events remain.

A new Pregnancy episode does not inherit old event ownership.

Account wipe / Cycle wipe: delete **local ownership metadata only**. Do **not** delete OS events unless the user explicitly asked beforehand.

App uninstall: Medicard-created OS events remain. Expected.

---

## Cross-user / logout

Ownership is user-scoped. Logout sets the local account id to null so User B cannot read User A’s keys. No A→B flash.

---

## Phase 33 reminder separation

Export must not enable, disable, or change `reminderEnabled` / `reminderOffset`.

Medicard does **not** add OS calendar alarms (`alarms: []`). If the OS calendar app itself applies user-default alerts, that is calendar behavior, not a second Medicard reminder.

---

## No inference

Event existing, date passing, or the event being opened does **not** mean the appointment happened.

Do not label missed / overdue / did not attend.

Calendar events never auto-mutate PLANNED / COMPLETED / DISMISSED / NOT_APPLICABLE.

---

## Surfaces

Only care-item detail (`/cycle/pregnancy/care-plan` sheet).

No export buttons on Overview, Home, Journal, Quick Log, or Cycle Calendar.

No new deep link. No Cycle Calendar rendering of these OS events.

Capability: reuse `showPregnancyCarePlanner`. No new Phase 27 capability.

---

## Firewalls

- **AI / Medi / OpenRouter:** no calendar metadata
- **Partner:** no calendar state
- **Doctor summary:** no event ids or export status
- **Analytics:** no `calendarEventId`, `careItemId`, `plannedDate`, week, or title. No new analytics event in V1
- **Personal export:** no device-local `calendarEventId`. `plannedDate` already exports

---

## Offline

OS calendar create is local. If the care-plan item with `plannedDate` and `pregnancyEpisodeId` is already loaded for the current user, export may proceed without a new backend round-trip.

Do not export from stale cross-user state. Educational offline catalog with no episode id cannot export.

---

## Native library

`expo-calendar` `~57.0.3` (`createEventAsync` / `getEventAsync` / `updateEventAsync` / `deleteEventAsync`).

Android QA is required. iOS QA is deferred by product decision.

---

## Tests (A–Z)

See `mobile/src/lib/pregnancyCareCalendarExportContract.test.js`.

Native Android Calendar provider QA (create / all-day date / generic title / no Medicard alarm / update owned only / delete owned only) is recorded under `qa/cycle-phase34-care-calendar/`.

Phase 37 optional `plannedPlace` is **not** written to OS Calendar `location`, notes, URL, or title (`docs/PREGNANCY_CARE_VISIT_PLACE_CONTRACT.md`). Changing place does not create a Calendar mismatch.
