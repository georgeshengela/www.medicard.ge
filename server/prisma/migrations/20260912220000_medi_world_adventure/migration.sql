-- Medi World Phase 41 Daily Adventure. Additive. Keep in lockstep with prisma/phase41-medi-world-adventure.sql.
-- Canonical apply for this repository is prisma db execute of that file.
-- Use this folder only with prisma migrate deploy on migrate-tracked databases.
-- Do not run both against the same database.
-- Ordered after 20260912200000_medi_world_companion (Phase 40).

CREATE TABLE IF NOT EXISTS "MediWorldAdventurePreference" (
  "userId" TEXT NOT NULL,
  "intensity" TEXT NOT NULL DEFAULT 'gentle',
  "enabledCategories" JSONB NOT NULL DEFAULT '["movement", "hydration", "care"]',
  "allowVariety" BOOLEAN NOT NULL DEFAULT TRUE,
  "preferredRestWeekdays" JSONB NOT NULL DEFAULT '[]',
  "reducedPressureLanguage" BOOLEAN NOT NULL DEFAULT TRUE,
  "showTargets" BOOLEAN NOT NULL DEFAULT FALSE,
  "movementMode" TEXT NOT NULL DEFAULT 'default',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediWorldAdventurePreference_pkey" PRIMARY KEY ("userId")
);

DO $$ BEGIN
  ALTER TABLE "MediWorldAdventurePreference"
    ADD CONSTRAINT "MediWorldAdventurePreference_intensity_chk"
    CHECK ("intensity" IN ('gentle', 'balanced', 'active'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MediWorldAdventurePreference"
    ADD CONSTRAINT "MediWorldAdventurePreference_movementMode_chk"
    CHECK ("movementMode" IN ('default', 'wheelchair', 'low_mobility'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MediWorldAdventurePreference"
    ADD CONSTRAINT "MediWorldAdventurePreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MediWorldDailyAdventure" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "restDay" BOOLEAN NOT NULL DEFAULT FALSE,
  "restDayActivatedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'available',
  "swapCount" INTEGER NOT NULL DEFAULT 0,
  "reasonCodes" JSONB NOT NULL DEFAULT '[]',
  "narrativeKey" TEXT NOT NULL,
  "storyEventKey" TEXT,
  "companionReactionKey" TEXT,
  "rulesetVersion" TEXT NOT NULL DEFAULT 'medi-world-adventure-v1',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediWorldDailyAdventure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediWorldDailyAdventure_userId_periodKey_key"
  ON "MediWorldDailyAdventure"("userId", "periodKey");
CREATE INDEX IF NOT EXISTS "MediWorldDailyAdventure_userId_createdAt_idx"
  ON "MediWorldDailyAdventure"("userId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "MediWorldDailyAdventure"
    ADD CONSTRAINT "MediWorldDailyAdventure_swapCount_nonneg" CHECK ("swapCount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MediWorldDailyAdventure"
    ADD CONSTRAINT "MediWorldDailyAdventure_status_chk"
    CHECK ("status" IN ('available', 'in_progress', 'completed', 'rest_day', 'expired', 'unavailable'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MediWorldDailyAdventure"
    ADD CONSTRAINT "MediWorldDailyAdventure_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MediWorldAdventureSlot" (
  "id" TEXT NOT NULL,
  "adventureId" TEXT NOT NULL,
  "slotKey" TEXT NOT NULL,
  "optionKey" TEXT NOT NULL DEFAULT 'a',
  "capabilityKey" TEXT NOT NULL,
  "userQuestId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'available',
  "selected" BOOLEAN NOT NULL DEFAULT TRUE,
  "required" BOOLEAN NOT NULL DEFAULT TRUE,
  "swappedFromKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediWorldAdventureSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediWorldAdventureSlot_adventureId_slotKey_optionKey_key"
  ON "MediWorldAdventureSlot"("adventureId", "slotKey", "optionKey");
CREATE INDEX IF NOT EXISTS "MediWorldAdventureSlot_adventureId_slotKey_idx"
  ON "MediWorldAdventureSlot"("adventureId", "slotKey");

DO $$ BEGIN
  ALTER TABLE "MediWorldAdventureSlot"
    ADD CONSTRAINT "MediWorldAdventureSlot_slotKey_chk"
    CHECK ("slotKey" IN ('anchor', 'balance', 'choice'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MediWorldAdventureSlot"
    ADD CONSTRAINT "MediWorldAdventureSlot_optionKey_chk"
    CHECK ("optionKey" IN ('a', 'b'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MediWorldAdventureSlot"
    ADD CONSTRAINT "MediWorldAdventureSlot_status_chk"
    CHECK ("status" IN ('available', 'selected', 'in_progress', 'completed', 'swapped', 'expired', 'rest_day', 'unavailable'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MediWorldAdventureSlot"
    ADD CONSTRAINT "MediWorldAdventureSlot_adventureId_fkey"
    FOREIGN KEY ("adventureId") REFERENCES "MediWorldDailyAdventure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MediWorldAdventureSwap" (
  "id" TEXT NOT NULL,
  "adventureId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "slotKey" TEXT NOT NULL,
  "fromCapability" TEXT NOT NULL,
  "toCapability" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediWorldAdventureSwap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediWorldAdventureSwap_adventureId_idempotencyKey_key"
  ON "MediWorldAdventureSwap"("adventureId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "MediWorldAdventureSwap_adventureId_createdAt_idx"
  ON "MediWorldAdventureSwap"("adventureId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "MediWorldAdventureSwap"
    ADD CONSTRAINT "MediWorldAdventureSwap_adventureId_fkey"
    FOREIGN KEY ("adventureId") REFERENCES "MediWorldDailyAdventure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
