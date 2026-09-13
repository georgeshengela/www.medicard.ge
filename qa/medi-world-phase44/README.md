# Medi World Phase 44 evidence

Disposable Postgres only: `postgresql://phase38@127.0.0.1:54329/medicard_phase38`.
Not Neon. Not production. QA fixtures are impossible when `NODE_ENV=production`.

## Real economy (not fixture-only)

- `live-plant.json` — `pulse_fern` plot 0, movement 20 → 0, `applied: true`
- `live-nurture.json` — `QUEST_COMPLETION` / `quest.daily_steps` CREDIT, fern seed → sprout
- `live-orbit.json` / Android `25-orbit-confirm.png` + `26-plant-success.png` + `27-garden-after-plant.png` — second real plant, connection 225 → 205
- `live-after-restart.json` — stored plants persist after API stop/start

## QA visual fixture (non-production)

`POST /api/medi-world/garden/qa/stage` set bloom/radiant for silhouette evidence.
No-decay means radiant cannot be rolled back. Documented. Never available in production.

## Canonical Android shots

| Need | File |
| --- | --- |
| Georgian intro | `04-intro-ka.png` |
| English intro | `05-intro-en.png` |
| Hub + Care Space entries | `01-hub-garden-entry.png`, `03-care-space-garden-entry.png` |
| Main garden (sprout + seed after real nurture) | `06-garden-main.png` |
| Empty unlocked plot + catalog balances | `21-empty-plot.png` |
| Planting confirmation (insufficient hydration 10/20) | `22-plant-confirm.png` |
| Insufficient energy notice | `23-insufficient.png` |
| Successful planting | `26-plant-success.png` |
| Catalog (all five plants) | `10-catalog.png`, `11-catalog-rest.png` |
| History | `12-history.png` |
| Moved + bloom fixture | `30-garden-moved-bloom.png` |
| Stored collection | `31-stored-plant.png` |
| Restored | `32-garden-restored.png` |
| Radiant fixture | `33-radiant.png` |
| Empty garden + inactivity copy | `34-empty-inactivity.png` |
| Dark / 1.3× font / compact | `36-font-garden.png` |
| Reduced motion (Reanimated log) | `38-reduced-motion.png` |
| Offline cached garden | `39-offline.png` |

Level-1 locked plots: `live-l1-garden.json` (3 unlocked, plots 3/4/5 at levels 5/10/20). Sticky unlocks on the level-50 QA user cannot re-lock plots.

## Phase 45 preflight recapture (2026-09-12)

- Git dirty work left untouched (`.cursor/`, `bro middle circle progress use this cicr.txt`).
- Prisma `validate` + `generate` succeeded before social schema work.
- Garden + economy cache tests: 25/25.
- `live-l1-garden.json` recaptured: three unlocked plots; locked plots at levels 5, 10, 20.
- Canonical Android planting / Store confirmation / Hub balance remain in `22-plant-confirm.png`, `26-plant-success.png`, `live-android-plant-balance.json`, `live-after-restart.json`.
- Cycle Phase 38 postpartum was not opened.

## Phase 45.1 engine-closure (2026-09-13)

L1 Android plant → Hub is closed on the same disposable DB user `garden.l1.1789239537737@medicard.test`.

- Prep (not the debit): `qa/medi-world-phase45/engine-closure/l1-energy-prep.json`
- Android Hub 20 → plant plot 1 `pulse_fern` → Hub 0 without reload: `qa/medi-world-phase45/engine-closure/hub-before-plant-balance.png`, `garden-plant-confirm.png`, `hub-after-plant.png`
- API corroboration: `qa/medi-world-phase45/engine-closure/android-plant-hub-api.json`
- Duplicate / insufficient: `qa/medi-world-phase45/engine-closure/duplicate-insufficient-api.json`

`live-l1-garden.json` below is the **pre-plant** locked-plot snapshot (3 empty unlocked plots). Post-plant state is the engine-closure JSON (plots 0–1 seeded).
