-- Medi Quest Phase 1.1: per-user IANA timezone + daily hop-guard fields.
-- Additive. Live Neon still uses `db push` until migrate deploy is proven.

ALTER TABLE "UserQuestProfile" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
ALTER TABLE "UserQuestProfile" ADD COLUMN IF NOT EXISTS "lastDailyAssignPeriodKey" TEXT;
ALTER TABLE "UserQuestProfile" ADD COLUMN IF NOT EXISTS "lastDailyAssignAt" TIMESTAMP(3);
