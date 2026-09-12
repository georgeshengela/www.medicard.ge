-- Phase 33 — user-opted prenatal care reminder prefs on existing planner state.
-- Live Neon has no _prisma_migrations. Apply with:
--   npx prisma db execute --file prisma/phase33-pregnancy-care-reminder.sql --schema prisma/schema.prisma

ALTER TABLE "PregnancyCarePlanItemState"
  ADD COLUMN IF NOT EXISTS "reminderEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PregnancyCarePlanItemState"
  ADD COLUMN IF NOT EXISTS "reminderOffset" INTEGER NOT NULL DEFAULT 1;
