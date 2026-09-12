# Medi World Phase 38 — Foundation contract

**Status:** Phase 38.1 acceptance `PASS` (2026-09-12). Foundation only. Not production-rolled.  
**Product phase number:** Medi World 38.  
**Not Cycle Phase 38.** Cycle Phase 38 (`docs/CYCLE_POSTPARTUM_MODE_CONTRACT.md`) remains frozen and unrelated.

This document is the Phase 38 contract **and** the current-state audit. It is written from the repository as of 2026-09-12. Do not start Phase 39 (live map, social, Health Tree, events, AR, shop).

## Product statement

Improve your own health and help bring your city back to life.

Phase 38 only builds the reusable, server-authoritative progression foundation. The world is awakening. No live map, nearby users, Health Tree totals, or mock statistics may be shown as real.

## Current Quest architecture (audit)

### Source of assignment

- Templates: `server/src/lib/questTemplates.js` (`daily_steps`, `daily_hydration`, `daily_medi`, `weekly_steps`).
- Assignment: `assignDailyQuests` / `assignWeeklyQuests` in `server/src/lib/quest.js`.
- Period keys and timezone: `server/src/lib/questTime.js`. Device timezone wins, then profile, then `user.timezone`, then legacy `Asia/Tbilisi`. Never derived from longitude.
- Smart Quest Engine v1 (`server/src/lib/smartQuestEngine.js`) personalizes **STEPS targets only**. Rewards never vary with target (`daily_steps` stays 50 XP / 30 coins). Weather is presentation-only.

### Frozen reward / progress contracts (do not rename)

- `UserQuest.status`: `ACTIVE | COMPLETED | CLAIMED | EXPIRED | CANCELLED`.
- `QuestCompletion` unique on `userQuestId` — a quest cannot complete twice.
- `RewardLedger` is authoritative for Quest **XP | COIN** (`sourceType` QUEST | ACHIEVEMENT | SYSTEM). Unique `(userId, currency, sourceType, sourceId)`.
- Claim path writes ledger + cached `UserQuestProfile`. Completion and claim are separate.
- Privacy: `server/src/lib/questPrivacy.js` — no health notes, med names, symptoms, chat, diagnosis.

### Existing hooks after completion

- Achievements: `evaluateAchievementsAfterQuest` (post-commit).
- Medi Companion journey: `reconcileMediJourneyAfterQuestSafe` (post-commit, derived from `QuestCompletion`, historical users unlock on first reconcile).

Phase 38 **must not** backfill historical `QuestCompletion` rows the way Companion does.

### Reusable mobile surfaces

- Quest primitives: `mobile/src/components/quest/*`, tokens `mobile/src/theme/questTokens.ts`.
- Companion: `/medi-companion`, home chip overlay on the Quest home slot.
- Home order is frozen in `buildHomeSectionOrder` — Phase 38 must not add a new `HomeSectionId`.

### Feature control in this repo

There is no second flag framework. Remote public flags live in `AppSettings` via `GET /api/app/status`. Compile-time gates use `__DEV__` / env (`qa/release-audit/RA-00/feature-flags.json`).

Medi World uses:

- Server: `MEDI_WORLD_ENABLED` env. Unset → **on** in `development`/`test`, **off** in `production`.
- Public bootstrap: `settings.mediWorldEnabled` on `/api/app/status` (derived, not an AppSettings column).
- Mobile compile-time: `__DEV__` or `EXPO_PUBLIC_MEDI_WORLD=1`.
- Mobile runtime: `rememberMediWorldServerEnabled` from app status. Production availability is **server-controlled**. A development override may show the entry before status loads; production never treats unknown status as on.

### Conflicts / overlaps

| Existing | Phase 38 decision |
| --- | --- |
| `RewardLedger` XP/COIN | **Do not reuse.** Care Energy is a separate integer ledger so Quest economy stays frozen. |
| Medi Companion | Ownership **reference only**. Do not create companion rows. Do not change journey math. |
| Smart Quest step targets | Reuse normalized `progress/target` from the assigned quest. Never award from raw steps. |
| `UserLocation` / `/api/location` | Out of scope. Phase 38 must not request GPS or store coordinates. |
| Cycle Phase 38 postpartum | Name collision only. Separate docs, SQL, and QA folders. |
| Dirty working tree (Cycle, auth, legal, admin) | Phase 38 files are additive. Existing dirty files are patched surgically. |
| Home `FIXED_ORDER` | Unchanged. World home card is a feature-gated sibling inside the existing `mediQuest` slot. |
| Companion historical reconcile | World adapter fires **only** on newly created `QuestCompletion` inside `completeQuestInTx`. |

### Persistence convention

Live Neon historically used additive `prisma db execute` (Phase 8/9 pattern) and may lack `_prisma_migrations`. Phase 38 ships:

- Prisma models in `server/prisma/schema.prisma`
- Canonical additive SQL `server/prisma/phase38-medi-world-foundation.sql`
- Prisma migration `server/prisma/migrations/20260912120000_medi_world_foundation/` (lockstep copy for migrate-tracked DBs)

**Canonical apply:** `npx prisma db execute --file prisma/phase38-medi-world-foundation.sql`. Do **not** also `prisma migrate deploy` the same change on that database. **Do not** `prisma db push` or execute SQL against production from this phase.

## Domain identifiers (stable)

English domain ids: `MediWorld`, `MediCompanion`, `CareEnergy`, `CareEnergyType`, `HealthTree`, `WorldAction`, `WorldReward`, `ActivityAdapter`, `PersonalGoalProgress`.

`CareEnergyType`: `movement | hydration | calm | care | connection`  
These are categories of one integer energy system, not five paid currencies.

Progress states (never collapse to a boolean):

- `verified` — server-computed from a trusted pipeline (Quest completion).
- `user_reported` — user said they did it; **no Care Energy / foundation XP**.
- `estimated` — inferred; **no award**.
- `pending` — not yet decided; **no award**.
- `rejected` — ineligible; **no award**.

## Health equality

Reward math uses **normalized personal-goal completion in basis points** (0–10000), not raw steps.

A rehabilitation target of 1,500 and an athlete target of 10,000 both yield 10000 bps at 100% and the same provisional Care Energy.

Exceeding a safe personal target does not pay extra (ratio capped at 10000 bps). Zero / invalid progress pays 0.

## Medical responsibility

- No diagnosis, prescription, medication-quantity rewards, missed-dose punishment, or public adherence.
- `quest.daily_medi` maps to Care Energy `care` as a **user-confirmed Medi routine**, not proof a dose was taken. Ledger must not store medication names or counts.
- LLM / Medi chat must never award currency, XP, or verified completion.

## Privacy / safety (Phase 38 + future)

Phase 38 stores **no** lat/lng, GPS, home, or coarse community membership.

Ledger metadata may contain only: `templateKey`, `periodKey`, `cadence`. Forbidden: notes, symptoms, meds, chat, diagnosis, steps totals, ml, GPS.

Future (not built): health data off the public game profile; no live location sharing; privacy zones; coarse area membership; server-authoritative POIs; minor-safe defaults; block/report; no background tracking without explicit consent.

## Persistence (minimum)

1. `MediWorldProfile` — one row per user, lazy-created, integer Care Energy balances, foundation XP/level, `rulesetVersion`, optional companion profile id, nullable `coarseCommunityKey` (always null in Phase 38).
2. `MediWorldLedger` — append-only. Unique `idempotencyKey`. Non-negative integer amounts. Explicit `transactionType` (`CREDIT` | `DEBIT`). Phase 38 writes `CREDIT` only. `progressState`, `completionRatioBps`, `adapterId`, `rulesetVersion`.

No social, map, POI, shop, season, inventory, Health Tree, or live-event tables.

Balances cannot go negative. Currency is integer. Mutations are transaction-safe. Idempotency is enforced at the database unique key.

Existing users get a profile on first GET or first eligible award (lazy). Historical quests are **not** scanned.

## Engine

`server/src/lib/mediWorld/engine.js` is deterministic and LLM-free.

Eligible sources: `QUEST_COMPLETION`, `FOUNDATION_TEST`.

Provisional constants (`MEDI_WORLD_FOUNDATION_*`, Phase 39 may tune):

- `RULESET_VERSION = 1`
- `MAX_ENERGY_PER_EVENT = 10`
- `MAX_FOUNDATION_XP_PER_EVENT = 5`
- `XP_PER_LEVEL = 50`
- Award only when `progressState === 'verified'`

`energy = floor(completionRatioBps * MAX_ENERGY_PER_EVENT / 10000)`  
`foundationXp = floor(completionRatioBps * MAX_FOUNDATION_XP_PER_EVENT / 10000)`

## API

Authenticated, cache-private, self-only:

- `GET /api/medi-world` — lazy profile. 404 when the feature is disabled (same not-found copy as unknown routes; do not leak other users). 503 `WORLD_UNAVAILABLE` when the flag is on but World tables are missing (no fake zero profile).
- `GET /api/medi-world/ledger?cursor&take` — cursor page of the caller’s ledger.

There is no public award/spend HTTP route. Phase 38.1 removed `POST /api/medi-world/foundation-activity`. Tests call the internal engine. Production awards enter only through `completeQuestInTx`.

## Quest adapter

Inside `completeQuestInTx`, after a new `QuestCompletion` row:

- Map template → `ActivityAdapter` + `CareEnergyType`.
- `progressState = verified`.
- `idempotencyKey = quest-completion:{userQuestId}`.
- Skip if Medi World is disabled (no World write attempted).
- If tables are missing (`P2021`) while enabled: Quest still completes; World reward is not persisted; emit privacy-safe `WORLD_SCHEMA_MISSING`; never describe a World reward as success.
- Do not run on `alreadyCompleted` / historical rows.
- Quest XP/coins, assignment, Smart Quest, and Companion journey remain unchanged.

## Mobile entry

- Route `/medi-world` (no system header).
- Feature-gated home sibling under the existing Quest slot + Quest hub nav tile.
- Real data only: title, foundation level/progress, five Care Energy balances, awakening copy, link to Medi Quest.
- States: loading, loaded (including zero balances), error, offline, retry.
- ka + en copy (`mobile/src/i18n/world/catalog.js`). Screen language chips are local and not persisted.
- Accessibility labels, dynamic type, small-phone wrapping, dark/light, reduced motion.

Out of scope on this screen: map, nearby people, Health Tree, events, shop, fake counts, dead functional buttons.

## Versioning

Store-facing mobile revision bump: `1.0.0.7.71` → `1.0.0.7.72` (`ios` `1.7.72`). Native integers stay 66.

## Out of scope (explicit)

Live map, background location, POIs, Care Spark spawning, friends, public profiles, teams, chat, Health Trees, Wellness Storms, cooperative walks, AR, cosmetics shop, payments, Adventure Pass, leaderboards, raw-step competition, push notifications, production rollout.
