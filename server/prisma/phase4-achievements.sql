-- Phase 4 — Achievements (additive only; never drops or mutates existing tables)
CREATE TABLE IF NOT EXISTS "AchievementDefinition" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "family" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "rarity" TEXT NOT NULL,
  "threshold" INTEGER NOT NULL,
  "rewardCoins" INTEGER NOT NULL DEFAULT 0,
  "rewardXp" INTEGER NOT NULL DEFAULT 0,
  "isSecret" BOOLEAN NOT NULL DEFAULT false,
  "titleKey" TEXT NOT NULL,
  "descriptionKey" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AchievementDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AchievementDefinition_key_key" ON "AchievementDefinition"("key");
CREATE INDEX IF NOT EXISTS "AchievementDefinition_isActive_sortOrder_idx" ON "AchievementDefinition"("isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "AchievementDefinition_family_idx" ON "AchievementDefinition"("family");

CREATE TABLE IF NOT EXISTS "UserAchievement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "progressAtUnlock" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'UNLOCKED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");
CREATE INDEX IF NOT EXISTS "UserAchievement_userId_status_idx" ON "UserAchievement"("userId", "status");
CREATE INDEX IF NOT EXISTS "UserAchievement_userId_unlockedAt_idx" ON "UserAchievement"("userId", "unlockedAt");

DO $$ BEGIN
  ALTER TABLE "UserAchievement"
    ADD CONSTRAINT "UserAchievement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UserAchievement"
    ADD CONSTRAINT "UserAchievement_achievementId_fkey"
    FOREIGN KEY ("achievementId") REFERENCES "AchievementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
