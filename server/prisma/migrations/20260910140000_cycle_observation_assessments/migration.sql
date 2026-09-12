-- Phase 28: explicit observation-assessment coverage on CycleLog.
-- Additive. Empty default. No historical backfill. Missing stays UNKNOWN.

ALTER TABLE "CycleLog" ADD COLUMN IF NOT EXISTS "observationAssessments" JSONB NOT NULL DEFAULT '{}';
