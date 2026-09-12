-- Medi World Phase 40 Companion — additive only.
-- Canonical apply:
--   npx prisma db execute --file prisma/phase40-medi-world-companion.sql --schema prisma/schema.prisma
-- Do not run against production from this working tree.
-- Do NOT use prisma db push.
-- Requires Phase 9 MediCompanionProfile and Phase 38/39 World tables.
-- Safe to re-run (IF NOT EXISTS). Do not also migrate deploy the same change on the same DB.

ALTER TABLE "MediCompanionProfile" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "MediCompanionProfile" ADD COLUMN IF NOT EXISTS "worldStageKey" TEXT NOT NULL DEFAULT 'spark';
ALTER TABLE "MediCompanionProfile" ADD COLUMN IF NOT EXISTS "bondPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MediCompanionProfile" ADD COLUMN IF NOT EXISTS "lastWorldVisitPeriodKey" TEXT;
ALTER TABLE "MediCompanionProfile" ADD COLUMN IF NOT EXISTS "lastCareMomentPeriodKey" TEXT;
ALTER TABLE "MediCompanionProfile" ADD COLUMN IF NOT EXISTS "lastCareMomentKey" TEXT;
ALTER TABLE "MediCompanionProfile" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "MediCompanionProfile" ADD COLUMN IF NOT EXISTS "equippedAuraKey" TEXT NOT NULL DEFAULT 'aura_teal_origin';
ALTER TABLE "MediCompanionProfile" ADD COLUMN IF NOT EXISTS "equippedTrailKey" TEXT;
ALTER TABLE "MediCompanionProfile" ADD COLUMN IF NOT EXISTS "equippedCharmKey" TEXT;
ALTER TABLE "MediCompanionProfile" ADD COLUMN IF NOT EXISTS "equippedAccentKey" TEXT;

DO $$ BEGIN
  ALTER TABLE "MediCompanionProfile"
    ADD CONSTRAINT "MediCompanionProfile_bondPoints_nonneg" CHECK ("bondPoints" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MediCompanionWorldStageUnlock" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stageKey" TEXT NOT NULL,
  "worldLevelAtUnlock" INTEGER NOT NULL,
  "rulesetVersion" INTEGER NOT NULL DEFAULT 1,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediCompanionWorldStageUnlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediCompanionWorldStageUnlock_userId_stageKey_key"
  ON "MediCompanionWorldStageUnlock"("userId", "stageKey");
CREATE INDEX IF NOT EXISTS "MediCompanionWorldStageUnlock_userId_unlockedAt_idx"
  ON "MediCompanionWorldStageUnlock"("userId", "unlockedAt");

DO $$ BEGIN
  ALTER TABLE "MediCompanionWorldStageUnlock"
    ADD CONSTRAINT "MediCompanionWorldStageUnlock_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MediCompanionBondEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "periodKey" TEXT,
  "rulesetVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediCompanionBondEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediCompanionBondEvent_points_nonneg" CHECK ("points" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediCompanionBondEvent_idempotencyKey_key"
  ON "MediCompanionBondEvent"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "MediCompanionBondEvent_userId_idempotencyKey_key"
  ON "MediCompanionBondEvent"("userId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "MediCompanionBondEvent_userId_periodKey_idx"
  ON "MediCompanionBondEvent"("userId", "periodKey");
CREATE INDEX IF NOT EXISTS "MediCompanionBondEvent_userId_createdAt_idx"
  ON "MediCompanionBondEvent"("userId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "MediCompanionBondEvent"
    ADD CONSTRAINT "MediCompanionBondEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MediCompanionBondEvent"
    ADD CONSTRAINT "MediCompanionBondEvent_points_nonneg" CHECK ("points" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MediCompanionCosmeticOwn" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "catalogKey" TEXT NOT NULL,
  "catalogVersion" INTEGER NOT NULL DEFAULT 1,
  "debitLedgerId" TEXT,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediCompanionCosmeticOwn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediCompanionCosmeticOwn_userId_catalogKey_key"
  ON "MediCompanionCosmeticOwn"("userId", "catalogKey");
CREATE INDEX IF NOT EXISTS "MediCompanionCosmeticOwn_userId_unlockedAt_idx"
  ON "MediCompanionCosmeticOwn"("userId", "unlockedAt");

DO $$ BEGIN
  ALTER TABLE "MediCompanionCosmeticOwn"
    ADD CONSTRAINT "MediCompanionCosmeticOwn_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
