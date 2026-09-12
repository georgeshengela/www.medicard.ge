# Pregnancy prenatal appointment clock time — Phase 35 contract

**Status:** CYCLE PHASE 35 — OWNER-ENTERED PRENATAL APPOINTMENT TIME FINAL-FROZEN  
**Date:** 2026-09-11  
**App version:** mobile `58.0.0`

Phases 1–34 remain FINAL-FROZEN. This phase does not change catalog windows, dating, timeline, baby-size, observation math, doctor summary, partner, AI, Home, Cycle Calendar, Journal, Quick Log, Notification Brain reminder arithmetic, or forecast arithmetic.

**Related:** `docs/PREGNANCY_CARE_PLANNER_CONTRACT.md`, `docs/PREGNANCY_CARE_CALENDAR_EXPORT_CONTRACT.md`, `docs/PREGNANCY_CARE_REMINDER_CONTRACT.md`, `docs/PREGNANCY_CARE_EXACT_TIME_REMINDER_CONTRACT.md`, `docs/PREGNANCY_CARE_VISIT_PLACE_CONTRACT.md`.

---

## Product purpose

Optional **owner-entered clock time** on an already-planned prenatal care date.

It is user scheduling metadata. It is **not** a medical recommendation, hospital schedule, or appointment engine.

---

## Optional time

Canonical states:

- `plannedDate` + no `plannedTime` → date-only plan (Phase 32/34)
- `plannedDate` + `plannedTime` → timed user plan

No time without a date. Clearing `plannedDate` also clears `plannedTime`.

Never invent `09:00` / `10:00` / `12:00`. Never derive time from catalog, GA, reminders, or previous items.

---

## Storage

Additive nullable `PregnancyCarePlanItemState.plannedTime`.

Canonical format: `HH:mm` (00:00–23:59). No seconds. No timezone offset in the field.

`plannedDate` remains civil `YYYY-MM-DD`. The two are **not** combined into UTC at rest.

Writes stay online-required on the existing care-plan PUT. Date + time resolve atomically (`resolvePlannedDateAndTime`).

---

## Timezone

Storage is local wall-clock, not a hospital timezone.

OS Calendar timed export interprets `plannedDate` + `plannedTime` with the **device local** `Date` constructor (and the destination calendar timezone when Expo supplies one). No geolocation. No clinic lookup.

All-day events keep Phase 34 all-day / next-civil-day semantics.

---

## UI

Time control lives only in care-item detail, under planned date.

Georgian:

- **დაგეგმილი დრო**
- **დროის დამატება** / **დროის შეცვლა** / **დროის წაშლა**

Native 24-hour time picker. Picker cursor may open on the current clock; that is not a stored default.

No “time missing” pressure. Clearing time returns the item to date-only.

---

## Calendar export

| Plan | OS event |
| --- | --- |
| Date only | `allDay = true`, end = next civil day |
| `plannedTime` present | timed start = date + time |

**Technical end:** Expo Calendar requires `endDate`. Medicard uses a **30-minute technical display duration** so the event is not open-ended. This is **not** appointment length. It is not shown in the care-plan UI.

Medicard still adds **no** OS calendar alarms.

Title privacy (generic default) and notes firewall (`Created from Medicard care planner.`) are unchanged.

---

## Explicit calendar update

Adding, removing, or changing time after an export does **not** silently mutate the OS event.

Reuse Phase 34 mismatch UI (`DATE_DIFFERS`):

- date copy, or
- **კალენდარში დაგეგმილი დრო განსხვავდება მიმდინარე დროისგან.**

Then explicit **განახლება**. Same owned event id. No duplicate create.

Local ownership snapshot stores `plannedDate`, `plannedTime`, `exportMode` (`ALL_DAY` | `TIMED`). Still device-local. No `calendarEventId` on the server.

---

## New export eligibility

Past civil date: no new export (Phase 34).

Today + date-only: all-day export allowed.

Today + future `plannedTime`: timed export allowed.

Today + past `plannedTime`: **no new V1 export** (avoid retroactive appointment rows). Existing events stay until explicit update/remove.

`reviewRequired` and outside-window dates: still allowed; export uses the owner’s date/time unchanged.

---

## Phase 33 reminders

DATE_BASED fire date = `plannedDate` minus offset at 09:00 local. `plannedTime` is ignored for that mode. Adding time does **not** auto-upgrade the reminder.

Phase 36 optional exact-time Medicard reminders require an explicit owner `EXACT_TIME` selection (`docs/PREGNANCY_CARE_EXACT_TIME_REMINDER_CONTRACT.md`). Calendar time and Notification Brain remain separate. Medicard still adds no OS calendar alarms.

Phase 37 optional `plannedPlace` is independent owner text (`docs/PREGNANCY_CARE_VISIT_PLACE_CONTRACT.md`). It does not change `plannedTime` storage or Calendar timed-export semantics. Clearing the date also clears place.

---

## Privacy / surfaces

Owner-only. Personal export **includes** `plannedTime`.

Not partner, not doctor summary, not Medi/OpenRouter, no appointment telemetry.

No Overview / Home / Journal / Quick Log / Cycle Calendar time controls.

COMPLETED / DISMISSED / NOT_APPLICABLE / CLEAR / episode end do not auto-delete OS events. CLEAR deletes planner row (date+time) but not the OS event.

Multi-device / uninstall / wipe: same as Phase 34.

---

## Tests

See `mobile/src/lib/pregnancyCareAppointmentTimeContract.test.js` and planner write tests.

Native Android Calendar provider proof: `qa/cycle-phase35-appointment-time/`.
