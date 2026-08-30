-- Phase 8: current contraception method on CycleProfile (nullable = never asked).
-- Additive. Existing rows stay valid. No history table.

ALTER TABLE "CycleProfile" ADD COLUMN IF NOT EXISTS "contraceptionMethod" TEXT;
ALTER TABLE "CycleProfile" ADD COLUMN IF NOT EXISTS "contraceptionStartedAt" DATE;
