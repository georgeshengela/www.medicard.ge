-- Phase 9: structured daily observations on CycleLog + user custom tags.
-- Additive. Existing rows stay valid. Does not change prediction math.

ALTER TABLE "CycleLog" ADD COLUMN IF NOT EXISTS "painEntries" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "CycleLog" ADD COLUMN IF NOT EXISTS "sleepQuality" TEXT;
ALTER TABLE "CycleLog" ADD COLUMN IF NOT EXISTS "stressLevel" TEXT;
ALTER TABLE "CycleLog" ADD COLUMN IF NOT EXISTS "exerciseLevel" TEXT;
ALTER TABLE "CycleLog" ADD COLUMN IF NOT EXISTS "caffeine" TEXT;
ALTER TABLE "CycleLog" ADD COLUMN IF NOT EXISTS "alcohol" TEXT;
ALTER TABLE "CycleLog" ADD COLUMN IF NOT EXISTS "customTagIds" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS "CycleCustomTag" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameNormalized" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "CycleCustomTag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CycleCustomTag_userId_archivedAt_idx" ON "CycleCustomTag"("userId", "archivedAt");
CREATE INDEX IF NOT EXISTS "CycleCustomTag_userId_nameNormalized_idx" ON "CycleCustomTag"("userId", "nameNormalized");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CycleCustomTag_userId_fkey'
  ) THEN
    ALTER TABLE "CycleCustomTag"
      ADD CONSTRAINT "CycleCustomTag_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
