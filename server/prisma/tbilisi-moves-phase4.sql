-- თბილისი მოძრაობს Phase 4 — results, awards, reward-policy columns.
-- Additive. Apply AFTER prisma/tbilisi-moves-phase2.sql.
--
-- Fresh schema:     phase2.sql → phase4.sql
-- Existing Phase 2: phase4.sql only (ADD COLUMN IF NOT EXISTS).
--
-- npx prisma db execute --file prisma/tbilisi-moves-phase4.sql --schema prisma/schema.prisma
-- Do NOT use prisma db push. Do NOT run against hosted Neon unless an operator explicitly asks.

ALTER TABLE "TbilisiMovesConfig"
  ADD COLUMN IF NOT EXISTS "leaderRecognitionEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TbilisiMovesConfig"
  ADD COLUMN IF NOT EXISTS "leaderRewardedRanks" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "TbilisiMovesConfig"
  ADD COLUMN IF NOT EXISTS "districtGoalBadgeEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "TbilisiMovesConfig" DROP CONSTRAINT IF EXISTS "TbilisiMovesConfig_bounds_check";
ALTER TABLE "TbilisiMovesConfig"
  ADD CONSTRAINT "TbilisiMovesConfig_bounds_check" CHECK (
    "defaultDailyTarget" >= 1000 AND "defaultDailyTarget" <= 50000000
    AND "competitiveCap" >= 1000 AND "competitiveCap" <= 50000
    AND "cooldownDays" >= 1 AND "cooldownDays" <= 365
    AND "minParticipantsForRank" >= 1 AND "minParticipantsForRank" <= 10000
    AND "lateSyncGraceHours" >= 1 AND "lateSyncGraceHours" <= 24
    AND "sanityMaxRawSteps" >= 20000 AND "sanityMaxRawSteps" <= 200000
    AND "correctionDropFlagPct" >= 10 AND "correctionDropFlagPct" <= 90
    AND "competitiveCap" <= "sanityMaxRawSteps"
    AND "leaderRewardedRanks" >= 1 AND "leaderRewardedRanks" <= 10
    AND "revision" >= 1
  );

ALTER TABLE "TbilisiMovesRound"
  ADD COLUMN IF NOT EXISTS "resultRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TbilisiMovesRound"
  ADD COLUMN IF NOT EXISTS "latestResultId" TEXT;

CREATE TABLE IF NOT EXISTS "TbilisiMovesResultRevision" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "previewHash" TEXT NOT NULL,
  "rulesSnapshot" JSONB NOT NULL,
  "districtResults" JSONB NOT NULL,
  "peopleResults" JSONB NOT NULL,
  "awardPlan" JSONB NOT NULL,
  "eligibleCreditCount" INTEGER NOT NULL DEFAULT 0,
  "awardCount" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT,
  "createdByAdminId" TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TbilisiMovesResultRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TbilisiMovesResultRevision_roundId_revision_key"
  ON "TbilisiMovesResultRevision"("roundId", "revision");
CREATE INDEX IF NOT EXISTS "TbilisiMovesResultRevision_date_revision_idx"
  ON "TbilisiMovesResultRevision"("date", "revision");
CREATE INDEX IF NOT EXISTS "TbilisiMovesResultRevision_previewHash_idx"
  ON "TbilisiMovesResultRevision"("previewHash");

ALTER TABLE "TbilisiMovesResultRevision" DROP CONSTRAINT IF EXISTS "TbilisiMovesResultRevision_kind_check";
ALTER TABLE "TbilisiMovesResultRevision"
  ADD CONSTRAINT "TbilisiMovesResultRevision_kind_check" CHECK ("kind" IN ('INITIAL', 'CORRECTION'));
ALTER TABLE "TbilisiMovesResultRevision" DROP CONSTRAINT IF EXISTS "TbilisiMovesResultRevision_revision_check";
ALTER TABLE "TbilisiMovesResultRevision"
  ADD CONSTRAINT "TbilisiMovesResultRevision_revision_check" CHECK ("revision" >= 1);

DO $$
BEGIN
  ALTER TABLE "TbilisiMovesResultRevision"
    ADD CONSTRAINT "TbilisiMovesResultRevision_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "TbilisiMovesRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TbilisiMovesAward" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "districtId" TEXT NOT NULL,
  "awardKey" TEXT NOT NULL,
  "rank" INTEGER,
  "resultRevision" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "titleKa" TEXT NOT NULL,
  "reasonKa" TEXT NOT NULL,
  "publicHandleSnapshot" TEXT NOT NULL,
  "publicAvatarIdSnapshot" TEXT,
  "entitledAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TbilisiMovesAward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TbilisiMovesAward_userId_date_awardKey_districtId_key"
  ON "TbilisiMovesAward"("userId", "date", "awardKey", "districtId");
CREATE INDEX IF NOT EXISTS "TbilisiMovesAward_userId_date_idx"
  ON "TbilisiMovesAward"("userId", "date");
CREATE INDEX IF NOT EXISTS "TbilisiMovesAward_date_awardKey_status_idx"
  ON "TbilisiMovesAward"("date", "awardKey", "status");
CREATE INDEX IF NOT EXISTS "TbilisiMovesAward_roundId_status_idx"
  ON "TbilisiMovesAward"("roundId", "status");

ALTER TABLE "TbilisiMovesAward" DROP CONSTRAINT IF EXISTS "TbilisiMovesAward_status_check";
ALTER TABLE "TbilisiMovesAward"
  ADD CONSTRAINT "TbilisiMovesAward_status_check" CHECK ("status" IN ('ACTIVE', 'REVOKED'));
ALTER TABLE "TbilisiMovesAward" DROP CONSTRAINT IF EXISTS "TbilisiMovesAward_key_check";
ALTER TABLE "TbilisiMovesAward"
  ADD CONSTRAINT "TbilisiMovesAward_key_check" CHECK ("awardKey" IN ('DISTRICT_LEADER', 'DISTRICT_GOAL'));

DO $$
BEGIN
  ALTER TABLE "TbilisiMovesAward"
    ADD CONSTRAINT "TbilisiMovesAward_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TbilisiMovesAward"
    ADD CONSTRAINT "TbilisiMovesAward_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "TbilisiMovesRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TbilisiMovesAward"
    ADD CONSTRAINT "TbilisiMovesAward_districtId_fkey"
    FOREIGN KEY ("districtId") REFERENCES "TbilisiMovesDistrict"("id") ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
