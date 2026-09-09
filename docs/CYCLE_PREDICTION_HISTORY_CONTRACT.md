# Cycle prediction history contract — Phase 8

**Status:** DATA FOUNDATION + JOURNAL PRESENTATION FINAL-FROZEN (Phase 9 / 10)  
**Date:** 2026-09-09  
**Engine / safety / notifications remain frozen.**  
**Android Journal presentation is final-frozen.** iOS visual QA is deferred by product decision.

This document is the source of truth for historical prediction snapshots. It does **not** change Cycle forecast math.

---

## Why snapshots exist

Today's recomputed `nextPeriodStart` is not what MediCard predicted last month. Confidence, LMP, and history may have been different.

A snapshot is: *at this moment, given the data then, MediCard predicted X.*

If a prediction was not recorded at the time, we do **not** claim to know it. **No retrospective invention. No backfill.**

---

## What is stored

`CyclePredictionSnapshot` — `NEXT_PERIOD_START` only.

| Field | Role |
|---|---|
| `predictedDate` | Civil `YYYY-MM-DD` predicted start |
| `snapshotDate` | Civil day of observation |
| `snapshotAt` | Timestamp (ordering / same-day cutoff) |
| `cycleAnchorDate` | Derived LMP at observation — **episode identity** |
| `confidence` | Engine confidence at observation |
| `engineVersion` | `CYCLE_PREDICTION_ENGINE_VERSION` (not the app version) |
| `validGapCount` | In-band gap count then (context, not identity) |
| `isIrregular` | Profile flag then |
| `source` | `inferred` / `stored` / `default` |

No symptoms, notes, sexual activity, pain, mood, custom tags, partner data.

---

## Engine version

`CYCLE_PREDICTION_ENGINE_VERSION = 1` in `server/src/lib/cyclePredictionHistory.js`.

Bump this constant only when **forecast semantics** change in a future engine phase. Do not tie it to mobile `39.x`.

Historical rows stay attributed to the version that produced them.

---

## Creation trigger

After a successful Cycle bundle is built (`loadBundle`), observe `rawPredictions.nextPeriodStart`.

Do **not** snapshot on:

- pregnancy mode
- missing predicted date
- missing cycle anchor (LMP)

Observation failure never fails the bundle.

---

## Deduplication / meaningful change

Identity (unique):

`userId + type + cycleAnchorDate + predictedDate + confidence + engineVersion`

New snapshot when any of those change. `validGapCount`-only does **not** create a row.

Repeated bundle refresh is idempotent. Concurrent creates use the unique constraint (`P2002`).

---

## Target episode identity

`cycleAnchorDate` = derived last period start at snapshot time.

Predicted date can move; the anchor does not. Revisions of one upcoming episode share the same anchor. A new logged period start creates a new series.

---

## Immutability

Never update `predictedDate`, `confidence`, `engineVersion`, or snapshot time. New state = new row.

---

## Actual outcome

Derived period starts from `inferCycleStats` (Phase 3 segmentation).

Spotting is not an outcome. The next derived start **after** the anchor is the actual start.

Historical log edits recompute the outcome. Snapshots stay.

---

## First vs final

For each completed episode:

- **FIRST_PREDICTION** — earliest pre-period snapshot
- **FINAL_PRE_PERIOD_PREDICTION** — latest snapshot **before** the actual period

Same-day rule: a snapshot on the actual start civil day is pre-period only if `snapshotAt` is before that day's log `createdAt`. If unknown, same-day is **not** pre-period.

---

## Error

Signed: `actualStart − predictedStart` (civil days).  
Absolute: `|signed|`.

This is **not** an accuracy percent.

---

## Aggregates

Eligible only at **≥ 3 completed episodes**.

Statistic: **median absolute error** of the **final** prediction.  
Forecast length remains the engine **arithmetic mean**. These are different concepts.

---

## Exclusions

| Reason | Meaning |
|---|---|
| `INVALID_CYCLE_GAP` | Anchor→actual outside 18–60 days (pregnancy-sized silence / invalid gap) |
| `NO_PRE_PERIOD_SNAPSHOT` | Only post-outcome rows exist |
| open series | No derived start after the anchor yet |

Irregular users are included with stored snapshot-time irregular flag. Neutral language. No fertility evaluation. Period forecasts under contraception still snapshot; LIMITED fertility presentation is unchanged.

---

## Privacy / partner / AI / analytics

Private internal history. Not in partner payloads. Not sent to EvidenceMD/OpenRouter. No product-analytics raw dates. No notifications, Brain candidates, or Quest rewards.

---

## Deletion

Cycle wipe and account delete (User cascade) remove snapshots.

Export may include the public snapshot fields only.

---

## API

`GET /api/cycle/prediction-history`

Female-only. Private, no-store (router-wide Cycle cache headers). Not attached to the Overview bundle.

If the snapshot table is not migrated yet, the endpoint returns an empty honest history (`emptyReason: NO_SNAPSHOTS`) instead of inventing rows.

Sample completed response:

```json
{
  "engineVersion": 1,
  "snapshotCount": 3,
  "completedCount": 1,
  "openCount": 0,
  "excludedCount": 0,
  "aggregateEligible": false,
  "aggregate": null,
  "emptyReason": null,
  "episodes": [
    {
      "cycleAnchorDate": "2026-09-01",
      "actualStart": "2026-10-01",
      "firstPredictedStart": "2026-09-29",
      "lastPredictedStart": "2026-10-01",
      "firstErrorDays": 2,
      "lastErrorDays": 0,
      "firstAbsErrorDays": 2,
      "lastAbsErrorDays": 0,
      "snapshotCount": 3,
      "prePeriodSnapshotCount": 3,
      "confidenceAtFirst": "medium",
      "confidenceAtLast": "medium",
      "status": "completed",
      "exclusionReason": null
    }
  ]
}
```

## Production migration

Migration: `server/prisma/migrations/20260908220000_cycle_prediction_snapshots/migration.sql`

Applied to the target Neon on 2026-09-09 via:

`npx prisma db execute --file prisma/migrations/20260908220000_cycle_prediction_snapshots/migration.sql`

`_prisma_migrations` **does not exist** on that database. `prisma migrate deploy` was **not** run. Migration history was not initialized or rewritten.

Verified on the live table:

- `CyclePredictionSnapshot` columns as specified
- unique index `CyclePredictionSnapshot_identity`
- indexes `userId+cycleAnchorDate`, `userId+snapshotDate`, `userId+type+createdAt`
- FK `CyclePredictionSnapshot_userId_fkey` → `User(id)` ON DELETE CASCADE

Prisma Client generated locally after stopping Medicard `--watch` API processes that locked `query_engine-windows.dll.node`.

Do not use `db push` for this table. Do not create `_prisma_migrations` as a side effect of this phase.

Account delete cascades via `User` FK. Cycle wipe deletes snapshot rows in the same transaction as other Cycle health data.

---

## UI (Phase 9)

Journal-only. No fourth pane. No hub redesign. No accuracy %, score, gauge, or green/red grading.

Title: `პროგნოზების ისტორია`  
Lead: `რას ვარაუდობდა MediCard და როდის დაიწყო მენსტრუაცია.`

Compact row: actual start, **final** pre-period estimate, human difference (`იმავე დღეს` / `N დღით გვიან` / `N დღით ადრე`). No signed integers.

Tap expands observational first vs final:

- პირველი შეფასება
- ბოლო შეფასება
- დაიწყო
- `პროგნოზი N-ჯერ განახლდა` where N = `max(prePeriodSnapshotCount - 1, 0)`
- snapshot-time confidence via existing Cycle confidence copy
- estimate-vs-log sentences

Revision movement copy: `შეფასება განახლდა` — never “wrong prediction.”

| State | Presentation |
|---|---|
| 0 completed | Empty copy. No metric. Section still renders on an otherwise empty Journal (not only when period logs exist). |
| Open series | Optional `მიმდინარე პროგნოზი` above history. Not in aggregates. |
| 1–2 completed | Rows only. No aggregate. |
| 3+ completed | Server `median_absolute_error` of **final** predictions only. Mobile must not recompute. |
| Excluded | Hidden (`INVALID_CYCLE_GAP`, `NO_PRE_PERIOD_SNAPSHOT`). Never “missed by 70 days.” |
| API failure | Hide the section. Journal stays up. |
| Older server | Hide the section. |

Newest completed first. Initial display 6 rows + `ყველას ნახვა` (inline expand, no extra route). Presentation limit ≠ storage retention.

Rows stay compact (separator list inside one Journal card). Dates stack; Georgian `D თვე` — no ISO in normal UI. Do not disable font scaling on this section.

Footnote always when history is shown: `წინა პროგნოზების შედეგები მომდევნო ციკლის ზუსტ თარიღს არ იძლევა.`

Refresh when the Journal remounts or derived `periodStarts` change. Do not refetch on row expand. Do not send this history to Medi, partner, push, Quest, or product analytics.

QA fixtures: `server/scripts/cycle-phase9-qa-seed.js` — labeled QA only, not product backfill. Native Android shots: `qa/cycle-phase10-prediction-history/`.

---

## Future (not this phase)

OVULATION_ESTIMATE / FERTILE_WINDOW snapshot types. Retrospective simulation. Medi Cycle AI. Partner/analytics exposure.
