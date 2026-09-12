# Cycle postpartum return to TRACK — Phase 42

**Status:** CYCLE PHASE 42 — EXPLICIT POSTPARTUM RETURN TO STANDARD CYCLE TRACKING FINAL-FROZEN  
**Date:** 2026-09-11  
**App version:** mobile `65.0.1`  
**iOS QA:** deferred by product decision

Phases 1–41 remain FINAL-FROZEN. Cycle product is not final.

This phase is the **explicit owner return** from `POSTPARTUM` to `TRACK_PERIOD`. It is not fertility return, not ovulation return, not recovery, and not an automatic mode switch.

---

## 1. Mode vs forecast readiness

These are separate.

| Concept | Meaning |
|---|---|
| Standard cycle tracking active | Profile `mode` is genuinely `TRACK_PERIOD` (or later TTC / peri after this return) |
| Forecast sufficiently supported | Server `forecastEligibility.allowed === true` for this postpartum-return provenance |

The owner may choose standard period tracking again. Medicard separately decides whether there is enough **new** owner-classified postpartum menstrual history to produce a forecast without stored averages or the default 28-day fallback.

Automatic readiness satisfaction (once evidence exists) is **not** an automatic mode transition. Mode already changed by explicit owner action.

---

## 2. Explicit owner action only

No automatic `POSTPARTUM → TRACK_PERIOD` because:

- one / two / three periods were classified
- elapsed postpartum time passed
- breastfeeding changed
- a Pregnancy episode ended
- an interval looks regular
- AI inferred anything
- the app believes fertility returned

UI entry (Settings / mode management):

`სტანდარტულ ციკლის აღრიცხვაზე დაბრუნება`

Confirm sheet: postpartum mode ends; standard tracking becomes active; previously owner-classified periods can be used as factual history; predictions may remain unavailable until enough new cycle history exists; this does not determine fertility or ovulation.

Online-required. Failed write stays `POSTPARTUM`. No offline transition queue.

---

## 3. Atomic write

Same `CycleProfile` transaction as existing mode writes:

1. End ACTIVE `CyclePostpartumEpisode` (do not delete; no pregnancy outcome).
2. Set `mode` to the requested non-postpartum mode.
3. Set forecast-gate provenance for **that ended episode**.

Re-entry to `POSTPARTUM` clears the gate and starts a new episode. Later return scopes readiness to the **new** episode. Classifications are not pooled across episodes.

Leaving POSTPARTUM to TTC / peri / pregnancy also sets the gate so a later TRACK/TTC cannot bypass it.

---

## 4. Persistence

Minimal additive `CycleProfile` fields. Never backfilled. Ordinary TRACK users never receive them.

| Field | Meaning |
|---|---|
| `forecastGateKind` | `null` or `POSTPARTUM_RETURN` |
| `forecastGateEpisodeId` | ended postpartum episode that scopes evidence |

Readiness is **derived** from current valid classified history. There is no sticky `forecastReady=true`.

Public `GET /api/cycle` (no episode id, no gate kind on `profile`):

```ts
forecastEligibility: {
  allowed: boolean
  reason: 'STANDARD' | 'POSTPARTUM_HISTORY_INSUFFICIENT' | 'POSTPARTUM_HISTORY_READY'
}
```

| User | Payload |
|---|---|
| Ordinary TRACK (never this transition) | `{ allowed: true, reason: 'STANDARD' }` |
| Postpartum-return, not enough history | `{ allowed: false, reason: 'POSTPARTUM_HISTORY_INSUFFICIENT' }` |
| Postpartum-return, enough valid history | `{ allowed: true, reason: 'POSTPARTUM_HISTORY_READY' }` |

Server is authoritative. Pending ≠ allowed. Cold start must not flash a TRACK 28-day forecast.

---

## 5. Threshold

Canonical engine `inferCycleStats` already requires `gaps.length >= 2` (three period starts → two valid 18–45 day intervals) before inferred averages replace stored/default lengths.

Phase 42 **does not weaken** that. Postpartum-return readiness uses the same minimum, counted only on:

- `source=OWNER`
- `classification=MENSTRUAL_PERIOD`
- the **exited** postpartum episode (`forecastGateEpisodeId`)

Invalid intervals (outside 18–45) do not count.

Does **not** satisfy readiness:

- stored `avgCycleLength`
- default 28-day fallback
- pre-pregnancy menstrual history
- unclassified postpartum bleeding
- classifications from a different postpartum episode
- spotting

Once allowed, canonical `buildPredictions` arithmetic is unchanged (`ovulation = LMP + (cycleLength - 14)`, fertile window, confidence). The gate only decides whether output is eligible.

---

## 6. Two-layer presentation

Phase 27 capability matrix stays **static**.

`supportsCycleCapability(mode, 'showNextPeriodForecast')` **AND** `forecastEligibility.allowed`.

TTC logging remains available. Predictive fertile / ovulation / next-period / late obey the same evidence gate. Switching TRACK → TTC cannot bypass it.

---

## 7. Engine history after TRACK

`engineLogWhere` / unclassified `trackingContext=POSTPARTUM` exclusion stay frozen.

Owner-classified postpartum `PERIOD_FLOW` dates may join factual menstrual history (Phase 41 `forecastLogsForMode`). Unclassified postpartum flow stays excluded unless later classified through historical Day Details.

`trackingContext=POSTPARTUM` is not erased.

Latest owner-classified menstrual start may become factual LMP. Forecast is still blocked until readiness.

While not ready: no next-period prediction, late status, fertile window, ovulation estimate, or `NEXT_PERIOD_START` snapshot. Calendar may show factual bleeding / classified periods. Overview uses:

`ციკლის პროგნოზისთვის ჯერ საკმარისი ახალი ისტორია არ არის.`

Gauge / Home must not show stored or default cycle-length chrome (`28-დან`, `ციკლის დღე X · 28 დღე`, progress ring against that denominator) while `forecastEligibility.allowed === false`. Neutral TRACK state: `ციკლის ახალი ისტორია გროვდება`. Ordinary TRACK and ready postpartum-return TRACK keep the canonical gauge.

No “log 2 more periods” / 1/3 progress bar.

---

## 8. Calendar classified marker

Owner-classified provenance remains visible after TRACK (Phase 41 white inner ring + Day Details badge). Factual period fill also shows the bleed. The ring is retained so classification is not erased by the mode change.

Historical classify / unclassify after TRACK: yes, on postpartum-stamped `PERIOD_FLOW` days only. Ordinary TRACK bleeding does not expose the action. Pregnancy still rejects. Edits recompute readiness and may fail closed.

---

## 9. AI / Brain / partner / doctor / export

- Phase 38 POSTPARTUM AI fail-closed is unchanged **before** transition.
- After TRACK, Medi may know mode is TRACK. ESTIMATED forecast lines (next period / ovulation / fertile / default-28 source) are omitted while `allowed === false`. Same if TTC is entered before ready.
- Notification Brain: no period-soon / start / fertile / ovulation / PMS / late while `forecastAllowed === false`. No “log another period to unlock forecasts” push. `log_nudge` unchanged.
- Partner: no gate metadata. Leak keys include `forecastEligibility` / `forecastGateKind` / `POSTPARTUM_RETURN`.
- Doctor PDF: no forecast-readiness metadata. Phase 39 allowlist unchanged.
- Owner export may include `postpartumReturn` (`kind`, episode id, allowed, reason).
- Analytics: no dates / intervals / LMP / evidence counts.

---

## 10. Related frozen contracts

- Foundation: `docs/CYCLE_POSTPARTUM_MODE_CONTRACT.md`
- Classification: `docs/CYCLE_POSTPARTUM_PERIOD_CLASSIFICATION_CONTRACT.md`
- Capabilities: `docs/CYCLE_MODE_CAPABILITIES_CONTRACT.md`
- Engine: `docs/CYCLE_ENGINE.md`
- Snapshots: `docs/CYCLE_PREDICTION_HISTORY_CONTRACT.md`
- Notification Brain: `docs/CYCLE_NOTIFICATION_CONTRACT.md`
