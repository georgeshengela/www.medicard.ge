-- Phase 35 — optional owner-entered appointment clock on existing planner state.
-- Live Neon has no _prisma_migrations. Apply with:
--   npx prisma db execute --file prisma/phase35-pregnancy-care-appointment-time.sql --schema prisma/schema.prisma

ALTER TABLE "PregnancyCarePlanItemState"
  ADD COLUMN IF NOT EXISTS "plannedTime" TEXT;
