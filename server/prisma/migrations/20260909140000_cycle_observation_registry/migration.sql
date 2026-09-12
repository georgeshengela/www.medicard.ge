-- Phase 11: registry-backed observation bag on CycleLog.
-- Additive. Existing rows stay valid. Does not change prediction math.

ALTER TABLE "CycleLog" ADD COLUMN IF NOT EXISTS "observations" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "CycleLog" ADD COLUMN IF NOT EXISTS "observationSchemaVersion" INTEGER NOT NULL DEFAULT 1;
