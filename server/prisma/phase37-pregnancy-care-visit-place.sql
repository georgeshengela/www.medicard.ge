-- Phase 37 — optional owner-entered visit place text on a planned prenatal care item.
-- Live Neon has no _prisma_migrations. Apply with:
--   npx prisma db execute --file prisma/phase37-pregnancy-care-visit-place.sql --schema prisma/schema.prisma
-- Text only. No lat/lon/placeId. Existing reminder and calendar rows must not change.

ALTER TABLE "PregnancyCarePlanItemState"
  ADD COLUMN IF NOT EXISTS "plannedPlace" TEXT;
