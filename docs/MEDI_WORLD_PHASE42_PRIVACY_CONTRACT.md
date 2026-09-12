# Medi World Phase 42 — Location privacy contract

**Status:** implemented with Phase 42. Not production-rolled.  
**Not Cycle Phase 42.** Cycle postpartum remains frozen.

This document is non-negotiable for Explore / Care Sparks. Product behavior lives in `docs/MEDI_WORLD_PHASE42_CONTRACT.md`.

## Permission

- Foreground location only. Never request background location, motion activity, or always-on GPS.
- Do not read location until the user intentionally opens Explore.
- Explain purpose in-app before the OS prompt.
- Denial leaves the rest of Medicard working. Explore falls back to list/browse of previously cached public places when possible.
- Approximate-location users may browse the map/list. Collection stays disabled until a fresh, sufficiently accurate sample exists.
- Do not repeatedly prompt after a permanent denial; offer system settings instead.

## What may exist, and where

Exact device coordinates may exist:

- transiently in device memory while Explore is foregrounded;
- in the body of `POST /api/medi-world/explore/sparks/:spawnId/collect` for geodesic / quality checks.

They must be discarded immediately after validation. They must not be copied into logs, analytics, error reports, Prisma records, or responses.

## What must never happen

- Exact live location shown to another user.
- Exact coordinates persisted on the user profile, World ledger, analytics, error tracking, request logs, or collection history.
- Movement trails.
- Home, work, clinic, or frequent-location profiles inferred or stored.
- Health conclusions from location.
- Location used for advertising.
- Coordinates sent to an LLM.
- Exact coordinates in push notifications or deep links.
- Explore collection going through `POST /api/location` / `UserLocation` (that path is weather/city, not World).

## What may be persisted

Public place coordinates (server-owned POIs) are public by definition.

User-side persisted fields are limited to:

- approved place ID;
- Care Spark spawn ID;
- collection timestamp;
- coarse public area key;
- rounded distance band;
- accuracy-quality band;
- verification outcome;
- rejection reason (privacy-safe code);
- ruleset version;
- local-day `periodKey` for the daily cap;
- idempotency key.

## Logging

Application logging must redact `latitude`, `longitude`, `lat`, `lng`, `coords`, `accuracy` when attached to Explore collect requests. Morgan must not print those query parameters. Prisma queries for collection must never include user coordinates.

## Feature flag

Explore is independently flagged (`MEDI_WORLD_EXPLORE_ENABLED`) and also requires Medi World to be enabled. Production stays off unless explicitly enabled.
