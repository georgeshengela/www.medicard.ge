-- Shared AI quota in-flight reservation. Independent of Pets tables.
-- Do NOT use prisma db push. Do NOT run against hosted Neon unless an operator explicitly asks.
-- Pets Phase 7 also includes this statement in pets-phase7.sql.

ALTER TABLE "PeriodUsage" ADD COLUMN IF NOT EXISTS "reserved" INTEGER NOT NULL DEFAULT 0;
