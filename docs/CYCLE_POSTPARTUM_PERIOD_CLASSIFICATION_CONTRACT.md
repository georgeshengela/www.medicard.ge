# Cycle postpartum period classification — Phase 41

**Status:** CYCLE PHASE 41 — OWNER-CLASSIFIED RETURN OF PERIOD FINAL-FROZEN  
**Date:** 2026-09-11  
**App version:** mobile `64.0.0`  
**iOS QA:** deferred by product decision

Phases 1–40 remain FINAL-FROZEN. Cycle product is not final.

This phase is **explicit owner classification** of a postpartum bleed episode as a menstrual period. It is not forecast reactivation, not a diagnosis, not lochia, and not fertility return.

---

## 1. Why menstruation copy was unsafe — and why classification is opt-in

Phases 38–40 keep postpartum bleeding as a **bleeding fact**. Medicard must not guess whether it is menstruation, lochia, or another bleed.

Phase 41 lets the **owner** supply that missing semantic:

`ეს ჩემი მენსტრუაცია იყო`

Absence of classification remains **UNKNOWN**. `false` is not stored. Medicard does not infer from flow, duration, timing, or history.

---

## 2. Neutral default

Unclassified postpartum flow stays:

- label `სისხლდენა`
- excluded from menstrual engine input (`engineLogWhere` / `filterLogsForEngine` unchanged)
- not lochia, not PPH, not “period has returned”

V1 classification is only `MENSTRUAL_PERIOD`. No LOCHIA / PPH / breakthrough / implantation / hormonal categories.

---

## 3. Episode identity

Bleed grouping reuses the frozen engine rule in `inferCycleStats` / `canContinuePeriod`:

- `PERIOD_FLOWS` = `light | medium | heavy` (unchanged)
- spotting is not a period day and is not a classifiable episode by itself
- consecutive bleed (and at most one interior missing/spotting day, span ≤ 10) is **one episode**

The owner classifies the **resolved episode**, not each day. Identity is:

`(userId, postpartumEpisodeId, bleedStart)`

where `bleedStart` is the first PERIOD_FLOW day of the run.

`classifiedPeriodFlowDates` accepts both engine run `{start,end}` and persisted keep-rows `{bleedStart,bleedEnd}`, and always stores civil `YYYY-MM-DD` keys (Prisma `Date` objects are normalized).

---

## 4. Persistence

Additive table `CyclePostpartumBleedClassification`:

| Field | Meaning |
|---|---|
| userId | owner |
| postpartumEpisodeId | tracking interval the logs were stamped with |
| bleedStart / bleedEnd | current reconciled run |
| classification | `MENSTRUAL_PERIOD` |
| source | `OWNER` |
| classifiedAt | when the owner confirmed |

Unique `(userId, postpartumEpisodeId, bleedStart)`. No flow-enum override. Existing unclassified rows are not backfilled.

SQL: `server/prisma/phase41-postpartum-bleed-classification.sql` (`prisma db execute`). Cascade delete with the postpartum episode. Deleting logs does **not** cascade; reconciliation drops orphans.

---

## 5. Reconciliation

After log edits / GET:

1. **Exact `bleedStart` match** → KEEP. `bleedEnd` tracks the current run (shrink or continue).
2. **Start day removed, unique overlapping run is a subset of the stored range** → KEEP, update start/end (same episode, shorter).
3. **No overlapping run** → DROP (orphan).
4. **Two or more overlapping runs (split)** → DROP if the original start is gone; if the original start still exists, KEEP only that fragment. Never duplicate a second classification onto the other fragment.
5. **One overlapping run that extends outside the stored range** → DROP (ambiguous merge). Owner must reconfirm.
6. **Nearby non-overlapping run** → DROP. No date-proximity jump.

---

## 6. Undo

`მონიშვნის გაუქმება` deletes the classification row. Idempotent. Bleed facts remain.

Classify is idempotent: repeat PUT does not duplicate.

---

## 7. Mode

Classification does **not** switch `POSTPARTUM` → `TRACK_PERIOD` or TTC.

The owner stays in POSTPARTUM until they change mode in Settings.

Ended postpartum episodes **keep** historical classification rows. Re-entry creates a new `CyclePostpartumEpisode`; old classifications are not “current.”

---

## 8. Engine vs forecast

| Path | POSTPARTUM | After explicit TRACK/TTC/PERI switch |
|---|---|---|
| Unclassified postpartum flow | excluded | excluded |
| Owner-classified PERIOD_FLOW days | **history only** (not forecast input) | may join factual menstrual history / forecast input |
| `engineLogWhere` | unchanged (all `trackingContext=POSTPARTUM` excluded) | unchanged |
| `PERIOD_FLOWS` / `buildPredictions` formulas | unchanged | unchanged |

While mode is POSTPARTUM:

- `showNextPeriodForecast = false`
- `showLatePeriod = false`
- `showFertileEstimates = false`
- `showOvulationEstimate = false`
- `shouldObservePrediction(POSTPARTUM)` remains false — **no `NEXT_PERIOD_START` snapshot from classification**

One classified episode is not enough for cycle length (needs ≥2 in-band gaps). Phase 41 does not create a postpartum forecast.

LMP: classified starts are **factual menstrual-history candidates**. They do not drive POSTPARTUM forecast presentation. After an explicit switch to TRACK, the frozen TRACK path may use them as prior period history. The mode-switch **transaction** does not insert prediction snapshots; a later TRACK bundle load may observe snapshots under existing Phase 8 rules.

---

## 9. Surfaces

**Journal:** episode block, flow facts, badge `შენ მონიშნე როგორც მენსტრუაცია`, action `ეს ჩემი მენსტრუაცია იყო`. Confirmation sheet explains: owner mark only; no fertility/ovulation inference; no postpartum forecast.

**Calendar:** factual white inner ring on logged bleed (not dashed prediction). Legend: `მენსტრუაციად მონიშნული`. A11y: `მენსტრუაციად მონიშნული სისხლდენა`.

**Day Details:** `შენ მონიშნე როგორც მენსტრუაცია` via `postpartumClassifiedBadge`. Never “Medicard detected your period.” Informal `შენ` matches the rest of Cycle postpartum copy.

**Overview:** at most one compact line `ბოლო სისხლდენა შენ მონიშნე როგორც მენსტრუაცია`. No prediction card.

**Quick Log:** no classification toggle on flow chips.

No automatic prompt when bleeding is logged.

---

## 10. Firewalls

| Channel | Phase 41 |
|---|---|
| Doctor summary | Phase 39 `postpartumContext` shape unchanged. No return-of-period interpretation. Clinician heading `მენსტრუაციის ისტორია` unchanged (Phase 14/40 P2). |
| AI | Phase 38 fail-closed. No classification / period-start / return-of-period in OpenRouter. |
| Partner | Default deny. Leak keys include `classification`, `bleedClassifications`, `ownerClassifiedPeriod`, `classifiedDates`. |
| Personal export | Includes owner rows with `ownerClassified: true`, `inferred: false`, `source: OWNER`. |
| Analytics | No bleed date, classification, flow, or episode id. No new health ProductEvent. |
| Notification Brain | No new notification. No “is this your period?” / “period has returned.” |
| Auth | Owner-only write. Cross-user isolated. |
| Offline | Online-required. Failed write does not keep a local false badge. |
| Cold start | Classification hydrates with the user-scoped postpartum query / bundle. Pending ≠ TRACK menstrual empty card (Phase 40). No previous-user badge. |

---

## 11. API

`PUT /api/cycle/postpartum/bleed-classifications` `{ date }`  
`DELETE /api/cycle/postpartum/bleed-classifications` `{ date }`

`date` may be any day inside the bleed run; the server normalizes to `bleedStart`.

Requires a classifiable PERIOD_FLOW episode stamped with `trackingContext=POSTPARTUM`. While mode is `POSTPARTUM`, that is the normal path. **Phase 42** also allows historical classify/unclassify after an explicit TRACK (or TTC / peri) return, still only on postpartum-stamped runs. Pregnancy still rejects. Classification semantics are unchanged.

Phase 42 return-to-TRACK / forecast gate: `docs/CYCLE_POSTPARTUM_RETURN_TO_TRACK_CONTRACT.md`.

---

## 12. Related frozen contracts

- Foundation: `docs/CYCLE_POSTPARTUM_MODE_CONTRACT.md`
- Copy isolation: `docs/CYCLE_POSTPARTUM_COPY_ISOLATION_CONTRACT.md`
- Doctor: `docs/CYCLE_POSTPARTUM_DOCTOR_SUMMARY_CONTRACT.md`
- Capabilities: `docs/CYCLE_MODE_CAPABILITIES_CONTRACT.md`
