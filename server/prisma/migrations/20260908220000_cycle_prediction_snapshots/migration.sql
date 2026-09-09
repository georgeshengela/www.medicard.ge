-- Phase 8: historical Cycle prediction snapshots.
-- Additive. Does not change forecast math, confidence, or segmentation.

CREATE TABLE IF NOT EXISTS "CyclePredictionSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'NEXT_PERIOD_START',
  "predictedDate" TEXT NOT NULL,
  "snapshotDate" TEXT NOT NULL,
  "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cycleAnchorDate" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "engineVersion" INTEGER NOT NULL,
  "validGapCount" INTEGER NOT NULL DEFAULT 0,
  "isIrregular" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT NOT NULL DEFAULT 'stored',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CyclePredictionSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CyclePredictionSnapshot_identity"
  ON "CyclePredictionSnapshot"("userId", "type", "cycleAnchorDate", "predictedDate", "confidence", "engineVersion");

CREATE INDEX IF NOT EXISTS "CyclePredictionSnapshot_userId_cycleAnchorDate_idx"
  ON "CyclePredictionSnapshot"("userId", "cycleAnchorDate");

CREATE INDEX IF NOT EXISTS "CyclePredictionSnapshot_userId_snapshotDate_idx"
  ON "CyclePredictionSnapshot"("userId", "snapshotDate");

CREATE INDEX IF NOT EXISTS "CyclePredictionSnapshot_userId_type_createdAt_idx"
  ON "CyclePredictionSnapshot"("userId", "type", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CyclePredictionSnapshot_userId_fkey'
  ) THEN
    ALTER TABLE "CyclePredictionSnapshot"
      ADD CONSTRAINT "CyclePredictionSnapshot_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
