-- Phase 32 — Pregnancy prenatal care planner (owner overrides only).
-- Live Neon has no _prisma_migrations. Apply with:
--   npx prisma db execute --file prisma/phase32-pregnancy-care-plan.sql --schema prisma/schema.prisma
-- Catalog items are NOT inserted here.

CREATE TABLE IF NOT EXISTS "PregnancyCarePlanItemState" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pregnancyEpisodeId" TEXT NOT NULL,
  "careItemId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "plannedDate" TEXT,
  "completedDate" TEXT,
  "note" TEXT,
  "catalogVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PregnancyCarePlanItemState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PregnancyCarePlanItemState_pregnancyEpisodeId_careItemId_key"
  ON "PregnancyCarePlanItemState"("pregnancyEpisodeId", "careItemId");

CREATE INDEX IF NOT EXISTS "PregnancyCarePlanItemState_userId_idx"
  ON "PregnancyCarePlanItemState"("userId");

CREATE INDEX IF NOT EXISTS "PregnancyCarePlanItemState_pregnancyEpisodeId_idx"
  ON "PregnancyCarePlanItemState"("pregnancyEpisodeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PregnancyCarePlanItemState_userId_fkey'
  ) THEN
    ALTER TABLE "PregnancyCarePlanItemState"
      ADD CONSTRAINT "PregnancyCarePlanItemState_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PregnancyCarePlanItemState_pregnancyEpisodeId_fkey'
  ) THEN
    ALTER TABLE "PregnancyCarePlanItemState"
      ADD CONSTRAINT "PregnancyCarePlanItemState_pregnancyEpisodeId_fkey"
      FOREIGN KEY ("pregnancyEpisodeId") REFERENCES "CyclePregnancyEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
