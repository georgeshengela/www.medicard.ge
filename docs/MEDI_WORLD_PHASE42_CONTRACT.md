# Medi World Phase 42 — Safe World Map, public places, and Care Sparks

**Status:** Phase 42.1 native Android location closure complete, awaiting review. Not production-rolled. Not committed.  
**Product phase number:** Medi World 42.  
**Not Cycle Phase 42.** Cycle postpartum remains frozen.

Phases 38–42.1 remain locked accepted. Phase 43 is movement sessions.

## Map technology

**Leaflet 1.9 in a `react-native-webview`**, OSM raster tiles (`tile.openstreetmap.org`).

Why:

- The app already maps inside a WebView (Run uses Mapbox GL JS). No second native map SDK.
- Expo Go compatible (no `react-native-maps` / Google Play Services native module).
- No new paid API-key dependency. Mapbox remains Run-only; Explore does not send the user’s viewport to Mapbox. Carto’s public `light_all`/`dark_all` URLs now watermark “API KEY REQUIRED”, so Explore uses OSM tiles.
- If the WebView/tile CDN fails, the equivalent list view is the product fallback.

## Loop

Open Medi World → Explore nearby → safety intro → permission explanation → foreground location → map or list of approved public places and Care Sparks → approach safely → collect when checks pass → discovery record + Medi reaction. No spendable reward.

## Ruleset

`medi-world-explore-v1`

- Collection radius 75 m (geodesic).
- Accuracy no worse than 50 m.
- Location sample no older than 30 s.
- Daily successful collections: 5 per accepted local day.
- Spawn window: 6-hour UTC buckets, one active spawn per approved place, deterministic.
- No LLM.

## Place types (allowed)

`park` · `public_square` · `public_garden` · `promenade` · `trail_entrance` · `community_space`

Forbidden even if inserted: homes, schools, children’s facilities, hospitals, clinics, pharmacies, religious buildings, police/military, road shoulders, railway, construction, abandoned buildings, private interiors, sensitive-health sites.

Only `approved` + `active` places spawn Sparks. Accessibility `unknown` stays unknown unless verified source data exists. Development fixtures are source `development_fixture`, impossible in production, never presented as verified real-world locations.

## APIs (authenticated, self-only)

- `GET /api/medi-world/explore/config`
- `GET /api/medi-world/explore/area/:coarseKey` — approved places + active spawns for one coarse cell
- `GET /api/medi-world/explore/sparks?coarseKey=`
- `POST /api/medi-world/explore/sparks/:spawnId/collect`
- `GET /api/medi-world/explore/collections`

No public admin/place-management endpoints. No global enumeration.

## Collection outcomes

`SPARK_COLLECTED` · `SPARK_ALREADY_COLLECTED` · `SPARK_TOO_FAR` · `SPARK_LOCATION_STALE` · `SPARK_LOCATION_INACCURATE` · `SPARK_EXPIRED` · `SPARK_PLACE_UNAVAILABLE` · `SPARK_DAILY_CAP_REACHED` · `SPARK_LOCATION_UNAVAILABLE` · `SPARK_VERIFICATION_REQUIRED` · `WORLD_IDEMPOTENCY_CONFLICT`

A success creates an append-only collection row and a derived **Care Sparks found** count. It must not create Care Energy, World XP, Quest XP, coins, Bond, cosmetics, medical records, Adventure completion, or achievements.

## Safety

Intro copy: stay aware of traffic, use public paths, do not enter private property, do not use the app while driving, stop if movement is unsafe, accessibility info may be incomplete.

If reported speed suggests motorized travel, collection is disabled and no progress is stored. There is no routing engine; “Open in maps” is an explicit user action and does not claim a safe or accessible route.

## Migration

Canonical additive SQL: `server/prisma/phase42-medi-world-explore.sql`  
Folder: `server/prisma/migrations/20260912230000_medi_world_explore/` (after Phase 41 `20260912220000_medi_world_adventure`).

Apply from the accepted Phase 41 disposable baseline. Do not claim the historical empty Prisma chain is fixed. Do not rewrite Cycle migrations. Do not apply to production.

See `server/docs/phase42-medi-world-explore-deploy.md`.
