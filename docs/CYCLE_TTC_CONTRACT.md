# Cycle TTC contract — Phase 16 + Phase 17 freeze

**Status:** CYCLE PHASE 16 — TTC MODE FOUNDATION FINAL-FROZEN. CYCLE PHASE 17 — TTC COLD-START RELIABILITY QA COMPLETE. Not Cycle-product-final.  
**Date:** 2026-09-09  
**App version:** mobile `40.0.1`

Mode changes **presentation / user goal**. It does **not** change cycle arithmetic in this phase.

Canonical field: `CycleProfile.mode` (`TRACK_PERIOD` | `TRY_TO_CONCEIVE` | `PREGNANCY`). There is no second `isTtc` boolean.

---

## Purpose

Trying-to-conceive (TTC) helps a user who is actively trying to conceive:

- understand current cycle context
- record fertility observations (OPK, BBT, cervical mucus, pregnancy test)
- see **estimated** fertile days honestly
- review those observations chronologically
- distinguish estimates from user-recorded evidence

TTC is not a fertility diagnosis system and not a conception-probability calculator.

---

## Non-goals

Not in Phase 16:

- conception probability, scores, “peak fertility”, “best day”, “you ovulated”
- OPK / BBT / mucus / intercourse feeding the forecast engine
- OpenRouter Cycle AI / Medi fertility AI
- Pregnancy product mode (architecture only)
- Perimenopause mode
- new TTC push copy such as “have sex today”
- expanding Phase 13 generic `trendEligible` to fertility fields
- new database tables

---

## Mode semantics

| Mode | Live product | Forecast engine |
|---|---|---|
| `TRACK_PERIOD` | yes | flow-only, unchanged |
| `TRY_TO_CONCEIVE` | yes (this phase) | **identical** to Track Period |
| `PREGNANCY` | architecture only | do not auto-enter from a test |
| Perimenopause | architecture only | not implemented |

Capabilities live in `server/src/lib/cycleModes.js` (`capabilitiesForProfileMode`). Mobile mirrors presentation flags in `mobile/src/lib/cycleModes.js`.

TTC capabilities: `showTtcOverview`, `showFertilityShortcuts`, `showFertilityHistory`, `showBbtHistory`, `showOpkHistory`, `showPregnancyTestLog`.

**Phase 27:** the four-mode presentation matrix is `docs/CYCLE_MODE_CAPABILITIES_CONTRACT.md`. Do not scatter `if (mode === 'TRY_TO_CONCEIVE')` in Cycle presentation files.

---

## Mode switching

Entered explicitly: Cycle Settings → tracking goal → Trying to conceive → compact onboarding → Save.

Not switched by: OPK positive, pregnancy test, sexual activity, fertile-day estimate.

`PUT /api/cycle/profile` writes `mode` only. Unknown mode → 400. Setting TTC twice is idempotent. History is preserved both directions (`TRACK_PERIOD` ↔ `TRY_TO_CONCEIVE`).

Mode changes require network. Offline mode switch is not a new queue: fail clearly and keep the current mode.

---

## History preservation

Switching modes must not delete period logs, symptoms, pain, observations, prediction snapshots, Journal history, or doctor-summary history. TTC-specific observations remain owner data; they become less prominent in Track Period.

---

## Estimate honesty

Predicted fertile window and ovulation date may be **displayed** in TTC. They remain estimates:

- Georgian: `სავარაუდო ნაყოფიერი დღეები`, `სავარაუდო ოვულაცია`
- visual language stays violet / dashed / `~`
- never render estimates as logged biological facts
- LOW confidence / irregular history reuses the frozen LOW contract; TTC must not look more certain than Track Period

Pattern on Overview and Day Details: **სავარაუდო** vs **თქვენ აღრიცხეთ**.

---

## Observations (user-logged, not interpreted)

| Field | Values | Phase 16 rule |
|---|---|---|
| OPK / LH | negative, positive, unclear | evidence only; positive ≠ confirmed ovulation |
| BBT | 34–42 °C, one per civil day | raw history; no coverline / thermal shift |
| Cervical mucus | dry, sticky, creamy, watery, eggwhite | observation; eggwhite ≠ fertile |
| Pregnancy test | negative, positive, unclear | no diagnosis; no mode switch |
| Sexual activity | optional, Private | never a dashboard KPI; no timing score |

BBT chart: 0 = empty, 1–2 = list, ≥3 = sparse line/points. Missing days are gaps, not interpolated. Label: basal temperature history, not “ovulation chart”.

Positive pregnancy test: log the fact and explain that app mode has not changed. No confetti. No Pregnancy-mode workflow from the log screen.

---

## UI architecture

Reuse Overview / Calendar / Journal. No fourth tab. No separate TTC app.

- Overview: existing hero + one fertility-context strip (`CycleTtcCard`) + existing content
- Quick Log: ordinary logging plus compact `ნაყოფიერების ჩანაწერები` (OPK, BBT, mucus, pregnancy test)
- More Tracking: same canonical CycleLog fields (no duplicate persistence)
- Calendar: frozen hierarchy (logged period → today/selection → predicted estimate → subordinate observation dots). No seven competing symbols
- Day Details: Logged / Estimated / Private
- Journal: TTC-only timeline + BBT history when mode is TTC. Phase 13 generic observation trends stay unchanged
- Home: small TTC label only; no OPK/BBT/sex on global Home
- Settings: tracking goal, existing OPK/BBT reminder prefs if user enables them, privacy

---

## Read model

`GET /api/cycle/ttc` (owner-only, `private, no-store`):

- `mode`, `capabilities`, `cycleContext`
- `fertilityEstimate` (pass-through from existing predictions; `estimated: true`; unavailable when LIMITED)
- `todayLogged`, `timeline` (newest first, 180-day window)
- `bbtHistory`, `opkHistory`, `mucusHistory`, `pregnancyTestHistory`

Writes stay on existing profile + log endpoints. Mobile does not calculate ovulation, fertile window, or cycle day.

---

## Auth readiness and query lifecycle (Phase 17)

TTC uses the same authenticated `api` + `getToken()` lifecycle as `GET /api/cycle`. There is no TTC-specific token store and no refresh-token retry (the shared API has none).

Gate for `GET /api/cycle/ttc`:

- auth hydrated (`AuthContext.ready`)
- authenticated owner (`user.id`)
- server Cycle profile `mode === TRY_TO_CONCEIVE`
- Cycle reachable (not the offline-cache-only path)

Do not fetch in `TRACK_PERIOD`, architecture-only `PREGNANCY`, or logged-out. Do not infer TTC from stale client flags before the Cycle profile response exists.

Overlapping loads use a generation counter so a stale 401 cannot overwrite a later 200. Failures are never stored as a legitimate empty payload.

### Loading vs empty vs error

| State | UI |
|---|---|
| request not run / in flight | compact loading — never “ნაყოფიერების ჩანაწერი ჯერ არ არის” |
| authenticated 200 with empty timeline | real empty |
| authenticated failure | TTC section soft-fails; Overview stays up; retry via existing `load()` |

Logout and user switch immediately scope/clear the TTC query so user A history cannot flash in user B.

---

## Privacy / AI / partner / analytics / doctor summary / notifications

Unchanged firewalls:

- sexual activity stays off AI, partner, analytics, push, generic recents unless a frozen explicit consent already says otherwise
- entering TTC does **not** add BBT, mucus, sexual activity, or pregnancy tests to the AI allowlist
- existing USER_LOGGED OPK / pregnancy-test EvidenceMD line is not widened
- partner payload leak keys unchanged
- doctor-summary fertility inclusion stays document-scoped and default OFF even in TTC
- personal export unchanged
- analytics: do not log mode value or raw OPK/BBT/mucus/sex/pregnancy results in ProductEvent
- Notification Brain remains sole authority. **Zero new TTC candidates.** Existing optional OPK/BBT reminder prefs stay in Brain. Never “have sex today” / “best chance”
- privacy mask: no TTC-specific lock-screen health text

---

## Contraception

Do not silently clear contraception. Hormonal method + TTC shows a conflict prompt. LIMITED fertility suppression is frozen and wins: TTC must not force fertile-window markers onto the screen.

---

## Offline / civil dates

Existing Cycle offline `UPSERT_LOG` already covers OPK, BBT, mucus, pregnancy test. No TTC-specific timezone. Civil `YYYY-MM-DD` identity unchanged (DST / month / year / Europe/Brussels / Asia/Tbilisi fallback remain the Cycle clock).

BBT gaps: consecutive civil days may be connected; a missing day is a break in the line.

---

## Safety

TTC mode does not provide medical diagnosis.

Cycle estimates do not guarantee ovulation.

Positive OPK does not confirm ovulation.

BBT is not interpreted in Phase 16.

Cervical mucus is user-recorded.

Intercourse timing is not converted into conception probability.

Pregnancy tests are user-entered records.

---

## Future engine extensions

Not started: confirmed ovulation, coverline, conception probability, pregnancy-mode transition, TTC-specific Notification Brain campaigns.
