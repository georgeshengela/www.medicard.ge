# Medi World Phase 45 — Friends, Trusted Circles, and Social Privacy

**Status:** Phase 45.1 `PASS` in this working tree. Garden L1 plant→Hub, Android A→B health isolation, and Home fresh-JS health-metrics coalescing are closed. Two-app Social UI was not available (one emulator); protocol sockets are in `qa/medi-world-phase45/engine-closure/final-gaps/`. Artwork deferred. SQL is not applied to production Neon. Not committed.  
**Product phase number:** Medi World 45.  
**Not Cycle Phase 45.** Cycle postpartum (Cycle Phase 38) remains frozen and unchanged.

Phases 38–44 remain accepted `PASS`. Phase 46 is not started.

Production default: Social is **off** when `NODE_ENV=production` and `MEDI_WORLD_SOCIAL_ENABLED` is unset. Enable only with `MEDI_WORLD_SOCIAL_ENABLED=1`.

## Promise

> “Connect through encouragement without exposing your health.”

This is not a public social network, dating feature, chat platform, follower economy, or location-sharing system.

## Eligibility

- Unknown eligibility (`adultConfirmedAt` missing) → Social stays off.
- Adult confirmation is explicit (`POST /social/eligibility` with `confirmAdult: true`). Policy version `social-eligibility-v1`.
- Confirmation does **not** infer age from Cycle, pregnancy, profile health, or date of birth.
- Social participation is a second explicit opt-in (`socialEnabled`) after a game name is set. Legal name is never copied.
- Disabling Social hides the profile and blocks new interactions. Accepted friendships remain stored privately.

## Discovery and relationships

- Exact friend codes only (`XXXXX-XXXXX`, alphabet without `0/O/I/1/L`). Server-generated, rotatable, case-insensitive.
- Uniform `SOCIAL_NOT_FOUND` for missing, ineligible, self, and blocked lookups.
- Canonical pair row. Crossed pending requests collapse to one row (accept or a single pending).
- States: `pending`, `accepted`, `declined`, `cancelled`, `removed`, `blocked`.
- Block cancels pending, revokes accepted access, suppresses Waves and Circle membership, and does not notify the blocked user.

## Safe projection

Friends and Circle members see only allowlisted game fields the owner enabled. Garden preview is plot index + presentation key + stage + atmosphere. No nurture dates, ledger, Care Energy, location, or health fields.

Owner `GET /social/me/preview` uses the same projection a friend would see.

## Care Waves and Circles

- Types: `hello`, `cheer`, `proud_of_you`, `gentle_support`, `garden_love`. No free text. No rewards.
- Caps: one type/recipient/day, five outgoing/day, twenty received shown.
- One owned Circle, six members, 24h one-time invite code, explicit join/transfer/delete confirmations.

## Socket.IO

Optional `social:invalidate` `{ signal }` only. REST/database remains canonical.

## Migration

Canonical SQL: `server/prisma/phase45-medi-world-social.sql`  
Tracked folder: `20260913030000_medi_world_social` (after `20260913020000_medi_world_garden`).

Do not apply to production from this working tree. Do not use `prisma db push`.
