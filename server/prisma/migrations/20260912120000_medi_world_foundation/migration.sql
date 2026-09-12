-- Medi World Phase 38 foundation. Additive. No production data mutation.
-- Keep in lockstep with prisma/phase38-medi-world-foundation.sql.
-- Canonical apply for this repository is prisma db execute of that file.
-- Use this folder only with prisma migrate deploy on migrate-tracked databases.
-- Do not run both against the same database.

CREATE TABLE IF NOT EXISTS "MediWorldProfile" (
  "userId" TEXT NOT NULL,
  "rulesetVersion" INTEGER NOT NULL DEFAULT 1,
  "foundationXp" INTEGER NOT NULL DEFAULT 0,
  "foundationLevel" INTEGER NOT NULL DEFAULT 1,
  "energyMovement" INTEGER NOT NULL DEFAULT 0,
  "energyHydration" INTEGER NOT NULL DEFAULT 0,
  "energyCalm" INTEGER NOT NULL DEFAULT 0,
  "energyCare" INTEGER NOT NULL DEFAULT 0,
  "energyConnection" INTEGER NOT NULL DEFAULT 0,
  "companionProfileId" TEXT,
  "coarseCommunityKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediWorldProfile_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "MediWorldProfile_foundationXp_nonneg" CHECK ("foundationXp" >= 0),
  CONSTRAINT "MediWorldProfile_foundationLevel_pos" CHECK ("foundationLevel" >= 1),
  CONSTRAINT "MediWorldProfile_energyMovement_nonneg" CHECK ("energyMovement" >= 0),
  CONSTRAINT "MediWorldProfile_energyHydration_nonneg" CHECK ("energyHydration" >= 0),
  CONSTRAINT "MediWorldProfile_energyCalm_nonneg" CHECK ("energyCalm" >= 0),
  CONSTRAINT "MediWorldProfile_energyCare_nonneg" CHECK ("energyCare" >= 0),
  CONSTRAINT "MediWorldProfile_energyConnection_nonneg" CHECK ("energyConnection" >= 0)
);

DO $$ BEGIN
  ALTER TABLE "MediWorldProfile"
    ADD CONSTRAINT "MediWorldProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN ALTER TABLE "MediWorldProfile" ADD CONSTRAINT "MediWorldProfile_foundationXp_nonneg" CHECK ("foundationXp" >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "MediWorldProfile" ADD CONSTRAINT "MediWorldProfile_foundationLevel_pos" CHECK ("foundationLevel" >= 1); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "MediWorldProfile" ADD CONSTRAINT "MediWorldProfile_energyMovement_nonneg" CHECK ("energyMovement" >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "MediWorldProfile" ADD CONSTRAINT "MediWorldProfile_energyHydration_nonneg" CHECK ("energyHydration" >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "MediWorldProfile" ADD CONSTRAINT "MediWorldProfile_energyCalm_nonneg" CHECK ("energyCalm" >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "MediWorldProfile" ADD CONSTRAINT "MediWorldProfile_energyCare_nonneg" CHECK ("energyCare" >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "MediWorldProfile" ADD CONSTRAINT "MediWorldProfile_energyConnection_nonneg" CHECK ("energyConnection" >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MediWorldLedger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "adapterId" TEXT NOT NULL,
  "energyType" TEXT NOT NULL,
  "transactionType" TEXT NOT NULL DEFAULT 'CREDIT',
  "energyAmount" INTEGER NOT NULL DEFAULT 0,
  "foundationXp" INTEGER NOT NULL DEFAULT 0,
  "progressState" TEXT NOT NULL,
  "completionRatioBps" INTEGER NOT NULL DEFAULT 0,
  "rulesetVersion" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediWorldLedger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediWorldLedger_energyAmount_nonneg" CHECK ("energyAmount" >= 0),
  CONSTRAINT "MediWorldLedger_foundationXp_nonneg" CHECK ("foundationXp" >= 0),
  CONSTRAINT "MediWorldLedger_ratio_bps" CHECK ("completionRatioBps" >= 0 AND "completionRatioBps" <= 10000),
  CONSTRAINT "MediWorldLedger_transactionType_chk" CHECK ("transactionType" IN ('CREDIT', 'DEBIT'))
);

ALTER TABLE "MediWorldLedger" ADD COLUMN IF NOT EXISTS "transactionType" TEXT NOT NULL DEFAULT 'CREDIT';

DO $$ BEGIN
  ALTER TABLE "MediWorldLedger"
    ADD CONSTRAINT "MediWorldLedger_transactionType_chk"
    CHECK ("transactionType" IN ('CREDIT', 'DEBIT'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN ALTER TABLE "MediWorldLedger" ADD CONSTRAINT "MediWorldLedger_energyAmount_nonneg" CHECK ("energyAmount" >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "MediWorldLedger" ADD CONSTRAINT "MediWorldLedger_foundationXp_nonneg" CHECK ("foundationXp" >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "MediWorldLedger" ADD CONSTRAINT "MediWorldLedger_ratio_bps" CHECK ("completionRatioBps" >= 0 AND "completionRatioBps" <= 10000); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "MediWorldLedger_idempotencyKey_key"
  ON "MediWorldLedger"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "MediWorldLedger_userId_idempotencyKey_key"
  ON "MediWorldLedger"("userId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "MediWorldLedger_userId_createdAt_idx"
  ON "MediWorldLedger"("userId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "MediWorldLedger"
    ADD CONSTRAINT "MediWorldLedger_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
