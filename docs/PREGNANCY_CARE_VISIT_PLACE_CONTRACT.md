# Pregnancy prenatal visit place — Phase 37 contract

**Status:** CYCLE PHASE 37 — OWNER-ENTERED PRENATAL VISIT PLACE FINAL-FROZEN  
**Date:** 2026-09-11  
**App version:** mobile `60.0.0`

Phases 1–36 remain FINAL-FROZEN. This phase adds **one** capability: an optional owner-entered **visit place** string on a planned prenatal care item.

Not a location engine. Not a facility record. Not a clinic directory. Not geolocation.

**Related:** `docs/PREGNANCY_CARE_PLANNER_CONTRACT.md`, `docs/PREGNANCY_CARE_APPOINTMENT_TIME_CONTRACT.md`, `docs/PREGNANCY_CARE_EXACT_TIME_REMINDER_CONTRACT.md`, `docs/PREGNANCY_CARE_CALENDAR_EXPORT_CONTRACT.md`, `docs/PREGNANCY_CARE_REMINDER_CONTRACT.md`.

---

## Product purpose

Optional `plannedPlace` is **user-authored organizational metadata**.

Examples the owner may type: `CHC MontLégia`, `Radiologie — Route 400`, `Dr Martin`, `ტელეკონსულტაცია`.

Medicard never implies the place is verified, matched, geocoded, confirmed, booked, affiliated, or recommended.

Meaning remains `USER PLAN`. Never a confirmed appointment.

---

## User-entered text only

- Plain text. No HTML/Markdown rendering.
- URLs stay text. No auto-open or fetch.
- Phone numbers stay text. No call button.
- No address parsing (hospital / street / city / room).
- No provider inference from the string.

---

## Not verified

Do not prepend “Verified”, “Clinic”, or “Hospital” unless the owner typed those words.

UI copy: **ვიზიტის ადგილი** / “შენ მიუთითე ადგილი”. Never “Your appointment is at…”.

---

## No geolocation / maps / clinic search

Phase 37 does **not**:

- request GPS / foreground / background / precise location
- call device location APIs
- geocode via Google / Mapbox / OSM / Apple / OpenRouter
- offer hospital/doctor/clinic autocomplete
- show a map
- persist latitude, longitude, placeId, Google Place ID, or OSM id

Storage is `plannedPlace String?` only.

---

## Length and normalization

- Max **160** Unicode code points.
- Trim leading/trailing whitespace.
- Collapse accidental internal whitespace and newlines to a single space (single-line field). Longer free text stays in the private note.
- Empty / whitespace-only → `null`.
- Punctuation is not rewritten.
- Georgian, Latin, Cyrillic, French accents, ordinary Unicode. Emoji not specially blocked.
- XSS-like strings such as `<script>alert(1)</script>` persist and display as plain `Text`. Never execute.

---

## Date dependency

`plannedPlace` may exist only when `plannedDate` exists.

Clearing `plannedDate` also clears `plannedTime` (Phase 35) and `plannedPlace`, then follows frozen reminder invalidation.

Place-only edit does not change date or time. Date change keeps place unless the date is cleared.

---

## Atomic write

Reuse `PUT /api/cycle/pregnancy/care-plan/:careItemId`. No new endpoint.

Date / time / place persist in one planner write. Failed save must not leave unsaved place looking persisted.

Reads: additive `userState.plannedPlace`.

---

## Private note separation

`plannedPlace` ≠ private planner note. Different product meaning. Do not merge.

---

## UI

Care-item detail only, after date and time:

1. Planned date  
2. Planned time  
3. Visit place (`ვიზიტის ადგილი`)  
4. Existing reminder / calendar controls  

Optional. Never “Add location to complete your appointment.” Clear: **ადგილის წაშლა**.

Placeholder example only: `მაგ. CHC MontLégia — Radiologie` — not a medical recommendation.

Saved value wraps (2–3 lines). No map, directions, or “near me”.

Not on Overview, Home, Cycle Calendar, Journal, Quick Log, or timeline.

---

## Reminder independence

`plannedPlace` does **not** affect Phase 33 DATE_BASED or Phase 36 EXACT_TIME:

- fire time
- candidate identity / dedupe
- lock-screen copy (masked or unmasked)

Do not put place on the lock screen. Do not attach place to notification telemetry.

Notification Brain is unchanged.

---

## Calendar exclusion

Phase 34/35 Calendar payload is unchanged.

Do **not** export `plannedPlace` into OS Calendar title, notes, `location`, `structuredLocation`, or URL.

Changing place does **not** mark the OS event out of sync (place is not part of the exported payload).

A future explicit “Include place in calendar” is out of scope.

No navigation / Maps button.

---

## Privacy / firewalls

Owner-only planning data.

| Surface | `plannedPlace` |
| --- | --- |
| Personal export | **included** (user-entered text, not verified facility metadata) |
| Partner | absent |
| Medi / OpenRouter | absent |
| Doctor summary / PDF | absent |
| Analytics / search index / production logs / error telemetry | absent |
| Notification candidate | absent |

---

## Lifecycle

| Event | Place |
| --- | --- |
| COMPLETED | kept as historical owner metadata |
| DISMISSED / NOT_APPLICABLE | existing planner semantics; not shown elsewhere |
| CLEAR | deleted with the planner row |
| Episode end | retained on that episode’s rows; no leak to a new episode |
| New pregnancy | clean planner; no carryover |
| Cross-user | scoped by `userId` |
| Logout | no stale flash (load is user-scoped) |
| Account wipe | server field goes with planner state |
| OS Calendar on wipe | unrelated (Phase 34) |

---

## Multi-device vs Calendar

`plannedPlace` is **server planner state** and may sync across the owner’s devices.

Phase 34 Calendar event ownership remains **device-local**. Place never writes into that event.

---

## Offline

Writes remain online-required. No offline write engine. Cached confirmed state may display place for the current user only.

---

## Dating / reviewRequired / windows

`reviewRequired` still allows manual date/time/place. No computed timing.

Outside-window dates keep the user string intact.

Past plans: no new medical warning.

`ტელეკონსულტაცია` is valid free text. A home address typed by the owner is stored as text and is **not** geolocated.

---

## Capability / registry

Reuse `showPregnancyCarePlanner`. No new mode capability. Do not put place into the observation registry.

---

## Tests / QA

See `mobile/src/lib/pregnancyCareVisitPlaceContract.test.js` and planner write/privacy tests.

Android shots: `qa/cycle-phase37-visit-place/`

Firewall traces: `qa/cycle-phase37-visit-place/firewall-traces.json`
