# Medi World Phase 40 — Medi Companion Evolution, Bond, Cosmetics, and Care Space

**Status:** implemented, awaiting review. Not production-rolled. Not committed.  
**Product phase number:** Medi World 40.  
**Not Cycle Phase 40.** Cycle postpartum Phase 38 remains frozen and unchanged.

Phases 38, 38.1, and 39 remain locked `PASS`.

## Integration decision (canonical Companion)

**Do not create `MediWorldCompanion` or any second character model.**

The canonical character is the existing Phase 9 `MediCompanionProfile`. Phase 40 extends that row and adds additive World-only tables. `MediWorldProfile.companionProfileId` stays a pointer to `MediCompanionProfile.id`. World never creates a competing character.

| Surface | Owner | Notes |
| --- | --- | --- |
| `/api/medi-companion*` | Phase 9 Quest Companion | Journey, Quest `STAGE_1`–`STAGE_7`, journey cosmetics (accent/accessory/background/decoration). Unchanged. |
| `/api/medi-world/companion*` | Phase 40 | Identity, World evolution (`spark`–`radiant`), Bond, World cosmetics (`aura`/`trail`/`charm`/`care_space_accent`), Care Moment, Care Space. |
| Care Space `/medi-world/care-space` | Phase 40 | Personal visual space. Does not replace Medi Quest Companion home. |

Quest journey backfill (`reconcileMediJourneyForUser`) still never writes World ledger, Bond, Care Energy, or World XP.

World cosmetics are a separate catalog from journey cosmetics. They are not merged.

## Phase 39 correction (prerequisite)

`latestReward` on `GET /api/medi-world` uses the same order as ledger pagination: `createdAt DESC, id DESC` via `findMany({ take: 1 })`.

Writes allocate a monotonic `createdAt` (`allocateLedgerCreatedAt`) so sequential events that share a clock still sort as insertion order. Historical balances are never rewritten.

Fake-db `sortRows` compares Date values by `getTime()` so the `id` tiebreaker runs when timestamps match.

## Emotional rules

Medi is a living care spark: warm, witty, non-binary, supportive. Not a doctor, nurse, robot, collectible monster, or a pet that becomes ill when ignored.

No decay, shame, “you failed”, extra-dose language, diagnosis, medication names, cycle/lab data, body comparison, or worth tied to activity.

Inactivity return copy is neutral. Bond, stages, cosmetics, XP, and energy never drop from inactivity.

## Evolution

Visual and emotional only. No reward multiplier. No branching.

| Stage | World level |
| --- | ---: |
| `spark` | 1 |
| `glow` | 5 |
| `bloom` | 10 |
| `pulse` | 20 |
| `guardian` | 35 |
| `radiant` | 50 |

Eligibility is derived from server World level. Reaching a stage permanently unlocks it. Users may display any unlocked stage. Sync on first Companion open after Phase 40 is idempotent and audited (`MediCompanionWorldStageUnlock`). Existing World levels unlock eligible stages; historical Quest completions are never backfilled into World rewards.

**Artwork:** the repository has no replaceable bitmap/3D stage art. Shipping presentation reuses the canonical Medi SVG (`MediCompanionFigure`) with code-native scale, aura, glow, and background accents. Replaceable presentation keys: `present.spark` … `present.radiant`.

## Bond

Ruleset `medi-world-bond-v1`. Formula lives only in `server/src/lib/mediWorld/companion/bond.js`.

`bondPointsRequiredForNextLevel(L) = 20 + 10 × (L - 1)` for L in 1..19. Level 20 is the display cap; lifetime points still accumulate.

Awards (server, idempotent):

| Event | Points | Daily repeatable cap |
| --- | ---: | --- |
| First Medi World visit of a local day | +1 | yes |
| Eligible verified personal goal (100% band) | +2 | yes |
| Evolution stage unlock | +5 | no (lifetime) |
| Care Moment | +1 | yes |

Repeatable cap: 5 Bond / local Quest day. Timezone hop and DST follow World `canAssignNewDailyPeriod`. No negative Bond, decay, streak multiplier, LLM award, or World XP/Care Energy recursion.

## Care Moment

Allowlist: `greet`, `breathe`, `quiet`, `stretch`, `celebrate`. Optional. One Bond-eligible completion per local day. Not a medical measurement.

## Cosmetics

Catalog version 1. Visual only. No rarity, gacha, paid currency, or gameplay multiplier.

| Key | Slot | Requirement | Price |
| --- | --- | --- | --- |
| `aura_teal_origin` | aura | default | free, owned initially |
| `aura_hydration_wave` | aura | World level 3 | 30 hydration |
| `aura_calm_glow` | aura | level 5 | 30 calm |
| `trail_movement_pulse` | trail | level 8 | 40 movement |
| `charm_care_heart` | charm | level 10 | 40 care |
| `accent_connection_orbit` | care_space_accent | level 12 | 50 connection |

Unlock: `POST /api/medi-world/companion/cosmetics/:catalogKey/unlock` with `{ idempotencyKey }` only. Server owns price and category. Debit reason `COMPANION_UNLOCK` in the same transaction as ownership. No public generic spend route.

### Cosmetic unlock error precedence (deterministic)

Documented after live local API check. Behavior was already correct; it was not changed to force a preferred error.

Order in `unlockCosmetic`:

1. Client `price` / `energyType` / `category` → `COMPANION_UNLOCK_CLIENT_PRICE` (400)
2. Inactive or unknown catalog key → `COMPANION_CATALOG` (404)
3. Already owned → `{ alreadyOwned: true, charged: false }` (200, no debit)
4. Free / default-owned → own without debit
5. World level below requirement → `COMPANION_LEVEL_LOCKED` (400) **before** debit
6. Debit → `INSUFFICIENT_CARE_ENERGY` if the balance is too low
7. Same idempotency key, different intent → `WORLD_IDEMPOTENCY_CONFLICT`

Level-lock before insufficient energy is intentional: it does not leak whether the user could afford a locked item.

## API

Authenticated, self-only, private cache:

- `GET /api/medi-world/companion`
- `PATCH /api/medi-world/companion` (rename)
- `POST /api/medi-world/companion/care-moment`
- `POST /api/medi-world/companion/stage`
- `PUT /api/medi-world/companion/equipment`
- `POST /api/medi-world/companion/cosmetics/:catalogKey/unlock`

Name is private. Responses omit idempotency keys, raw ledger metadata, and health fields.

## Migration

Canonical: `server/prisma/phase40-medi-world-companion.sql`  
Lockstep: `server/prisma/migrations/20260912200000_medi_world_companion/`  
Do not run both on one database. Do not `prisma db push`. Do not apply to production from this tree.

## Out of scope (Phase 41+)

Map, GPS, Care Sparks, friends/teams/gifting/trading/chat, Health Trees, Wellness Storms, AR, seasons, Adventure Pass, real-money purchases, randomized loot, push, UGC cosmetics, generative assets, health advice from Companion state.
