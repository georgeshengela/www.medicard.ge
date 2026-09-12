# Medi World Phase 44 — The Personal Care Garden

**Status:** Phase 44 `PASS` in this working tree. Not production-rolled. Not committed.  
**Product phase number:** Medi World 44.  
**Not Cycle Phase 44.** Cycle postpartum (Cycle Phase 38) remains frozen and unchanged.

Phases 38–43.1 remain accepted `PASS`. Phase 45 is not started.

## Promise

> “Every act of care brings my world to life.”

The Garden represents **consistency**, not health status. Plants never die, wilt, become sick, decay, or lose progress. Inactivity is not punished. Care Energy is spent only to plant. Growth creates no currency, XP, Bond, Quest, or Adventure reward.

## Ruleset

`medi-world-garden-v1`

- One private `CareGarden` per user. No public gardens, visitors, gifts, teams, or city Health Trees.
- Six stable plots. Unlocks derived from World level only: plots 0–2 at level 1, plot 3 at 5, plot 4 at 10, plot 5 at 20. Unlocks cost nothing, never regress, grant no Bond/XP/currency, and synchronize idempotently (`plot-unlock:{index}`).
- Catalog is server-owned. Client sends only `catalogKey` + `idempotencyKey` when planting. Price and category are never accepted from the client.
- Stages: `seed` (0 distinct qualifying local days) → `sprout` (1) → `bloom` (3) → `radiant` (7). Growth never decreases.
- One nurture credit per owned plant per accepted local `periodKey`. Same-category qualifying day nurtures **all** matching owned plants, including stored plants. Multiple same-category CREDITS on one day do not accelerate. Planting DEBIT does not nurture. `FOUNDATION_TEST`, `LEVEL_UP`, QA/internal, and zero-energy rows do not nurture. Historical CREDITS before `plantedAt` do not backfill.
- Stored plants keep all growth and **may receive future nurture** (storage is not punitive). Moving and storing cost nothing. Phase 44 never permanently deletes a plant.
- Timezone: Garden uses the World economy `periodKey` from the eligible CREDIT. It does not invent a second clock.
- Atmosphere is visual and derived only from Garden-owned state (planted count, stages, Care Space accent, Companion presentation, local time-of-day). It never reduces rewards and never uses medical status, missed days, location, weather, or body metrics.
- Medi reactions are deterministic localized strings. No LLM. No hungry/dying/lonely/ill/disappointed copy. Reactions award no Bond or currency.

## Eligible nurture CREDIT

A World ledger row may nurture only when all of the following hold:

1. Garden feature enabled and schema present.
2. `transactionType` is `CREDIT`.
3. `energyAmount` > 0 (spendable).
4. `progressState` is `verified`.
5. `sourceType` is `QUEST_COMPLETION` or `MOVEMENT_SESSION`.
6. `reasonCode` is not `LEVEL_UP_REWARD`.
7. The plant already exists (`plantedAt` ≤ CREDIT `createdAt`).

## Transaction / availability policy

- Planting and `GARDEN_PLANT` DEBIT occur in **one** database transaction via the Phase 39 `debitCareEnergyInTx` service. Failure rolls back both. No generic public spend endpoint.
- Nurture is a **narrow adapter** after a successful eligible CREDIT inside `processWorldActivityInTx`. Quest/Movement feature code does not mutate Garden rows.
- If Garden is **disabled**, the World CREDIT still succeeds and no growth is claimed.
- If Garden is **enabled** and schema is missing (`P2021` / missing client), `reportWorldSchemaMissing('garden_nurture')` makes it observable. The CREDIT still succeeds. The CREDIT response does **not** claim Garden growth.
- Other Garden write errors during nurture are logged and swallowed so the World reward is not lost. GET Garden is the source of truth. Unpersisted growth is never reported as applied.
- Missing Garden schema on Garden APIs is `WORLD_UNAVAILABLE` (503). Disabled Garden APIs are `GARDEN_DISABLED` (404).

## APIs

Authenticated, self-only, `Cache-Control: private, no-store`:

- `GET /api/medi-world/garden`
- `GET /api/medi-world/garden/catalog`
- `POST /api/medi-world/garden/plots/:plotIndex/plant`
- `POST /api/medi-world/garden/plants/:plantId/move`
- `POST /api/medi-world/garden/plants/:plantId/store`
- `POST /api/medi-world/garden/plants/:plantId/restore`
- `GET /api/medi-world/garden/history`

Flag: `MEDI_WORLD_GARDEN_ENABLED` (on in non-production unless `0`; production off unless `1`). Independent of Movement/Explore. Client: `EXPO_PUBLIC_MEDI_WORLD_GARDEN`.

Non-production QA fixture `POST /api/medi-world/garden/qa/stage` sets visual stages without debiting or minting rewards. Production always 404. Impossible in store builds.

## Cache

Planting, GET Garden, and GET World share `worldEconomyCache`. The server snapshot is authoritative. Failed planting must not call apply. Duplicate planting returns the original snapshot (no second debit).

## Offline

Last cached Garden may be shown with a stale indicator. Offline mode must not plant, move, store, restore, claim growth, debit, or queue mutations.

## Migration

Canonical SQL: `server/prisma/phase44-medi-world-garden.sql`  
Folder: `server/prisma/migrations/20260913020000_medi_world_garden/` (after Phase 43 `20260913010000_medi_world_movement`).

Additive. No historical plants or nurture backfill. Do not apply to production. Do not rewrite Cycle migrations.

## Exclusions

Public gardens, friends, gifting, city Health Trees, weather-affected progress, plant death, purchases/ads, randomized seeds, rarity, seasonal pressure, UGC, map/GPS changes, agricultural or medical advice, LLM copy.
