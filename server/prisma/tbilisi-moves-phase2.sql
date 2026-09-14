-- თბილისი მოძრაობს Phase 2 — foundation. Additive.
-- Apply locally / operator: npx prisma db execute --file prisma/tbilisi-moves-phase2.sql --schema prisma/schema.prisma
-- Do NOT use prisma db push. Do NOT run against hosted Neon unless an operator explicitly asks.
-- Seeds use ON CONFLICT DO NOTHING so operator-edited targets/settings are preserved.

CREATE TABLE IF NOT EXISTS "TbilisiMovesConfig" (
  "id" TEXT NOT NULL,
  "featureEnabled" BOOLEAN NOT NULL DEFAULT false,
  "enrollmentOpen" BOOLEAN NOT NULL DEFAULT false,
  "ingestionPaused" BOOLEAN NOT NULL DEFAULT false,
  "competitionPaused" BOOLEAN NOT NULL DEFAULT false,
  "rewardsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "pilotMode" BOOLEAN NOT NULL DEFAULT true,
  "defaultDailyTarget" INTEGER NOT NULL DEFAULT 100000,
  "competitiveCap" INTEGER NOT NULL DEFAULT 10000,
  "cooldownDays" INTEGER NOT NULL DEFAULT 30,
  "minParticipantsForRank" INTEGER NOT NULL DEFAULT 5,
  "lateSyncGraceHours" INTEGER NOT NULL DEFAULT 8,
  "sanityMaxRawSteps" INTEGER NOT NULL DEFAULT 80000,
  "correctionDropFlagPct" INTEGER NOT NULL DEFAULT 40,
  "geometryAssetVersion" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TbilisiMovesConfig_pkey" PRIMARY KEY ("id")
);

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
    AND "revision" >= 1
  );

CREATE TABLE IF NOT EXISTS "TbilisiMovesDistrict" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "nameKa" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "dailyTargetOverride" INTEGER,
  "geometryVersion" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TbilisiMovesDistrict_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TbilisiMovesDistrict_slug_key" ON "TbilisiMovesDistrict"("slug");
CREATE INDEX IF NOT EXISTS "TbilisiMovesDistrict_status_sortOrder_idx" ON "TbilisiMovesDistrict"("status", "sortOrder");

ALTER TABLE "TbilisiMovesDistrict" DROP CONSTRAINT IF EXISTS "TbilisiMovesDistrict_status_check";
ALTER TABLE "TbilisiMovesDistrict"
  ADD CONSTRAINT "TbilisiMovesDistrict_status_check" CHECK ("status" IN ('ACTIVE', 'ARCHIVED'));
ALTER TABLE "TbilisiMovesDistrict" DROP CONSTRAINT IF EXISTS "TbilisiMovesDistrict_override_check";
ALTER TABLE "TbilisiMovesDistrict"
  ADD CONSTRAINT "TbilisiMovesDistrict_override_check" CHECK (
    "dailyTargetOverride" IS NULL
    OR ("dailyTargetOverride" >= 1000 AND "dailyTargetOverride" <= 50000000)
  );

CREATE TABLE IF NOT EXISTS "TbilisiMovesMembership" (
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "optedInAt" TIMESTAMP(3) NOT NULL,
  "publicBoardConsentAt" TIMESTAMP(3) NOT NULL,
  "districtId" TEXT NOT NULL,
  "publicHandle" TEXT NOT NULL,
  "publicAvatarId" TEXT,
  "enrolledAt" TIMESTAMP(3) NOT NULL,
  "lockUntilDate" TEXT NOT NULL,
  "pendingDistrictId" TEXT,
  "pendingEffectiveDate" TEXT,
  "pendingRequestedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TbilisiMovesMembership_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX IF NOT EXISTS "TbilisiMovesMembership_districtId_status_idx"
  ON "TbilisiMovesMembership"("districtId", "status");
CREATE INDEX IF NOT EXISTS "TbilisiMovesMembership_pendingEffectiveDate_idx"
  ON "TbilisiMovesMembership"("pendingEffectiveDate");

ALTER TABLE "TbilisiMovesMembership" DROP CONSTRAINT IF EXISTS "TbilisiMovesMembership_status_check";
ALTER TABLE "TbilisiMovesMembership"
  ADD CONSTRAINT "TbilisiMovesMembership_status_check" CHECK ("status" IN ('ACTIVE', 'LEFT'));
ALTER TABLE "TbilisiMovesMembership" DROP CONSTRAINT IF EXISTS "TbilisiMovesMembership_pending_check";
ALTER TABLE "TbilisiMovesMembership"
  ADD CONSTRAINT "TbilisiMovesMembership_pending_check" CHECK (
    ("pendingDistrictId" IS NULL AND "pendingEffectiveDate" IS NULL AND "pendingRequestedAt" IS NULL)
    OR ("pendingDistrictId" IS NOT NULL AND "pendingEffectiveDate" IS NOT NULL AND "pendingRequestedAt" IS NOT NULL)
  );
ALTER TABLE "TbilisiMovesMembership" DROP CONSTRAINT IF EXISTS "TbilisiMovesMembership_pending_diff_check";
ALTER TABLE "TbilisiMovesMembership"
  ADD CONSTRAINT "TbilisiMovesMembership_pending_diff_check" CHECK (
    "pendingDistrictId" IS NULL OR "pendingDistrictId" <> "districtId"
  );

CREATE UNIQUE INDEX IF NOT EXISTS "TbilisiMovesMembership_one_pending_idx"
  ON "TbilisiMovesMembership"("userId")
  WHERE "pendingDistrictId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "TbilisiMovesMembershipPeriod" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "districtId" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TbilisiMovesMembershipPeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TbilisiMovesMembershipPeriod_userId_startDate_idx"
  ON "TbilisiMovesMembershipPeriod"("userId", "startDate");
CREATE INDEX IF NOT EXISTS "TbilisiMovesMembershipPeriod_districtId_startDate_idx"
  ON "TbilisiMovesMembershipPeriod"("districtId", "startDate");
CREATE UNIQUE INDEX IF NOT EXISTS "TbilisiMovesMembershipPeriod_open_user_idx"
  ON "TbilisiMovesMembershipPeriod"("userId")
  WHERE "endDate" IS NULL;

ALTER TABLE "TbilisiMovesMembershipPeriod" DROP CONSTRAINT IF EXISTS "TbilisiMovesMembershipPeriod_range_check";
ALTER TABLE "TbilisiMovesMembershipPeriod"
  ADD CONSTRAINT "TbilisiMovesMembershipPeriod_range_check" CHECK (
    "endDate" IS NULL OR "endDate" > "startDate"
  );

CREATE TABLE IF NOT EXISTS "TbilisiMovesRound" (
  "id" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROVISIONAL',
  "rulesSnapshot" JSONB NOT NULL,
  "districtTargetsSnapshot" JSONB NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL,
  "graceEndsAt" TIMESTAMP(3) NOT NULL,
  "lastObservationAt" TIMESTAMP(3),
  "lastAggregatedAt" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TbilisiMovesRound_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TbilisiMovesRound_date_key" ON "TbilisiMovesRound"("date");
ALTER TABLE "TbilisiMovesRound" DROP CONSTRAINT IF EXISTS "TbilisiMovesRound_status_check";
ALTER TABLE "TbilisiMovesRound"
  ADD CONSTRAINT "TbilisiMovesRound_status_check" CHECK ("status" IN ('PROVISIONAL', 'FINALIZED'));

CREATE TABLE IF NOT EXISTS "TbilisiMovesDistrictDay" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "districtId" TEXT NOT NULL,
  "target" INTEGER NOT NULL,
  "eligibleStepsSum" INTEGER NOT NULL DEFAULT 0,
  "contributorCount" INTEGER NOT NULL DEFAULT 0,
  "enrolledCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TbilisiMovesDistrictDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TbilisiMovesDistrictDay_roundId_districtId_key"
  ON "TbilisiMovesDistrictDay"("roundId", "districtId");
CREATE INDEX IF NOT EXISTS "TbilisiMovesDistrictDay_roundId_idx" ON "TbilisiMovesDistrictDay"("roundId");

CREATE TABLE IF NOT EXISTS "TbilisiMovesCredit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "districtId" TEXT NOT NULL,
  "rawObservedSteps" INTEGER NOT NULL,
  "eligibleSteps" INTEGER NOT NULL,
  "capSnapshot" INTEGER NOT NULL,
  "authoritativeProvider" TEXT NOT NULL,
  "sourceInstallationId" TEXT NOT NULL,
  "lastRecordedAt" TIMESTAMP(3) NOT NULL,
  "lastClientSequence" INTEGER NOT NULL DEFAULT 0,
  "lastObservationId" TEXT NOT NULL,
  "publicHandleSnapshot" TEXT NOT NULL,
  "publicAvatarIdSnapshot" TEXT,
  "excludedAt" TIMESTAMP(3),
  "excludedReason" TEXT,
  "flaggedAt" TIMESTAMP(3),
  "flagReason" TEXT,
  "correctionCount" INTEGER NOT NULL DEFAULT 0,
  "acceptedAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TbilisiMovesCredit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TbilisiMovesCredit_userId_date_key"
  ON "TbilisiMovesCredit"("userId", "date");
CREATE INDEX IF NOT EXISTS "TbilisiMovesCredit_date_districtId_eligibleSteps_idx"
  ON "TbilisiMovesCredit"("date", "districtId", "eligibleSteps");
CREATE INDEX IF NOT EXISTS "TbilisiMovesCredit_date_eligibleSteps_idx"
  ON "TbilisiMovesCredit"("date", "eligibleSteps");

ALTER TABLE "TbilisiMovesCredit" DROP CONSTRAINT IF EXISTS "TbilisiMovesCredit_steps_check";
ALTER TABLE "TbilisiMovesCredit"
  ADD CONSTRAINT "TbilisiMovesCredit_steps_check" CHECK (
    "rawObservedSteps" >= 0 AND "eligibleSteps" >= 0 AND "eligibleSteps" <= "rawObservedSteps"
  );

CREATE TABLE IF NOT EXISTS "TbilisiMovesObservation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientObservationId" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "sourceInstallationId" TEXT NOT NULL,
  "intervalStart" TIMESTAMP(3) NOT NULL,
  "intervalEnd" TIMESTAMP(3) NOT NULL,
  "cumulativeSteps" INTEGER NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "clientSequence" INTEGER NOT NULL DEFAULT 0,
  "payloadHash" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "applied" BOOLEAN NOT NULL DEFAULT true,
  "ignoreReason" TEXT,
  CONSTRAINT "TbilisiMovesObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TbilisiMovesObservation_userId_clientObservationId_key"
  ON "TbilisiMovesObservation"("userId", "clientObservationId");
CREATE INDEX IF NOT EXISTS "TbilisiMovesObservation_userId_date_receivedAt_idx"
  ON "TbilisiMovesObservation"("userId", "date", "receivedAt");
CREATE INDEX IF NOT EXISTS "TbilisiMovesObservation_roundId_receivedAt_idx"
  ON "TbilisiMovesObservation"("roundId", "receivedAt");

ALTER TABLE "TbilisiMovesObservation" DROP CONSTRAINT IF EXISTS "TbilisiMovesObservation_interval_check";
ALTER TABLE "TbilisiMovesObservation"
  ADD CONSTRAINT "TbilisiMovesObservation_interval_check" CHECK (
    "intervalEnd" > "intervalStart" AND "cumulativeSteps" >= 0
  );

CREATE TABLE IF NOT EXISTS "TbilisiMovesIngestHold" (
  "id" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TbilisiMovesIngestHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TbilisiMovesIngestHold_startedAt_endedAt_idx"
  ON "TbilisiMovesIngestHold"("startedAt", "endedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "TbilisiMovesIngestHold_one_open_idx"
  ON "TbilisiMovesIngestHold" ((true))
  WHERE "endedAt" IS NULL;

DO $$ BEGIN
  ALTER TABLE "TbilisiMovesMembership"
    ADD CONSTRAINT "TbilisiMovesMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TbilisiMovesMembership"
    ADD CONSTRAINT "TbilisiMovesMembership_districtId_fkey"
    FOREIGN KEY ("districtId") REFERENCES "TbilisiMovesDistrict"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TbilisiMovesMembership"
    ADD CONSTRAINT "TbilisiMovesMembership_pendingDistrictId_fkey"
    FOREIGN KEY ("pendingDistrictId") REFERENCES "TbilisiMovesDistrict"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TbilisiMovesMembershipPeriod"
    ADD CONSTRAINT "TbilisiMovesMembershipPeriod_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TbilisiMovesMembershipPeriod"
    ADD CONSTRAINT "TbilisiMovesMembershipPeriod_districtId_fkey"
    FOREIGN KEY ("districtId") REFERENCES "TbilisiMovesDistrict"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TbilisiMovesDistrictDay"
    ADD CONSTRAINT "TbilisiMovesDistrictDay_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "TbilisiMovesRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TbilisiMovesDistrictDay"
    ADD CONSTRAINT "TbilisiMovesDistrictDay_districtId_fkey"
    FOREIGN KEY ("districtId") REFERENCES "TbilisiMovesDistrict"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TbilisiMovesCredit"
    ADD CONSTRAINT "TbilisiMovesCredit_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TbilisiMovesCredit"
    ADD CONSTRAINT "TbilisiMovesCredit_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "TbilisiMovesRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TbilisiMovesCredit"
    ADD CONSTRAINT "TbilisiMovesCredit_districtId_fkey"
    FOREIGN KEY ("districtId") REFERENCES "TbilisiMovesDistrict"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TbilisiMovesObservation"
    ADD CONSTRAINT "TbilisiMovesObservation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TbilisiMovesObservation"
    ADD CONSTRAINT "TbilisiMovesObservation_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "TbilisiMovesRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "TbilisiMovesConfig" (
  "id", "featureEnabled", "enrollmentOpen", "ingestionPaused", "competitionPaused",
  "rewardsEnabled", "pilotMode", "defaultDailyTarget", "competitiveCap", "cooldownDays",
  "minParticipantsForRank", "lateSyncGraceHours", "sanityMaxRawSteps", "correctionDropFlagPct",
  "revision", "updatedAt"
) VALUES (
  'default', false, false, false, false,
  true, true, 100000, 10000, 30,
  5, 8, 80000, 40,
  1, CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "TbilisiMovesDistrict" ("id", "slug", "nameKa", "sortOrder", "status", "revision", "createdAt", "updatedAt")
VALUES
  ('11111111-1111-4111-a111-111111111001', 'gldani', 'გლდანი', 10, 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11111111-1111-4111-a111-111111111002', 'didube', 'დიდუბე', 20, 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11111111-1111-4111-a111-111111111003', 'vake', 'ვაკე', 30, 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11111111-1111-4111-a111-111111111004', 'isani', 'ისანი', 40, 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11111111-1111-4111-a111-111111111005', 'krtsanisi', 'კრწანისი', 50, 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11111111-1111-4111-a111-111111111006', 'mtatsminda', 'მთაწმინდა', 60, 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11111111-1111-4111-a111-111111111007', 'nadzaladevi', 'ნაძალადევი', 70, 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11111111-1111-4111-a111-111111111008', 'saburtalo', 'საბურთალო', 80, 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11111111-1111-4111-a111-111111111009', 'samgori', 'სამგორი', 90, 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11111111-1111-4111-a111-111111111010', 'chughureti', 'ჩუღურეთი', 100, 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
