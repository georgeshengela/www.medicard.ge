# Medi Hunt implementation

Street-based chase next to Classic Medi Run. Expo Go workflow. No Viro, no world-anchored AR, no second wallet.

Public app identity: **1.0.0.8.6** (iOS marketing `1.8.6`). Native build integers stay **67**.

## Implemented

### Run hub and game

- Classic Medi Run is unchanged (pin radius 28 m / accuracy 45 m / client-owned session). The existing distance/steps sheet still opens from დაწყება.
- Run hub (`mobile/app/run/index.tsx`) adds a Medi Hunt card beside the Classic hero.
- Hunt setup, active map, encounter, and summary screens under `mobile/app/run/hunt*`.
- States: preparing, GPS wait, permission, unavailable streets / schema-soon, reconnecting, paused (resume + end), hunting vs chase, shields, timers, mission, pending/confirmed coins, simulation badge.
- Session default 15 minutes; gentle 20 minutes, fewer steps in graph data, still requires walking.
- Georgian copy in `mobile/src/i18n/hunt/catalog.js` with en/fr/ru. Product name is Medi.
- NativeWind: static Pressable styles. Overlay modals use existing fade convention.

### Walkable graph

- Injectable Overpass provider (`server/src/lib/hunt/overpass.js`) with timeout, size cap, retries, in-flight dedupe, User-Agent.
- Topology from **shared OSM node ids**, not visual line crossings. Fixture includes a disconnected “bridge” for tests.
- Pedestrian access precedence (`foot=*` over `access=*`). Motorways, private/no foot, indoor-unsuitable ways excluded. Gentle mode drops `highway=steps`.
- Session graph is the connected component from the player’s nearest walking node, then clipped to the 1 km square.
- Cache by cell; each session still clips to its own bounds.
- Attribution: OpenStreetMap contributors (map still Mapbox).
- Overpass is **not** treated as an unlimited SLA. Provider URL is admin-configurable HTTPS only.

If the graph is missing or too small: 422 `HUNT_GRAPH_UNAVAILABLE`. Client offers retry, Classic Run, or a clearly labelled local preview. No fake street grid in a reward-eligible session. Fixture/grid streets exist only in simulation or the labelled device preview.

### Server session and enemies

- Persistent `HuntSession` with versioned config snapshot.
- Start / snapshot / ping / pause / resume / end / expiry / encounter token.
- One active session per user by default. Ownership on every call.
- Server time, seq, rate limits, stale/out-of-order GPS rejection.
- Enemies: chaser, interceptor, patroller; flee on graph while hunting. Speeds stay at walking scale.
- Shields: contact removes a shield and combo; never deducts wallet coins; contact immunity window.
- Capsules: 120 s hunt, stacked cap 240 s, idempotent take.
- Pause: no movement or rewards while paused; hunt expiry uses server `huntUntil` (not extended by backgrounding); session TTL; resume syncs before actions.
- Encounter token expiry is committed **before** the 410 is thrown (not rolled back inside `$transaction`).
- Live kill switch and rewards disable override snapshots.
- `GET /api/app/status` never fails open if Hunt Prisma models or tables are missing.

### Location / 10 m encounters

- Hunt-only gates: ~10 m, accuracy ~10 m, several accepted fixes, dwell, graph proximity.
- Classic Run thresholds were not copied.
- Rejects jumps, stale samples, replays, expired hunting, wrong user/session, already-captured, off-graph parallel streets.
- GPS accuracy is **not** treated as proof of truth. UI: “ველოდებით უფრო ზუსტ ადგილმდებარეობას.”
- Server validation is a risk control, not anti-spoofing proof.

### Camera and character

- Source `C:\Users\User\Desktop\virus_1.glb` was **not** modified.
- Derived `mobile/assets/hunt/virus_1.glb`: **1,417,416 bytes**, target ~30–50k tris (optimizer `scripts/optimize-hunt-virus.py`). Skin was stripped after clustering broke bind pose. **No invented clips.** Procedural bob / turn / pulse / hit / dissolve on the whole object.
- Encounter: live `CameraView` + bundled `three.min.bin` + `GLTFLoader.bin` + local GLB in a WebView overlay. Not labelled AR. Copy states this is on-screen, not world-anchored.
- Server issues a short-lived one-use encounter token (~45 s), included on the owner snapshot for recovery. Hunting expiry during encounter does not extend the token. Completing with a still-valid token can still capture; cancel resumes chase without extra hunt time.
- Emulator / no-camera path is explicitly a preview and **cannot pay coins**. On Pixel emulator the derived virus rendered (hardware WebGL). Transparent live-camera composite on a physical device was **not** executed.
- Catalog key `virus_1` only. No remote GLB uploader.

### Rewards

- `RewardLedger.sourceType = HUNT`, stable `hunt:{kind}:{id}`.
- Default: session 5 / capture 1 / daily mission 3 / session cap 10 / daily cap 20.
- Qualified session: 250 m + 5 active minutes; gentle 150 m + 6 active minutes (not idle).
- Caps are Hunt-only; quest rates unchanged.
- Wallet label `ledgerHunt` in ka/en/fr/ru. `invalidateMediCoinBalance` after confirmed awards.
- Unique `(userId, currency, sourceType, sourceId)`. Existence check then insert. Unique conflicts retry **outside** the aborted Postgres transaction.
- Cache updated from ledger sum (same idea as achievements), not racy read-then-overwrite.
- Day boundary: existing quest timezone (`questYmd` / `getEffectiveQuestTimezone`).
- Share card has no route or home coordinates.
- Simulation never writes `HuntProgress` (competitive collection) or `RewardLedger`.

### Simulation

- `HuntSession.simulation` is immutable.
- Server QA grant (`HuntQaGrant`) is the security boundary — not `__DEV__`, not a client boolean.
- Simulation never writes `RewardLedger`.
- Fixture graph + scripted/local GPS only in simulation or explicit device preview when Hunt API is missing.
- No “QA payouts” bypass.

### Admin (`#/hunt`)

- Hash SPA tab: nav, `ADMIN_TABS`, `switchTab`, V3 palette, `v3/modules/hunt.js`.
- Capabilities: `HUNT_VIEW`, `HUNT_MANAGE`, `HUNT_QA_GRANT` (legacy null capabilities still mean full access).
- Overview metrics, enable/rewards kill switches, bounds and GPS/capture, enemy speeds/counts, capsules/hunt duration, coin amounts, qualify meters, session minutes, Overpass HTTPS URL, exclusions JSON, paginated sessions/captures/suspicious, terminate, QA grants, bundled model catalog (read-only), Hunt audit list (`HUNT_*`).
- Mutations audited (`HUNT_CONFIG_UPDATE`, `HUNT_SESSION_TERMINATE`, `HUNT_QA_GRANT` / `REVOKE`).
- Config validation rejects missing caps and enemy speeds above the walk cap.
- Public `GET /api/app/status` exposes only `{ enabled, rewardsEnabled, playAreaM, captureRadiusM, modelKey, attribution, schemaReady }` as sibling `hunt`. No Overpass URL, no QA list.

### Database

Additive Prisma models: `HuntConfig`, `HuntSession`, `HuntCapture`, `HuntQaGrant`, `HuntProgress`, `HuntGraphCache`, `HuntSuspicious`.

Migration: `server/prisma/migrations/20260914030000_medi_hunt/migration.sql`.

Migration SQL is additive (`CREATE TABLE IF NOT EXISTS`). Render `npm run release` is `prisma generate` + seed — **it does not `db push` or `migrate deploy`**, so Hunt tables are not created by a normal deploy. Until those tables exist, `/api/hunt` returns 503 `HUNT_SCHEMA_UNAVAILABLE` and the app falls back to labelled preview. `GET /api/app/status` stays fail-open.

`AppSettings` was **not** given a Hunt column, so existing settings reads keep working before Hunt tables exist.

## Asset measurements

| | Bytes | Notes |
| --- | ---: | --- |
| Desktop original (untouched) | 21,783,104 | ~501k tris, skinned, 0 clips |
| `mobile/assets/hunt/virus_1.glb` | 1,417,416 | clustered mesh, JPEG ~1024, skin stripped |

## What cannot be exercised until Hunt tables exist

Render deploys from `main` (`npm run release` = generate + seed, not `db push`). Hunt routes ship with this code; Prisma queries 503 until the additive Hunt tables exist.

Until those tables exist:

- Real Overpass graph start
- Server-validated GPS, capsules, encounters, coins
- Admin `#/hunt` against live Hunt rows

Expo Go can still review Hunt **UI** via the labelled device preview (no coins). Missing tables degrade to that preview or an unavailable message.

`GET /api/app/status` is fail-open for Hunt so Classic and the rest of the app keep booting.

## Verification

### Automated (passed)

`node --test` on:

- `server/src/lib/hunt/hunt.test.js` (12/12) — graph connectivity vs bridge, access rules, GPS gates, ~10 m capture, idle vs qualified, config validation, sim session never writes ledger, duplicate complete, cross-user 403, HUNT ledger idempotency, expired encounter token (commit then 410), public status without Prisma Hunt models
- Hunt catalog ka/en/fr/ru including `takeCapsule` / `pauseAction`
- Wallet `HUNT` label (`rewardsLogic.test.js`)
- Version `1.0.0.8.6`

Not re-run: full `npm test` suite (long). Quest/redemption writers were not rewritten; Hunt uses the same ledger unique key and ledger-sum cache pattern.

### Emulator (Pixel `emulator-5554`, Expo Go, API still `https://medicard.ge`)

Passed on this bundle:

- Run hub: Classic hero + Hunt card + totals, dark theme, Georgian copy
- Classic Medi Run target sheet still opens (კილომეტრი / 3 კმ / სამიზნის მონიშვნა)
- Hunt setup: mission, rewards, gentle mode, OSM attribution, schema-soon notice, labelled preview
- Device preview: Mapbox dark map + teal reachable grid + player + distinct enemy/capsule markers + simulation badge, 0 coins
- Capsule → hunting 2:00 + yellow hunt-state enemy + “გაჩერდი და დაიჭირე”
- Encounter preview: derived virus character, on-screen-not-AR copy, neutralize
- After capture: mission 1/2, confirmed coins 0
- Summary: 1 virus, 0 m, Medi Coins 0, not qualified, simulation badge

Screenshots: `qa/hunt-hub.png`, `qa/hunt-map.png`, `qa/hunt-hunting.png`, `qa/hunt-encounter-2.png`, `qa/hunt-summary.png`, `qa/hunt-classic-sheet.png`.

**Physical device camera/GPS: not executed. Not passed.** Emulator GPS did not walk the 10 m gate; preview collect/encounter buttons are the labelled simulation path.

### Still blocked on a real Hunt backend

1. Additive Hunt tables on production Neon (not created by Render seed).
2. Physical phone: live camera overlay compositing, GPS accuracy ~10 m, dwell, graph snap.

## Operating limits (Overpass)

Public `overpass-api.de` is a community service: 20 s timeout, 8 MB cap, 3 retries, cache TTL default 6 h. Self-host or switch provider in Hunt admin if rate-limited. Data does not certify real-world safety or accessibility.

## Files (high level)

Backend: `server/src/lib/hunt/*`, `server/src/routes/hunt.routes.js`, `server/src/routes/adminHunt.routes.js`, Prisma schema + migration.

Admin: `server/admin/v3/modules/hunt.js`, `index.html`, `admin.js`, `admin-v3.js`, `ops-center.js`, `admin-help-content.js`.

Mobile: Run hub + `app/run/hunt*.tsx`, `src/lib/hunt/*`, `src/components/hunt/*`, `src/i18n/hunt/catalog.js`, wallet `HUNT`, `app.json` 1.0.0.8.6.

## Unrelated work

Medi World deletions in the working tree were not restored.
