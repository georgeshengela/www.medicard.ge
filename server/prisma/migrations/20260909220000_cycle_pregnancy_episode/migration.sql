-- Phase 18: pregnancy episode foundation.
-- Additive. Does not alter CycleLog rows or forecast-engine columns.

CREATE TABLE IF NOT EXISTS "CyclePregnancyEpisode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "referenceDate" TEXT NOT NULL,
  "referenceType" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CyclePregnancyEpisode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CyclePregnancyEpisode_userId_status_idx"
  ON "CyclePregnancyEpisode"("userId", "status");

CREATE INDEX IF NOT EXISTS "CyclePregnancyEpisode_userId_startedAt_idx"
  ON "CyclePregnancyEpisode"("userId", "startedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CyclePregnancyEpisode_one_active"
  ON "CyclePregnancyEpisode"("userId")
  WHERE status = 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CyclePregnancyEpisode_userId_fkey'
  ) THEN
    ALTER TABLE "CyclePregnancyEpisode"
      ADD CONSTRAINT "CyclePregnancyEpisode_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
