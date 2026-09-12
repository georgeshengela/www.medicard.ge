# Pregnancy prenatal care reminders — Phase 33 contract

**Status:** CYCLE PHASE 33 — USER-OPTED PRENATAL CARE REMINDERS FINAL-FROZEN  
**Date:** 2026-09-10  
**App version:** mobile `56.0.0`

Phases 1–32 remain FINAL-FROZEN. This phase does not change catalog windows, dating, timeline, baby-size, observation math, doctor summary, partner, AI, Home, Calendar, Journal, Quick Log, or forecast arithmetic.

**Related:** `docs/PREGNANCY_CARE_PLANNER_CONTRACT.md`, `docs/CYCLE_NOTIFICATION_CONTRACT.md`, `docs/PREGNANCY_CARE_CALENDAR_EXPORT_CONTRACT.md`, `docs/PREGNANCY_CARE_APPOINTMENT_TIME_CONTRACT.md`, `docs/PREGNANCY_CARE_EXACT_TIME_REMINDER_CONTRACT.md`.

---

## Product purpose

Scheduling support for a date the **user already planned**.

Meaning: `USER_PLANNED_EVENT`  
Not: `MEDICAL_DUE_ITEM`

Never notify because a source-backed window is IN/BEFORE/AFTER_WINDOW.

---

## Explicit opt-in

Default: **OFF**. Saving `plannedDate` does not enable reminders.

The user must tap **შემახსენე** separately. No global auto-enable from notifications, Pregnancy mode, or catalog windows.

---

## Planned date only

Reminder date = user `plannedDate` minus offset (0 / 1 / 3 civil days).

Never derived from startWeek, endWeek, current GA, due date, or timing relation.

---

## Notification Brain ownership

The Brain is the sole delivery authority.

- No Expo/FCM/APNs/cron/care-planner send outside Brain scheduling + `shouldDeliverNotification`.
- Implementation: local DATE alarm (same pattern as Cycle `period_soon`), prefix `pregnancy_care:`.
- Family: `pregnancyCareReminder`
- Type: `pregnancy_care_plan`
- Daypart: 09:00 local, then frozen quiet-hour bump. Not an invented appointment clock.
- Quiet hours: `bumpOutOfQuiet` — no bypass.
- Caps: **not** Engage daily pool. **not** medication channel.
- Priority: not emergency/critical.

---

## Revalidation (send time)

Immediately before show:

- same user
- mode is `PREGNANCY`
- ACTIVE episode matches `episodeId`
- catalog item still renderable
- status still `PLANNED`
- `plannedDate` unchanged
- reminder still enabled
- not COMPLETED / DISMISSED / NOT_APPLICABLE / CLEAR
- fire time not in the past (no catch-up)

---

## Dedupe

`pregnancy_care:{userId}:{episodeId}:{careItemId}:{plannedDate}:{offset}`

Changing date or offset creates a new identity. Sync cancels the prefix then rebuilds — no double push.

---

## Status / lifecycle

| Event | Reminder |
|---|---|
| COMPLETED | suppress |
| DISMISSED | suppress |
| NOT_APPLICABLE | suppress |
| CLEAR | suppress |
| reminder off | cancel immediately |
| plannedDate change | old candidate cannot send |
| Pregnancy / episode end | suppress |
| New episode | no carryover |
| Cross-user | reject |

---

## Privacy

Default Cycle lock-screen mask applies (`maskNotifications` / privacy / discreet).

Masked body: “შენი დაგეგმილი მოვლის შეხსენება” — no pregnancy/scan title.

Unmasked (user disabled Cycle lock-screen mask): user-plan copy with care-item title. No “დროა / გჭირდება / აუცილებელია / ვადა / აგვიანდება”.

No lock-screen complete actions.

---

## Deep links

`/cycle/pregnancy/care-plan?item=:careItemId`

Guarded by Pregnancy planner capability + ACTIVE episode. Stale/completed/ended → planner list, no medical warning.

---

## UI

Only inside the Phase 32 care-item detail. Not Overview / Home / Journal / Quick Log / Calendar.

No reminder if there is no saved planned date. No reminder controls on COMPLETED / DISMISSED / NOT_APPLICABLE.

OS permission ≠ reminder preference. Denied permission stores the preference and says device notifications are off. No false “will send”. No permission spam.

---

## Offline / errors

Writes remain **online-required**. Failed save must not appear enabled. Cached catalog may show last-known preference; do not claim a reminder is scheduled until synced.

---

## Firewalls

| Channel | Reminder |
|---|---|
| Partner | not exposed |
| Medi / OpenRouter | not sent |
| Doctor summary | not included |
| Analytics | pregnancy-care keys redacted like Cycle |
| Personal export | reminderEnabled + reminderOffset |
| Wipe | episode/user cascade + OS cancel + send-time revalidation |

---

## Past / today-late

Past `plannedDate`: planner state allowed; no retrospective push.

If fire clock for today has already passed: no surprise catch-up.

---

## Future source review

If `careItemId` leaves a later catalog, fail closed — no reminder for obsolete items. Stable IDs.

---

## Phase 34 OS calendar export

Owner-opted OS Calendar export is a separate local integration (`docs/PREGNANCY_CARE_CALENDAR_EXPORT_CONTRACT.md`). It must not enable, disable, or change `reminderEnabled` / `reminderOffset`. Medicard does not add OS calendar alarms. Notification Brain remains the reminder authority.

Phase 35 optional `plannedTime` does **not** change DATE_BASED reminder fire date or 09:00 daypart. Adding time never auto-upgrades the reminder.

Phase 36 adds an optional **explicit** `EXACT_TIME` mode (`docs/PREGNANCY_CARE_EXACT_TIME_REMINDER_CONTRACT.md`). DATE_BASED 09:00 semantics in this contract remain frozen.

Phase 37 optional `plannedPlace` does not enter fire math, candidate identity, or notification copy (`docs/PREGNANCY_CARE_VISIT_PLACE_CONTRACT.md`).

