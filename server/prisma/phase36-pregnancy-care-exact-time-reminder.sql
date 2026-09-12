-- Phase 36 — optional exact-time reminder mode on existing planner reminder fields.
-- Live Neon has no _prisma_migrations. Apply with:
--   npx prisma db execute --file prisma/phase36-pregnancy-care-exact-time-reminder.sql --schema prisma/schema.prisma
-- Legacy rows: reminderMode NULL = DATE_BASED. Existing 09:00 reminders must not reschedule to plannedTime.

ALTER TABLE "PregnancyCarePlanItemState"
  ADD COLUMN IF NOT EXISTS "reminderMode" TEXT;

ALTER TABLE "PregnancyCarePlanItemState"
  ADD COLUMN IF NOT EXISTS "exactReminderOffsetMinutes" INTEGER;
