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
