-- Medi World Phase 42 Explore — additive only.
-- Canonical apply (databases without `_prisma_migrations`):
--   npx prisma db execute --file prisma/phase42-medi-world-explore.sql --schema prisma/schema.prisma
-- Migrate-tracked databases:
--   npx prisma migrate deploy
--   (folder: prisma/migrations/20260912230000_medi_world_explore/)
-- Ordered after 20260912220000_medi_world_adventure (Phase 41).
-- Do not run against production from this working tree.
-- Do NOT use prisma db push.
-- Do not also migrate deploy the same change on the same database.
-- User-submitted coordinates are never stored. Public POI coordinates may be stored.

CREATE TABLE IF NOT EXISTS "WorldPlace" (
  "id" TEXT NOT NULL,
  "nameKa" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "placeType" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "coarseAreaKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'review',
  "active" BOOLEAN NOT NULL DEFAULT FALSE,
  "source" TEXT NOT NULL,
  "sourceIdentifier" TEXT NOT NULL,
  "accessibility" TEXT NOT NULL DEFAULT 'unknown',
  "accessibilityNote" TEXT,
  "safeHoursPolicy" TEXT,
  "lastReviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorldPlace_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "WorldPlace"
    ADD CONSTRAINT "WorldPlace_placeType_chk"
    CHECK ("placeType" IN ('park', 'public_square', 'public_garden', 'promenade', 'trail_entrance', 'community_space'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "WorldPlace"
    ADD CONSTRAINT "WorldPlace_status_chk"
    CHECK ("status" IN ('approved', 'review', 'rejected', 'inactive'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "WorldPlace"
    ADD CONSTRAINT "WorldPlace_accessibility_chk"
    CHECK ("accessibility" IN ('unknown', 'partial', 'accessible'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "WorldPlace"
    ADD CONSTRAINT "WorldPlace_lat_chk"
    CHECK ("latitude" >= -90 AND "latitude" <= 90);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "WorldPlace"
    ADD CONSTRAINT "WorldPlace_lng_chk"
    CHECK ("longitude" >= -180 AND "longitude" <= 180);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "WorldPlace_source_sourceIdentifier_key"
  ON "WorldPlace"("source", "sourceIdentifier");
CREATE INDEX IF NOT EXISTS "WorldPlace_coarseAreaKey_status_active_idx"
  ON "WorldPlace"("coarseAreaKey", "status", "active");

CREATE TABLE IF NOT EXISTS "CareSparkDefinition" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "locKey" TEXT NOT NULL,
  "rulesetVersion" TEXT NOT NULL DEFAULT 'medi-world-explore-v1',
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareSparkDefinition_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CareSparkDefinition"
    ADD CONSTRAINT "CareSparkDefinition_category_chk"
    CHECK ("category" IN ('movement', 'hydration', 'calm', 'care', 'connection'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CareSparkSpawn" (
  "id" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "windowKey" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "rulesetVersion" TEXT NOT NULL DEFAULT 'medi-world-explore-v1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareSparkSpawn_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CareSparkSpawn"
    ADD CONSTRAINT "CareSparkSpawn_status_chk"
    CHECK ("status" IN ('active', 'expired', 'disabled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "CareSparkSpawn"
    ADD CONSTRAINT "CareSparkSpawn_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "CareSparkDefinition"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "CareSparkSpawn"
    ADD CONSTRAINT "CareSparkSpawn_placeId_fkey"
    FOREIGN KEY ("placeId") REFERENCES "WorldPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "CareSparkSpawn_placeId_windowKey_key"
  ON "CareSparkSpawn"("placeId", "windowKey");
CREATE INDEX IF NOT EXISTS "CareSparkSpawn_placeId_status_idx"
  ON "CareSparkSpawn"("placeId", "status");
CREATE INDEX IF NOT EXISTS "CareSparkSpawn_expiresAt_idx"
  ON "CareSparkSpawn"("expiresAt");

CREATE TABLE IF NOT EXISTS "CareSparkCollection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "spawnId" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "coarseAreaKey" TEXT NOT NULL,
  "distanceBand" TEXT NOT NULL,
  "accuracyBand" TEXT NOT NULL,
  "verificationOutcome" TEXT NOT NULL,
  "rejectionReason" TEXT,
  "rulesetVersion" TEXT NOT NULL DEFAULT 'medi-world-explore-v1',
  "idempotencyKey" TEXT NOT NULL,
  "mockLocationSignal" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "CareSparkCollection_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CareSparkCollection"
    ADD CONSTRAINT "CareSparkCollection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "CareSparkCollection"
    ADD CONSTRAINT "CareSparkCollection_spawnId_fkey"
    FOREIGN KEY ("spawnId") REFERENCES "CareSparkSpawn"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "CareSparkCollection"
    ADD CONSTRAINT "CareSparkCollection_placeId_fkey"
    FOREIGN KEY ("placeId") REFERENCES "WorldPlace"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "CareSparkCollection"
    ADD CONSTRAINT "CareSparkCollection_distanceBand_chk"
    CHECK ("distanceBand" IN ('within_25m', 'within_75m', 'beyond', 'unknown'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "CareSparkCollection"
    ADD CONSTRAINT "CareSparkCollection_accuracyBand_chk"
    CHECK ("accuracyBand" IN ('fine', 'ok', 'poor', 'unknown'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "CareSparkCollection_userId_spawnId_key"
  ON "CareSparkCollection"("userId", "spawnId");
CREATE UNIQUE INDEX IF NOT EXISTS "CareSparkCollection_userId_idempotencyKey_key"
  ON "CareSparkCollection"("userId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "CareSparkCollection_userId_periodKey_idx"
  ON "CareSparkCollection"("userId", "periodKey");
CREATE INDEX IF NOT EXISTS "CareSparkCollection_userId_collectedAt_idx"
  ON "CareSparkCollection"("userId", "collectedAt");
