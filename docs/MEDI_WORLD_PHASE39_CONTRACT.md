# Medi World Phase 39 — Care Energy, XP, Levels, and Balanced Economy

**Status:** implemented, awaiting review. Not production-rolled. Not committed.  
**Product phase number:** Medi World 39.  
**Not Cycle Phase 39.** Cycle postpartum remains frozen.

Phase 38 / 38.1 foundation is locked `PASS`. This contract describes the economy built on that foundation as of 2026-09-12.

## Ruleset

Canonical file: `server/src/lib/mediWorld/ruleset.js`

- Identifier: `medi-world-economy-v2`
- Integer version stored on ledger/profile: `2`
- Phase 38 rows keep `rulesetVersion = 1` and are never rewritten
- Historical transactions are not recalculated

## Reward table (normalized personal-goal completion)

| Basis points | Care Energy | World XP | Reason |
| --- | ---: | ---: | --- |
| 0–4999 | 0 | 0 | `PERSONAL_GOAL_BELOW_HALF` |
| 5000–7499 | 4 | 4 | `PERSONAL_GOAL_HALF_COMPLETE` |
| 7500–9999 | 7 | 8 | `PERSONAL_GOAL_MOSTLY_COMPLETE` |
| 10000+ | 10 | 12 | `PERSONAL_GOAL_COMPLETE` |

Above 100% does not pay extra. 1,500/1,500 and 10,000/10,000 pay the same. Raw quantity is not stored in ledger metadata.

Quest completion still arrives at 100% of the assigned target; the engine evaluates every band for future adapters.

## Evidence

Only `verified` pays spendable Care Energy and World XP. `user_reported`, `estimated`, `pending`, and `rejected` write a zero-reward audit CREDIT and reason `UNVERIFIED_ACTIVITY`. Pending then verified uses the same `logicalEventId`; a second spendable credit is treated as `DUPLICATE_ACTIVITY`.

No public award HTTP route.

## Daily caps (Quest timezone, never GPS)

- 20 Care Energy per category per local day
- 60 World XP from activity CREDITS per local day
- Per-event max is the 100% band
- Timezone hops reuse the previous cap day when Quest `canAssignNewDailyPeriod` denies a new day
- Excess activity is still recorded with a cap reason code

## World XP and levels

`xpRequiredForNextLevel(L) = 100 + 25 × (L - 1)` for L in 1..49. Level 50 is the cap; lifetime XP still increases.

Level is derived from cumulative `foundationXp` (exposed as `worldXp`). Stored `foundationLevel` is updated in the same transaction. No decay, missed-day penalty, or lost levels.

Level-up: +5 `connection` Care Energy per newly crossed level, ledger `LEVEL_UP`, idempotency `world-level-up:{userId}:{level}`, `foundationXp = 0`. None at lazy profile creation. None above 50.

## Internal debit

`debitCareEnergy` / `debitCareEnergyInTx` — not an HTTP route. Allowlisted reasons: `INTERNAL_TEST`, `COMPANION_UNLOCK`. Rejects overdraft with `INSUFFICIENT_CARE_ENERGY`. Idempotent retry returns the original DEBIT. Conflicting reuse → `WORLD_IDEMPOTENCY_CONFLICT`.

## API

Still authenticated self-only:

- `GET /api/medi-world` — profile, World progression, today caps, latest reward summary
- `GET /api/medi-world/ledger` — cursor `createdAt_id`, no idempotency keys, no raw metadata

## Mobile

`/medi-world` shows World level, World XP (named separately from Quest XP), Care Energy, today’s limits, latest explanation, how-rewards-work sheet, awakening copy, Medi Quest CTA. Level-up celebration is dismissible and stored in local prefs.

## Migration

Canonical: `server/prisma/phase39-medi-world-economy.sql`  
Lockstep copy: `server/prisma/migrations/20260912180000_medi_world_economy_v2/`  
Do not run both on one database. Do not `prisma db push`. Do not apply to production from this tree.

## Out of scope

Companion evolution, cosmetics, map, Care Sparks, Health Trees, friends, seasons, Adventure Pass, purchases, spend UI.
