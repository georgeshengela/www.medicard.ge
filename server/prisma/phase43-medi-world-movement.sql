-- Medi World Phase 43 movement sessions — additive only.
-- Canonical apply (databases without `_prisma_migrations`):
--   npx prisma db execute --file prisma/phase43-medi-world-movement.sql --schema prisma/schema.prisma
-- Migrate-tracked databases:
--   npx prisma migrate deploy
--   (folder: prisma/migrations/20260913010000_medi_world_movement/)
-- Ordered after 20260912230000_medi_world_explore (Phase 42).
-- Do not run against production from this working tree.
-- Do NOT use prisma db push.
-- User coordinates, routes, and raw samples are never stored.

CREATE TABLE IF NOT EXISTS "WorldMovementPreference" (
  "userId" TEXT NOT NULL,
  "movementMode" TEXT NOT NULL DEFAULT 'walk',
  "targetMinutes" INTEGER NOT NULL DEFAULT 10,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorldMovementPreference_pkey" PRIMARY KEY ("userId")
);

DO $$ BEGIN
  ALTER TABLE "WorldMovementPreference"
    ADD CONSTRAINT "WorldMovementPreference_mode_chk"
    CHECK ("movementMode" IN ('walk', 'run', 'gentle_move'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "WorldMovementPreference"
    ADD CONSTRAINT "WorldMovementPreference_target_chk"
    CHECK ("targetMinutes" IN (5, 10, 15, 20, 30));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorldMovementPreference"
    ADD CONSTRAINT "WorldMovementPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "WorldMovementSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "movementMode" TEXT NOT NULL,
  "targetDurationSec" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "acceptedDurationSec" INTEGER NOT NULL DEFAULT 0,
  "activeWallDurationSec" INTEGER NOT NULL DEFAULT 0,
  "pausedDurationSec" INTEGER NOT NULL DEFAULT 0,
  "acceptedSegmentCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedSegmentCount" INTEGER NOT NULL DEFAULT 0,
  "lastSequence" INTEGER NOT NULL DEFAULT 0,
  "distanceBand" TEXT NOT NULL DEFAULT 'none',
  "accuracyQuality" TEXT NOT NULL DEFAULT 'unknown',
  "mockLocationRisk" BOOLEAN NOT NULL DEFAULT FALSE,
  "motorizedRisk" BOOLEAN NOT NULL DEFAULT FALSE,
  "completionRatioBps" INTEGER NOT NULL DEFAULT 0,
  "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
  "periodKey" TEXT NOT NULL,
  "rulesetVersion" TEXT NOT NULL DEFAULT 'medi-world-movement-v1',
  "rewardLedgerId" TEXT,
  "startIdempotencyKey" TEXT NOT NULL,
  "lastSegmentIdempotencyKey" TEXT,
  "lastSegmentReason" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pausedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorldMovementSession_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "WorldMovementSession"
    ADD CONSTRAINT "WorldMovementSession_mode_chk"
    CHECK ("movementMode" IN ('walk', 'run', 'gentle_move'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "WorldMovementSession"
    ADD CONSTRAINT "WorldMovementSession_status_chk"
    CHECK ("status" IN ('created', 'active', 'paused', 'completed', 'abandoned', 'expired', 'verification_failed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "WorldMovementSession"
    ADD CONSTRAINT "WorldMovementSession_band_chk"
    CHECK ("distanceBand" IN ('none', 'within_100m', 'within_500m', 'within_2km', 'beyond_2km'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "WorldMovementSession"
    ADD CONSTRAINT "WorldMovementSession_quality_chk"
    CHECK ("accuracyQuality" IN ('unknown', 'good', 'mixed', 'poor'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "WorldMovementSession"
    ADD CONSTRAINT "WorldMovementSession_verify_chk"
    CHECK ("verificationStatus" IN ('pending', 'verified', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorldMovementSession"
    ADD CONSTRAINT "WorldMovementSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "WorldMovementSession_userId_startIdempotencyKey_key"
  ON "WorldMovementSession"("userId", "startIdempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "WorldMovementSession_user_open_key"
  ON "WorldMovementSession"("userId")
  WHERE "status" IN ('created', 'active', 'paused');
CREATE INDEX IF NOT EXISTS "WorldMovementSession_userId_status_idx"
  ON "WorldMovementSession"("userId", "status");
CREATE INDEX IF NOT EXISTS "WorldMovementSession_userId_createdAt_idx"
  ON "WorldMovementSession"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorldMovementSession_userId_periodKey_idx"
  ON "WorldMovementSession"("userId", "periodKey");
