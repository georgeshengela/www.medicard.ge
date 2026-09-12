# Medi World Phase 41 — Personalized Daily Adventures

**Status:** Phase 41.1 migration-order closure `PARTIAL` (empty-database `prisma migrate deploy` fails on historical `CycleLog` ALTER). Not production-rolled. Not committed.  
**Product phase number:** Medi World 41.  
**Not Cycle Phase 41.** Cycle postpartum remains frozen and unchanged.

Phases 38, 38.1, 39, and 40 remain locked `PASS`.

## Integration decision

Daily Adventure **orchestrates existing Quest records**. It is not a second quest engine.

Canonical systems stay:

- Quest assignment (`assignDailyQuests`) and completion (`completeQuest`)
- Quest timezone resolution and hop guard
- Quest templates
- Smart Quest engine
- Medi World reward engine (`applyQuestCompletionToMediWorld` via `quest-completion:${userQuestId}`)
- Medi Companion and Bond
- achievements

Adventure completion is derived from canonical Quest (or Care Moment) state. Completing a health action never awards Care Energy, World XP, Quest XP, coins, or Bond twice because it also appears on the Adventure path.

There is **no** `POST /complete` Adventure endpoint.

## Capability registry

Active, audited only:

| Key | Category | Completion |
| --- | --- | --- |
| `quest.daily_steps` | movement | existing `daily_steps` Quest (needs usable step capability) |
| `quest.daily_hydration` | hydration | existing `daily_hydration` Quest (needs hydration goal) |
| `quest.daily_medi` | care | existing `daily_medi` Quest |
| `companion.care_moment` | care | Companion Care Moment (`lastCareMomentPeriodKey`) |

Inactive / hidden (typed future only): wheelchair movement, rehab, low-mobility, breathing, rest/recovery, connection.

Walking is not the only category. Intensity never raises canonical Quest targets.

## Ruleset

`medi-world-adventure-v1` — pure deterministic engine. Same inputs → same plan. No LLM.

## Privacy exclusions

Personalization does **not** use diagnoses, medications, labs, symptoms, cycle, pregnancy, chat, GPS, or body weight.

## APIs

Authenticated, self-only:

- `GET /api/medi-world/adventure/today`
- `GET /api/medi-world/adventure/preferences`
- `PUT /api/medi-world/adventure/preferences`
- `POST /api/medi-world/adventure/today/choice`
- `POST /api/medi-world/adventure/today/swap`
- `POST /api/medi-world/adventure/today/rest-day`

## Migration

**Recommended path for migrate-tracked databases:** `npx prisma migrate deploy`  
Folder: `server/prisma/migrations/20260912220000_medi_world_adventure/` (sorts after Phase 40 `20260912200000_medi_world_companion`).

**Canonical additive SQL** for databases that historically use `prisma db execute` and have no `_prisma_migrations`: `server/prisma/phase41-medi-world-adventure.sql`

Do **not** run both on one database. Do not `prisma db push`. Do not apply to production from this tree. See `server/docs/phase41-medi-world-adventure-deploy.md`.

## Expired Adventure

Product contract (ordinary online entry never shows yesterday):

- `GET /api/medi-world/adventure/today` returns **only** the accepted current local period.
- A previous Adventure is marked `expired` in persisted/audit state (`MediWorldDailyAdventure.status`).
- The Today screen immediately receives or generates the current Adventure.
- Users are not shown an obsolete yesterday screen on ordinary online entry. There is no dedicated online expired Today frame, and one must not be added solely for screenshots.
- Stale offline cache from a previous local period is visibly marked expired/out-of-date (`expiredOffline` copy) and mutations stay disabled (`ADVENTURE_EXPIRED` / `canMutate === false`).
- Yesterday’s progress is never presented as today’s active Adventure. Completing or swapping an expired row does not complete it or grant an Adventure reward.
