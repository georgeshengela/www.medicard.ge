-- Medi Hunt (additive). CREATE TABLE IF NOT EXISTS. Safe to re-run.
-- Apply with: npx prisma db execute --file prisma/migrations/20260914030000_medi_hunt/migration.sql

CREATE TABLE IF NOT EXISTS "HuntConfig" (
  "id" TEXT NOT NULL,
  "rules" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HuntConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HuntSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "simulation" BOOLEAN NOT NULL DEFAULT false,
  "seq" INTEGER NOT NULL DEFAULT 0,
  "config" JSONB NOT NULL,
  "bounds" JSONB NOT NULL,
  "graph" JSONB NOT NULL,
  "entities" JSONB NOT NULL,
  "origin" JSONB NOT NULL,
  "lastFix" JSONB,
  "recentFixes" JSONB,
  "shields" INTEGER NOT NULL DEFAULT 3,
  "huntUntil" TIMESTAMP(3),
  "immuneUntil" TIMESTAMP(3),
  "encounter" JSONB,
  "distanceM" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "activeMs" INTEGER NOT NULL DEFAULT 0,
  "pausedAt" TIMESTAMP(3),
  "lastSimAt" TIMESTAMP(3) NOT NULL,
  "lastPingAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "coinsAwarded" INTEGER NOT NULL DEFAULT 0,
  "captures" INTEGER NOT NULL DEFAULT 0,
  "capsules" INTEGER NOT NULL DEFAULT 0,
  "hunts" INTEGER NOT NULL DEFAULT 0,
  "combo" INTEGER NOT NULL DEFAULT 0,
  "mission" JSONB,
  "gpsHint" TEXT,
  "endReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HuntSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HuntSession_userId_status_idx" ON "HuntSession"("userId", "status");
CREATE INDEX IF NOT EXISTS "HuntSession_createdAt_idx" ON "HuntSession"("createdAt");
CREATE INDEX IF NOT EXISTS "HuntSession_simulation_createdAt_idx" ON "HuntSession"("simulation", "createdAt");

CREATE TABLE IF NOT EXISTS "HuntCapture" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "enemyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HuntCapture_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HuntCapture_sessionId_enemyId_key" ON "HuntCapture"("sessionId", "enemyId");
CREATE INDEX IF NOT EXISTS "HuntCapture_userId_createdAt_idx" ON "HuntCapture"("userId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "HuntCapture"
    ADD CONSTRAINT "HuntCapture_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "HuntSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "HuntConfig" ("id", "rules", "updatedAt")
VALUES ('default', '{"version":1}', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "HuntQaGrant" (
  "userId" TEXT NOT NULL,
  "grantedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HuntQaGrant_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "HuntProgress" (
  "userId" TEXT NOT NULL,
  "viruses" INTEGER NOT NULL DEFAULT 0,
  "titles" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HuntProgress_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "HuntGraphCache" (
  "cellKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HuntGraphCache_pkey" PRIMARY KEY ("cellKey")
);

CREATE TABLE IF NOT EXISTS "HuntSuspicious" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT,
  "reason" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HuntSuspicious_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HuntSuspicious_createdAt_idx" ON "HuntSuspicious"("createdAt");
CREATE INDEX IF NOT EXISTS "HuntSuspicious_userId_createdAt_idx" ON "HuntSuspicious"("userId", "createdAt");
