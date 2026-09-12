-- Phase 42 — explicit POSTPARTUM → TRACK forecast-gate provenance.
-- Live Neon has no _prisma_migrations. Apply with:
--   npx prisma db execute --file prisma/phase42-postpartum-return-forecast-gate.sql --schema prisma/schema.prisma
-- Additive only. Never backfilled. Ordinary TRACK users stay ungated.

ALTER TABLE "CycleProfile" ADD COLUMN IF NOT EXISTS "forecastGateKind" TEXT;
ALTER TABLE "CycleProfile" ADD COLUMN IF NOT EXISTS "forecastGateEpisodeId" TEXT;
