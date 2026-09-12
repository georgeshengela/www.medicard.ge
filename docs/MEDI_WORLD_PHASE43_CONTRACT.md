# Medi World Phase 43 — Privacy-Preserving Movement Sessions

**Status:** Phase 43.1 **PASS**. Hub updates from the finish snapshot without remount. Distinct poor-GPS and expired-token UI inspected on Android. Continuation-token security tests pass. Not production-rolled. Not committed.  
**Product phase number:** Medi World 43.  
**Not Cycle Phase 43.** Cycle postpartum remains frozen.

Phases 38–42.1 remain locked accepted. Phase 44 (garden) is not started.

## Phase 43.1

Expo Router keeps Medi World Hub mounted under Movement. `useMediWorldProfile` used to fetch only on mount, so a movement reward stayed invisible until remount.

Finish now returns the read-only `GET /api/medi-world` snapshot (`getMediWorldProfileSnapshot`, no visit-Bond side effect). The client writes that snapshot into `worldEconomyCache` so Hub, daily XP, Care Energy, latest reward, and Companion balances update without remount, pull-to-refresh, or a second formula.

Expired continuation tokens re-anchor with `mediKey: reanchor` and copy distinct from poor GPS. Poor GPS remains `SEGMENT_INACCURATE` / `low_gps`.

Development-only poor-GPS arm: long-press GPS quality on an active session (`__DEV__` only). It overwrites accuracy to 80 m **after** a native `expo-location` sample. Impossible in production store builds. Not in ordinary navigation. Awards no progress. Coordinates are still not persisted.

Continuation tokens stay AES-256-GCM `mw1.<iv>.<tag>.<ciphertext>`. Production ignores caller secret overrides and refuses a missing/weak `JWT_SECRET`. Key remains `SHA-256(medi-world-movement-v1:${JWT_SECRET})`.

## Loop

Open Medi World or Explore → Movement session → mode and duration → safety confirmation → fresh foreground location → start → pause/resume/finish/abandon → verified duration → at most one World movement reward.

Feels like “Medi is moving with me.” Not a medical prescription, navigation product, surveillance system, or distance race.

## Ruleset

`medi-world-movement-v1`

- Active modes: `walk`, `run`, `gentle_move`. Inactive typed modes (`wheelchair`, `rehabilitation`, `low_mobility_assisted`) are not exposed.
- Duration targets: gentle 5/10/15 (default 5); walk/run 5/10/15/20/30 (default 10). Frozen after start.
- Sample age ≤ 30 s, accuracy ≤ 50 m, High-accuracy foreground only.
- Walk/gentle accepted up to 3.5 m/s; run up to 7 m/s; ≥12 m/s motorized reject.
- Credited interval capped at 20 s per segment. Paused, background, offline, and gap time do not count.
- Pedometer adapter is typed and **inactive** (`inactive_expo_go`). It never mints rewards.

## Privacy

Server may receive coordinates transiently to verify a segment. Persisted rows store aggregates only (session id, user, mode, durations, counts, distance band, quality, risk flags, completion, verification, period, ruleset, timestamps). No latitude, longitude, polyline, start/end, samples, or tokens in the database, history, logs, or cache.

Continuation tokens are AES-256-GCM (Node `createCipheriv`) with key `SHA-256(medi-world-movement-v1:${JWT_SECRET})`. They are not persisted and must not appear in URLs, analytics, or audit logs.

## Lifecycle

`created` · `active` · `paused` · `completed` · `abandoned` · `expired` · `verification_failed`

One open session per user. Server-authoritative, idempotent. Abandoned/expired/failed award zero. Completing beyond 100% pays no extra.

## Rewards

Trusted adapter `activity.movement_session`, source `MOVEMENT_SESSION`. Evidence is `verified` only with accepted segments. Phase 39 bands. One ledger row per session (`movement-session:{id}`). Daily movement Care Energy / World XP caps still apply. Quest and Adventure are not completed from this path.

## APIs

Authenticated, self-only, private/no-store:

- `GET/PUT /api/medi-world/movement/preferences`
- `GET /api/medi-world/movement/current`
- `POST /api/medi-world/movement/sessions`
- `POST .../sessions/:id/segments|pause|resume|finish|abandon`
- `GET /api/medi-world/movement/history`

Flag: `MEDI_WORLD_MOVEMENT_ENABLED` (on in non-production unless `0`; production off unless `1`). No production QA scenarios.

## Migration

Canonical additive SQL: `server/prisma/phase43-medi-world-movement.sql`  
Folder: `server/prisma/migrations/20260913010000_medi_world_movement/` (after Phase 42 `20260912230000_medi_world_explore`).

Apply from the accepted Phase 42 disposable baseline. Do not rewrite Cycle migrations. Do not apply to production.

See `server/docs/phase43-medi-world-movement-deploy.md`.
