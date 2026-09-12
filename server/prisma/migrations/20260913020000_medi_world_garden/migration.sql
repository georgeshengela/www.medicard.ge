-- Medi World Phase 44 Personal Care Garden — additive only.
-- See prisma/phase44-medi-world-garden.sql for the canonical copy.

CREATE TABLE IF NOT EXISTS "CareGarden" (
  "userId" TEXT NOT NULL,
  "rulesetVersion" TEXT NOT NULL DEFAULT 'medi-world-garden-v1',
  "catalogVersion" TEXT NOT NULL DEFAULT 'medi-world-garden-v1',
  "lastVisitAt" TIMESTAMP(3),
  "lastSeenUnlockLevel" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareGarden_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "CareGardenPlant" (
  "id" TEXT NOT NULL,
  "gardenUserId" TEXT NOT NULL,
  "catalogKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "plotIndex" INTEGER,
  "stage" TEXT NOT NULL DEFAULT 'seed',
  "nurtureDays" INTEGER NOT NULL DEFAULT 0,
  "plantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "storedAt" TIMESTAMP(3),
  "catalogVersion" TEXT NOT NULL,
  "presentationKey" TEXT NOT NULL,
  "plantIdempotencyKey" TEXT,
  "debitLedgerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareGardenPlant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CareGardenNurtureEvent" (
  "id" TEXT NOT NULL,
  "gardenUserId" TEXT NOT NULL,
  "plantId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "creditLedgerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareGardenNurtureEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CareGardenEvent" (
  "id" TEXT NOT NULL,
  "gardenUserId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "plantId" TEXT,
  "catalogKey" TEXT,
  "fromPlot" INTEGER,
  "toPlot" INTEGER,
  "stage" TEXT,
  "uniqueKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareGardenEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CareGardenMutation" (
  "id" TEXT NOT NULL,
  "gardenUserId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "plantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareGardenMutation_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CareGarden"
    ADD CONSTRAINT "CareGarden_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CareGardenPlant"
    ADD CONSTRAINT "CareGardenPlant_gardenUserId_fkey"
    FOREIGN KEY ("gardenUserId") REFERENCES "CareGarden"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CareGardenNurtureEvent"
    ADD CONSTRAINT "CareGardenNurtureEvent_gardenUserId_fkey"
    FOREIGN KEY ("gardenUserId") REFERENCES "CareGarden"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CareGardenNurtureEvent"
    ADD CONSTRAINT "CareGardenNurtureEvent_plantId_fkey"
    FOREIGN KEY ("plantId") REFERENCES "CareGardenPlant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CareGardenEvent"
    ADD CONSTRAINT "CareGardenEvent_gardenUserId_fkey"
    FOREIGN KEY ("gardenUserId") REFERENCES "CareGarden"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CareGardenMutation"
    ADD CONSTRAINT "CareGardenMutation_gardenUserId_fkey"
    FOREIGN KEY ("gardenUserId") REFERENCES "CareGarden"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CareGardenPlant"
    ADD CONSTRAINT "CareGardenPlant_stage_chk"
    CHECK ("stage" IN ('seed', 'sprout', 'bloom', 'radiant'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CareGardenPlant"
    ADD CONSTRAINT "CareGardenPlant_category_chk"
    CHECK ("category" IN ('movement', 'hydration', 'calm', 'care', 'connection'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CareGardenPlant"
    ADD CONSTRAINT "CareGardenPlant_plot_chk"
    CHECK ("plotIndex" IS NULL OR ("plotIndex" >= 0 AND "plotIndex" <= 5));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CareGardenPlant"
    ADD CONSTRAINT "CareGardenPlant_nurture_chk"
    CHECK ("nurtureDays" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CareGardenEvent"
    ADD CONSTRAINT "CareGardenEvent_type_chk"
    CHECK ("type" IN ('planted', 'moved', 'stored', 'restored', 'plot_unlocked', 'stage_changed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "CareGardenPlant_plantIdempotencyKey_key"
  ON "CareGardenPlant" ("plantIdempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "CareGardenPlant_gardenUserId_plotIndex_key"
  ON "CareGardenPlant" ("gardenUserId", "plotIndex");

CREATE INDEX IF NOT EXISTS "CareGardenPlant_gardenUserId_category_idx"
  ON "CareGardenPlant" ("gardenUserId", "category");

CREATE UNIQUE INDEX IF NOT EXISTS "CareGardenNurtureEvent_plantId_periodKey_key"
  ON "CareGardenNurtureEvent" ("plantId", "periodKey");

CREATE INDEX IF NOT EXISTS "CareGardenNurtureEvent_gardenUserId_periodKey_idx"
  ON "CareGardenNurtureEvent" ("gardenUserId", "periodKey");

CREATE UNIQUE INDEX IF NOT EXISTS "CareGardenEvent_gardenUserId_uniqueKey_key"
  ON "CareGardenEvent" ("gardenUserId", "uniqueKey");

CREATE INDEX IF NOT EXISTS "CareGardenEvent_gardenUserId_createdAt_idx"
  ON "CareGardenEvent" ("gardenUserId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CareGardenMutation_gardenUserId_idempotencyKey_key"
  ON "CareGardenMutation" ("gardenUserId", "idempotencyKey");
