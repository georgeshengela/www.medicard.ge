-- Phase 38: postpartum tracking mode foundation.
-- Additive. Does not alter forecast-engine formulas. Does not backfill CycleLog.

ALTER TABLE "CycleLog"
  ADD COLUMN IF NOT EXISTS "trackingContext" TEXT,
  ADD COLUMN IF NOT EXISTS "postpartumEpisodeId" TEXT;

CREATE INDEX IF NOT EXISTS "CycleLog_userId_trackingContext_idx"
  ON "CycleLog"("userId", "trackingContext");

CREATE INDEX IF NOT EXISTS "CycleLog_postpartumEpisodeId_idx"
  ON "CycleLog"("postpartumEpisodeId");

CREATE TABLE IF NOT EXISTS "CyclePostpartumEpisode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "referenceDate" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CyclePostpartumEpisode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CyclePostpartumEpisode_userId_status_idx"
  ON "CyclePostpartumEpisode"("userId", "status");

CREATE INDEX IF NOT EXISTS "CyclePostpartumEpisode_userId_startedAt_idx"
  ON "CyclePostpartumEpisode"("userId", "startedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CyclePostpartumEpisode_one_active"
  ON "CyclePostpartumEpisode"("userId")
  WHERE status = 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CyclePostpartumEpisode_userId_fkey'
  ) THEN
    ALTER TABLE "CyclePostpartumEpisode"
      ADD CONSTRAINT "CyclePostpartumEpisode_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CycleLog_postpartumEpisodeId_fkey'
  ) THEN
    ALTER TABLE "CycleLog"
      ADD CONSTRAINT "CycleLog_postpartumEpisodeId_fkey"
      FOREIGN KEY ("postpartumEpisodeId") REFERENCES "CyclePostpartumEpisode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
