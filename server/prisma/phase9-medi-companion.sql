-- Medi Companion Phase 9 — additive only.
-- Apply: npx prisma db execute --file prisma/phase9-medi-companion.sql --schema prisma/schema.prisma
-- Do NOT use prisma db push.

CREATE TABLE IF NOT EXISTS "MediCompanionProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "selectedCosmetics" JSONB NOT NULL DEFAULT '{}',
  "selectedEnvironmentKey" TEXT NOT NULL DEFAULT 'env.day',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediCompanionProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediCompanionProfile_userId_key" ON "MediCompanionProfile"("userId");

DO $$ BEGIN
  ALTER TABLE "MediCompanionProfile"
    ADD CONSTRAINT "MediCompanionProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MediJourneyUnlock" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "milestoneKey" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediJourneyUnlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediJourneyUnlock_userId_milestoneKey_key"
  ON "MediJourneyUnlock"("userId", "milestoneKey");
CREATE INDEX IF NOT EXISTS "MediJourneyUnlock_userId_unlockedAt_idx"
  ON "MediJourneyUnlock"("userId", "unlockedAt");

DO $$ BEGIN
  ALTER TABLE "MediJourneyUnlock"
    ADD CONSTRAINT "MediJourneyUnlock_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
