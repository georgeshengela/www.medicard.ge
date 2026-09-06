-- Medi Quest Phase 1: templates, assignments, immutable completions, reward ledger.
-- Additive. Live Neon still uses `db push` until migrate deploy is proven.

CREATE TABLE IF NOT EXISTS "QuestTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "cadence" TEXT NOT NULL,
  "titleKey" TEXT NOT NULL,
  "descriptionKey" TEXT NOT NULL,
  "progressType" TEXT NOT NULL,
  "defaultTarget" INTEGER NOT NULL,
  "rewardCoins" INTEGER NOT NULL DEFAULT 0,
  "rewardXp" INTEGER NOT NULL DEFAULT 0,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "config" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "QuestTemplate_key_key" ON "QuestTemplate"("key");
CREATE INDEX IF NOT EXISTS "QuestTemplate_isActive_cadence_priority_idx" ON "QuestTemplate"("isActive", "cadence", "priority");

CREATE TABLE IF NOT EXISTS "UserQuest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "target" INTEGER NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserQuest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserQuest_userId_templateId_periodKey_key" ON "UserQuest"("userId", "templateId", "periodKey");
CREATE INDEX IF NOT EXISTS "UserQuest_userId_status_idx" ON "UserQuest"("userId", "status");
CREATE INDEX IF NOT EXISTS "UserQuest_userId_periodKey_idx" ON "UserQuest"("userId", "periodKey");
CREATE INDEX IF NOT EXISTS "UserQuest_expiresAt_idx" ON "UserQuest"("expiresAt");

CREATE TABLE IF NOT EXISTS "QuestCompletion" (
  "id" TEXT NOT NULL,
  "userQuestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "progressAtCompletion" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "QuestCompletion_userQuestId_key" ON "QuestCompletion"("userQuestId");
CREATE INDEX IF NOT EXISTS "QuestCompletion_userId_completedAt_idx" ON "QuestCompletion"("userId", "completedAt");

CREATE TABLE IF NOT EXISTS "RewardLedger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "transactionType" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "RewardLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RewardLedger_userId_currency_sourceType_sourceId_key"
  ON "RewardLedger"("userId", "currency", "sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "RewardLedger_userId_createdAt_idx" ON "RewardLedger"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "RewardLedger_userId_currency_idx" ON "RewardLedger"("userId", "currency");

CREATE TABLE IF NOT EXISTS "UserQuestProfile" (
  "userId" TEXT NOT NULL,
  "currentLevel" INTEGER NOT NULL DEFAULT 1,
  "totalXp" INTEGER NOT NULL DEFAULT 0,
  "cachedCoinBalance" INTEGER NOT NULL DEFAULT 0,
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "longestStreak" INTEGER NOT NULL DEFAULT 0,
  "lastActiveQuestDate" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserQuestProfile_pkey" PRIMARY KEY ("userId")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserQuest_userId_fkey'
  ) THEN
    ALTER TABLE "UserQuest"
      ADD CONSTRAINT "UserQuest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserQuest_templateId_fkey'
  ) THEN
    ALTER TABLE "UserQuest"
      ADD CONSTRAINT "UserQuest_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "QuestTemplate"("id") ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'QuestCompletion_userQuestId_fkey'
  ) THEN
    ALTER TABLE "QuestCompletion"
      ADD CONSTRAINT "QuestCompletion_userQuestId_fkey"
      FOREIGN KEY ("userQuestId") REFERENCES "UserQuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'QuestCompletion_userId_fkey'
  ) THEN
    ALTER TABLE "QuestCompletion"
      ADD CONSTRAINT "QuestCompletion_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RewardLedger_userId_fkey'
  ) THEN
    ALTER TABLE "RewardLedger"
      ADD CONSTRAINT "RewardLedger_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserQuestProfile_userId_fkey'
  ) THEN
    ALTER TABLE "UserQuestProfile"
      ADD CONSTRAINT "UserQuestProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
