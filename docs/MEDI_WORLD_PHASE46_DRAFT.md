# Medi World Phase 46 — draft contract

**Status:** DRAFT — proposed scope, not approved for implementation.  
**Date:** 2026-09-13  
**Not started:** no catalog import, no collection view, no new species, no themed gardens, no Explore unlocks, no extra plots.  
**Checkpoint preserved:** Phase 45.1 remains closed PASS. Artwork still deferred. One shared Medicard app. Existing Expo workflow.

This draft is for owner review. It does not change production, Neon, or the live catalog. Practice fixtures stay labeled practice fixtures.

Evidence for current behavior: `qa/medi-world-explore-garden-audit/` and `qa/medi-world-explore-garden-audit/cache-closure/`. Prior proposal: `docs/MEDI_WORLD_NEXT_ENGINE_PROPOSAL.md`.

---

## 0. How to read this draft

| Kind | Meaning |
| --- | --- |
| Existing verified rule | Already true in the repository and not reopened here. |
| Recommended new rule | Proposed for a later approved Phase 46 contract. Not implemented in this pass. |
| Owner decision | Short, consequential choice. Do not implement until answered. |

Do not change reward economics. Do not add plots, multiplayer, paid unlocks, plant decay, or Spark Care Energy / XP / Bond.

---

## 1. Existing verified rules

### Explore

- Renderer: Leaflet 1.9 in a React Native WebView, OSM raster tiles, list fallback.
- User position is live while Explore is open (`expo-location` foreground). Pins are not a live stream.
- Places are server `WorldPlace` rows. Nearby listing requires `status = approved` and `active = true`.
- Sparks are `CareSparkSpawn` rows in 6-hour UTC windows (`SPAWN_WINDOW_MS`). Discovery-only. No Care Energy, XP, Bond, Quest, or Adventure credit.
- Collect: 75 m geodesic, accuracy ≤ 50 m, sample ≤ 30 s, motorized ≥ 7 m/s blocked, daily cap 5. Server validation is authoritative.
- Duplicate spawn → `SPARK_ALREADY_COLLECTED`. History is `CareSparkCollection` (coarse area only; no user lat/lng).
- Production cannot load `development_fixture` rows (`canLoadExploreFixtures`).
- Current development coverage is one practice cell around the emulator Googleplex (`g37.40_-122.10`) with three labeled practice places. Empty cells use `noPlaces`.
- Client nearby cache (this pass): owner-scoped, cell-keyed, 6-hour freshness, generation/owner/cell commit guards, expired sparks stripped, successful refresh replaces the set including empty, location denial clears live position and locks collection. Snapshots are labeled previously loaded, never current nearby. Offline does not promise that a place is already gone.

### Garden

- Six **active** plots (`GARDEN_PLOT_COUNT = 6`). Unlocks at World 1 / 1 / 1 / 5 / 10 / 20. Not a lifetime plant cap.
- Stored plants are individual `CareGardenPlant` rows (`plotIndex = null`). Restore keeps `id`, stage, and `nurtureDays`. Restore costs no energy and does not delete.
- No storage cap in the service.
- Five species: `pulse_fern`, `dew_lily`, `moon_moss`, `heart_bloom`, `orbit_vine`. Four stages: seed → sprout → bloom → radiant (0 / 1 / 3 / 7 distinct qualifying `periodKey` days). Missing days do not wilt plants.
- Same species may be planted again as a new instance.
- World cap 50. Bond cap 20. Bond repeatable daily cap 5.
- Copy-only aftercare (Medi lines, growth kept, no countdown) is **guidance**, not a progression system.

### Shared product rules

- One Medicard app. Expo and installed clients read the same server catalog.
- Practice fixtures must remain visibly practice places and must not masquerade as verified real places.
- Phase 45.1 Social remains closed PASS and is out of this draft’s first slices.

---

## 2. Recommended first content approach

**Curated catalog + reviewed import workflow.**

Do not invent real places in this draft. Do not silently select a launch city. Do not scrape live OSM into `approved` + `active`.

Imported rows enter **review** (`active = false`) and stay invisible to Explore until a reviewer activates them. Expo and store clients stay on that same server catalog. Practice fixtures stay `source = development_fixture` and must remain labeled in the client (`fixtureBadge`).

First Explore slice keeps **discovery-only Sparks**. Nearby places do not unlock Garden species, plots, cosmetics, or energy.

---

## 3. Real place catalog (recommended new rules)

### 3.1 Identity and coordinates

| Field | Rule |
| --- | --- |
| Stable id | Server-owned string, never recycled after public activation. Prefer `place.{region}.{slug}` once a coverage decision exists. |
| Coordinates | Public POI latitude/longitude only. Never a user location. Same geodesic rules as today. |
| Coarse cell | Existing 0.05° `coarseAreaKey`. Clients request by cell, not by raw GPS in the place document. |
| Names | Required `nameKa` and `nameEn` (existing columns). |
| Descriptions | **Recommended new columns** `descriptionKa` / `descriptionEn`. Nullable in review; required before activation if the place is shown in the pin sheet as more than a name. Do not invent copy for unreviewed imports. |
| Types | Keep the existing allowlist (`park`, `public_square`, `public_garden`, `promenade`, `trail_entrance`, community space). No homes, clinics, schools, or private addresses. |

### 3.2 Provenance

Existing `source` + `sourceIdentifier` (`@@unique`) stay the import identity.

Recommended values:

- `development_fixture` — practice only, never a verified real place.
- `curator` — typed or pasted by a reviewer.
- `import_review` — file import awaiting review.

Store a human-readable attribution string (recommended new `sourceAttribution`, e.g. “curator entry”, “municipal list 2026-09”, “OSM changeset N — unverified”). Provenance is not activation.

### 3.3 Review status versus active flag

Keep both existing columns. Recommended states for `status`:

| status | active | Visible in Explore |
| --- | --- | --- |
| `review` | false | No |
| `needs_correction` | false | No |
| `approved` | true | Yes (if type allowed) |
| `approved` | false | No (soft off) |
| `removed` | false | No |

Imports always land in `review` + `active = false`.

### 3.4 Public-access review is not coordinate accuracy

A map pin is not a suitable destination. Recommended **two independent review fields** (new; do not overload `accessibility`):

| Field | Values | Meaning |
| --- | --- | --- |
| `accessReview` | `unknown` / `suitable_public` / `unsuitable` | Can a visitor legally and reasonably enter this as a public path/place? |
| `coordinateReview` | `unverified` / `verified` / `incorrect` | Is the stored lat/lng the intended entrance or centroid? |

**Activation rule (recommended):** `status = approved` and `active = true` only when `accessReview = suitable_public` **and** `coordinateReview = verified` **and** type is allowed. Coordinate verification alone must not activate. Accessibility (`unknown` / `partial` / `accessible`) stays a separate, possibly incomplete, visitor hint.

### 3.5 Duplicates

- Identity duplicate: same `(source, sourceIdentifier)` → upsert into review, do not create a second row.
- Geographic near-duplicate: two parks can share a cell. Do **not** auto-merge by coordinates.
- Reviewer merge: pick a surviving id, point the discarded row to `removed`, do not rewrite `CareSparkCollection` history.

### 3.6 Geographic coverage

Supported coverage **is** the set of approved+active cells. Everywhere else is the existing empty-region experience (`noPlaces`), not an error.

This draft does **not** name a launch city. Coverage is an owner decision (section 8).

### 3.7 Versioning and client invalidation

Existing client nearby cache (this pass):

- Owner + `coarseAreaKey` + `fetchedAt`.
- Freshness = Spark spawn window (6 hours UTC).
- Successful refresh replaces the set, including empty.
- Legacy unscoped blobs are ignored.

Recommended additional catalog signal for Phase 46:

- Integer `catalogRevision` on `GET /explore/config` and `GET /explore/area` (monotonically increased when a place is activated, deactivated, renamed, or coordinates change).
- Client drops the nearby snapshot when `catalogRevision` changes, even inside the 6-hour window.
- Practice fixtures and real places share the revision stream so Expo and installed clients invalidate together.

Do not store user movement history in cache or QA logs.

### 3.8 Persistent places versus six-hour Sparks

| Object | Lifetime | Role |
| --- | --- | --- |
| `WorldPlace` | Persistent POI | The destination. Survives spawn windows. |
| `CareSparkSpawn` | 6-hour UTC window | Optional discovery Spark on an **active** approved place. |

Deactivating a place removes it from nearby map/list/details after an authoritative refresh. Historical discoveries remain on `/explore` history and `CareSparkCollection`. They are not currently collectible places.

Expired windows are not collectible. Server `SPARK_EXPIRED` remains authoritative if the client is stale.

First slice: still discovery-only. No energy, XP, Bond, or content unlock from Sparks.

### 3.9 Correction and removal

1. Reviewer sets `needs_correction` or `removed` and `active = false`.
2. Optional coordinate/name/description edit stays in review until re-approved.
3. Clients drop the place on the next successful area refresh. Offline clients may still show a **previously loaded** snapshot until freshness expires; copy must not say the place is already gone.
4. Collection history is not deleted and is not a live pin.

### 3.10 Empty-region experience

Keep current `noPlaces` copy. Do not invent filler pins. Do not fall back to another cell’s cache as current nearby (already fixed this pass).

### 3.11 Practice fixtures

- Remain `source = development_fixture`.
- Client badge stays “სავარჯიშო ადგილი — არ არის დამოწმებული რეალური ადგილი”.
- Production cannot seed or list them.
- They must never be flipped to look like verified real places to pass a screenshot.

### 3.12 Smallest management workflow

There is **no** WorldPlace admin today (`server/admin` has no places module). Do **not** create a second admin application.

Recommended smallest path, in order:

1. Reuse the existing Admin V3 shell (`server/admin/v3/`) with one new `places` panel: table of review rows, filters (`status`, `accessReview`, `coordinateReview`, cell), activate/deactivate, and a CSV/JSON import that **only** creates `review` rows.
2. If that panel is not ready, a reviewer-run import script against disposable/staging Postgres plus the same SQL constraints, still ending in `review` + `active = false`. Not a production Neon change from this draft.

No public self-serve place editor. No live OSM autoload.

---

## 4. Meaningful Garden continuity (recommended first progression slice)

### 4.1 What this slice is

A **persistent plant collection view** over species the account already owns and the highest growth stage each species has reached.

It organizes existing progression. It does **not** create unlimited new content, extra plots, a storage cap, deletion, decay, or a tap-farm aftercare event.

### 4.2 Derive from existing plant rows

Prefer **derivation from `CareGardenPlant`**. No new history table is required for the first slice.

| Collection field | Derivation |
| --- | --- |
| Owned species | Distinct `catalogKey` for the garden owner. |
| Undiscovered species | Active catalog keys minus owned. Show as locked/unplanted, not as missing data. |
| Active instances | Rows with `plotIndex != null`. |
| Stored instances | Rows with `plotIndex = null`. |
| Highest achieved stage | `max(stageRank(stage))` across all instances of that `catalogKey` (active + stored). A later seed of the same species does not lower the collection badge. |
| Duplicate instances | Keep every row. Collection summary shows species + highest stage + counts (`activeCount`, `storedCount`). Drill-in lists instances by `id`. |

This preserves identity and growth because store/restore already keep the same row. Deleting plants to “clean the list” is out of scope and would destroy the history this view is meant to show.

### 4.3 Direct store / restore

- From an active instance: existing Store (plot frees, growth kept, restore costs no energy).
- From a stored instance: existing Restore onto a free unlocked plot.
- Collection is an index, not a second plant model. Use current `gardenStore` / `gardenRestore` APIs.

### 4.4 Pagination for large stored lists

There is no storage cap, so the stored list can grow. Do **not** add a surprise cap or deletion to make scrolling cheaper.

Recommended: keyset pagination on stored instances `ORDER BY storedAt DESC, id DESC` with a stable cursor. Page size 20. Species summary is at most the catalog size (today: 5) and does not need paging. Do not use offset pagination.

### 4.5 Empty, loading, offline, account switch

| State | Behavior |
| --- | --- |
| Empty | No `CareGardenPlant` rows. All five species undiscovered. CTA: existing garden / catalog. |
| Loading | Same as current garden fetch. |
| Offline | Last owner-scoped garden snapshot. Store/restore disabled. Do not imply a plant was removed. |
| Account switch | Clear collection UI immediately. `resetWorldEconomyCache` already runs on logout/adopt; collection must key by `userId` and must not show the previous account’s plants. |

Recommended small engine hardening (still not implemented here): stamp `gardenSnapshot` with `ownerId` the way Social already does, so a collection view cannot flash the wrong garden.

### 4.6 What remains finite

After this slice a player still has: five species, four stages, six plots, unlimited storage of the same species, World 50, Bond 20. Collection makes that visible. It does not extend the catalog.

---

## 5. Future content (not implemented, not approved)

Each item needs **new content** and **engine work**. None of these are in the first slices.

### 5.1 Additional reviewed species

- **New content:** catalog keys, localized names/descriptions, presentation keys, a11y strings, art (still deferred globally), Care Energy prices if they stay in the equal-price model.
- **Engine:** `GARDEN_PLANTS` expansion, catalog version bump, collection derivation automatically includes new keys as undiscovered until planted. No change to plot count or decay.
- **Not:** loot rarity, paid seeds, Explore-drop species unless owner decision 3 explicitly changes discovery-only.

### 5.2 Thematic garden environments

- **New content:** atmosphere/presentation packs (visual + copy) keyed to garden state, not to new plots.
- **Engine:** presentation layer only if it does not alter nurture math. Sharing still uses the existing Social projection (plot index + presentation key + stage + atmosphere) if Social is on.
- **Not:** a second garden save, raids, or public visitor worlds.

### 5.3 Repeatable optional objectives

- **New content:** bounded optional goals that use **existing** plants (example: “visit the collection”, “restore a stored plant once”).
- **Engine:** new objective table or Quest-adjacent template, explicit completion, no extra health-action farming.
- **Not:** an aftercare event whose only purpose is repetitive taps on hydration/steps/weight. Copy-only Medi guidance stays copy.

---

## 6. Proposed implementation slices (later, if approved)

These slices are a review order, not a license to start Phase 46 in this pass.

| Slice | Goal | Depends on owner |
| --- | --- | --- |
| **A — Reviewed place catalog** | Import workflow into `review`; Admin V3 places panel or equivalent; activation only after access + coordinate review; `catalogRevision`; empty-region unchanged; fixtures stay fixtures; Sparks stay discovery-only. | Decision 1 (coverage). |
| **B — Garden collection view** | Derive species + highest stage from `CareGardenPlant`; stored keyset pagination; store/restore entry points; empty/loading/offline/account-switch. | Decision 2 (is collection the first progression slice?). |
| **C — Future content** | More species / thematic environments / optional objectives, each with its own content + engine estimate. | Decision 3 plus separate approvals. |

Cache correctness for Explore nearby results is **already in this working tree** (not Phase 46). Do not reopen it as Slice A.

---

## 7. What this proposal solves, and what stays finite

**Solves (if approved):**

- Production Explore can show **reviewed real public places** in an owner-chosen coverage, without pretending OSM pins are safe destinations.
- After six plots and Radiant repeats, the player still has a **durable collection of owned species and highest stages**, including stored plants, without adding plots or a storage cap.
- Expo and installed clients stay on one catalog. Practice data cannot masquerade as verified places.

**Remains finite:**

- Six active plots.
- Five species until a later content slice.
- Four growth stages.
- World 50 / Bond 20.
- Sparks remain discovery-only unless owner decision 3 changes that.
- No live multiplayer map, no player locations, no decay, no paid unlocks.

---

## 8. Owner decisions (short)

1. **Initial real-world geographic coverage.** Which public area should the first reviewed catalog cover? This draft does not pick a city. Until this is answered, production Explore outside development fixtures stays empty-by-design.
2. **Is the plant collection view the desired first Garden progression slice?** If no, say what should replace it without adding plots, decay, or tap-farm aftercare.
3. **Should later Explore discoveries unlock Garden or other content?** Today they must not. Unlocking would change discovery-only Spark rules, economy assumptions, and the place-review bar. Default recommendation: **no**.

---

## 9. Explicit non-goals for this draft

- Phase 46 implementation in this working tree.
- Extra plots, storage caps, plant deletion, wilt/decay.
- Multiplayer, teams, chat, public player locations.
- Paid unlocks or Spark rewards (energy / XP / Bond).
- Aftercare as a repetitive health-action farm.
- A new standalone admin app.
- Inventing real POIs or quietly selecting a launch city.
- Reopening Phase 45.1 or changing artwork status.
