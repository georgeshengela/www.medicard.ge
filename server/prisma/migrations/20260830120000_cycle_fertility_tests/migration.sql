-- Phase 7: daily fertility-test observations on CycleLog.
-- Additive and nullable. Existing rows stay valid. No data rewrite.

ALTER TABLE "CycleLog" ADD COLUMN IF NOT EXISTS "ovulationTest" TEXT;
ALTER TABLE "CycleLog" ADD COLUMN IF NOT EXISTS "pregnancyTest" TEXT;
