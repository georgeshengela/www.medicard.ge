-- Phase 41 — owner-classified postpartum bleed → menstrual period.
-- Live Neon has no _prisma_migrations. Apply with:
--   npx prisma db execute --file prisma/phase41-postpartum-bleed-classification.sql --schema prisma/schema.prisma
-- Additive only. Does not alter CycleLog.flow or CyclePostpartumEpisode.

CREATE TABLE IF NOT EXISTS "CyclePostpartumBleedClassification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "postpartumEpisodeId" TEXT NOT NULL,
  "bleedStart" TEXT NOT NULL,
  "bleedEnd" TEXT NOT NULL,
  "classification" TEXT NOT NULL DEFAULT 'MENSTRUAL_PERIOD',
  "source" TEXT NOT NULL DEFAULT 'OWNER',
  "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CyclePostpartumBleedClassification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CyclePostpartumBleedClassification_user_episode_start"
  ON "CyclePostpartumBleedClassification"("userId", "postpartumEpisodeId", "bleedStart");

CREATE INDEX IF NOT EXISTS "CyclePostpartumBleedClassification_user_episode"
  ON "CyclePostpartumBleedClassification"("userId", "postpartumEpisodeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CyclePostpartumBleedClassification_userId_fkey'
  ) THEN
    ALTER TABLE "CyclePostpartumBleedClassification"
      ADD CONSTRAINT "CyclePostpartumBleedClassification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CyclePostpartumBleedClassification_episode_fkey'
  ) THEN
    ALTER TABLE "CyclePostpartumBleedClassification"
      ADD CONSTRAINT "CyclePostpartumBleedClassification_episode_fkey"
      FOREIGN KEY ("postpartumEpisodeId") REFERENCES "CyclePostpartumEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
