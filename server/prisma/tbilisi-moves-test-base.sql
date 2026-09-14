-- Isolated Medicard prerequisite tables for თბილისი მოძრაობს SQL tests.
-- This is NOT a full production schema. It exists so Phase 2 FKs to "User"
-- succeed and Prisma can create the accounts / health rows the competition
-- tests need. Never apply this to hosted Neon.

CREATE TABLE IF NOT EXISTS "_tbilisi_moves_disposable" (
  "id" TEXT NOT NULL,
  "marker" TEXT NOT NULL,
  CONSTRAINT "_tbilisi_moves_disposable_pkey" PRIMARY KEY ("id")
);

INSERT INTO "_tbilisi_moves_disposable" ("id", "marker")
VALUES ('guard', 'medicard-tbilisi-moves-disposable')
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "phone" TEXT,
  "gender" TEXT,
  "birthDate" DATE,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "packageId" TEXT,
  "packageStartedAt" TIMESTAMP(3),
  "packageExpiresAt" TIMESTAMP(3),
  "adminNote" TEXT,
  "points" INTEGER NOT NULL DEFAULT 0,
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "longestStreak" INTEGER NOT NULL DEFAULT 0,
  "lastCheckInDate" DATE,
  "aiEngine" TEXT NOT NULL DEFAULT 'gemini_flash',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");
CREATE INDEX IF NOT EXISTS "User_status_idx" ON "User"("status");
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");

CREATE TABLE IF NOT EXISTS "Admin" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "capabilities" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Admin_email_key" ON "Admin"("email");

CREATE TABLE IF NOT EXISTS "HealthMetricDaily" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "steps" INTEGER,
  "weightKg" DOUBLE PRECISION,
  "bloodPressureSystolic" INTEGER,
  "bloodPressureDiastolic" INTEGER,
  "heartRate" DOUBLE PRECISION,
  "sleepHours" DOUBLE PRECISION,
  "nutritionKcal" DOUBLE PRECISION,
  "hydrationMl" DOUBLE PRECISION,
  "activeMinutes" INTEGER,
  "distanceKm" DOUBLE PRECISION,
  "source" TEXT NOT NULL DEFAULT 'device',
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HealthMetricDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HealthMetricDaily_userId_date_key" ON "HealthMetricDaily"("userId", "date");
CREATE INDEX IF NOT EXISTS "HealthMetricDaily_userId_date_idx" ON "HealthMetricDaily"("userId", "date");

DO $$ BEGIN
  ALTER TABLE "HealthMetricDaily"
    ADD CONSTRAINT "HealthMetricDaily_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "StepLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "stepCount" INTEGER NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'device',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StepLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StepLog_userId_recordedAt_key" ON "StepLog"("userId", "recordedAt");
CREATE INDEX IF NOT EXISTS "StepLog_userId_recordedAt_idx" ON "StepLog"("userId", "recordedAt");

DO $$ BEGIN
  ALTER TABLE "StepLog"
    ADD CONSTRAINT "StepLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "adminId" TEXT,
  "adminEmail" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "previousValue" JSONB,
  "newValue" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");
