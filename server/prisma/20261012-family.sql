-- MEDIFAMILY (2026-10-12): a parent's children and everything kept about them. Additive only; installed by
-- server/scripts/install-family.mjs (npm run db:install). Every table hangs off "FamilyMember", which hangs
-- off its owner "User" with ON DELETE CASCADE: deleting the account deletes the children's records too.
-- Access always goes through "FamilyAccess" (OWNER today, CAREGIVER for a second parent later).

CREATE TABLE IF NOT EXISTS "FamilyMember" (
  "id" TEXT PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL DEFAULT 'CHILD',
  "name" TEXT NOT NULL,
  "birthDate" DATE NOT NULL,
  "sex" TEXT NOT NULL,
  "gestationWeeks" SMALLINT,
  "birthWeightG" INTEGER,
  "birthLengthCm" NUMERIC(5,1),
  "bloodGroup" TEXT,
  "color" TEXT,
  "feedingMode" TEXT,
  "notes" TEXT,
  "consentVersion" TEXT NOT NULL,
  "consentAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "FamilyMember_ownerId_idx" ON "FamilyMember" ("ownerId");

CREATE TABLE IF NOT EXISTS "FamilyAccess" (
  "memberId" TEXT NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL DEFAULT 'OWNER',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("memberId", "userId")
);
CREATE INDEX IF NOT EXISTS "FamilyAccess_userId_idx" ON "FamilyAccess" ("userId");

-- Allergies, long-term conditions and regular medicines.
CREATE TABLE IF NOT EXISTS "FamilyHealthItem" (
  "id" TEXT PRIMARY KEY,
  "memberId" TEXT NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "detail" TEXT,
  "severity" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "FamilyHealthItem_memberId_idx" ON "FamilyHealthItem" ("memberId");

-- Vaccine doses: calendar doses ("hexa", 2) and extra vaccines ("x:flu", 3). "nextOn" = next dose reminder.
CREATE TABLE IF NOT EXISTS "FamilyVaccineDose" (
  "id" TEXT PRIMARY KEY,
  "memberId" TEXT NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "dose" SMALLINT NOT NULL,
  "status" TEXT NOT NULL,
  "givenOn" DATE,
  "nextOn" DATE,
  "place" TEXT,
  "lot" TEXT,
  "reaction" TEXT,
  "note" TEXT,
  "createdById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "FamilyVaccineDose_member_code_dose_key" ON "FamilyVaccineDose" ("memberId", "code", "dose");

CREATE TABLE IF NOT EXISTS "FamilyMeasurement" (
  "id" TEXT PRIMARY KEY,
  "memberId" TEXT NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "measuredOn" DATE NOT NULL,
  "weightKg" NUMERIC(6,3),
  "heightCm" NUMERIC(5,1),
  "headCm" NUMERIC(4,1),
  "position" TEXT,
  "note" TEXT,
  "createdById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "FamilyMeasurement_member_on_idx" ON "FamilyMeasurement" ("memberId", "measuredOn");

-- The day log: feeds, temperature, symptoms, medicine given, notes. "data" holds the kind's fields.
CREATE TABLE IF NOT EXISTS "FamilyLog" (
  "id" TEXT PRIMARY KEY,
  "memberId" TEXT NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "at" TIMESTAMPTZ NOT NULL,
  "endAt" TIMESTAMPTZ,
  "data" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "clientRequestId" TEXT,
  "createdById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "FamilyLog_member_at_idx" ON "FamilyLog" ("memberId", "at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "FamilyLog_member_request_key" ON "FamilyLog" ("memberId", "clientRequestId");

-- First foods and allergens introduced (6 months+).
CREATE TABLE IF NOT EXISTS "FamilyFoodIntro" (
  "memberId" TEXT NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "foodKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "firstOn" DATE,
  "note" TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("memberId", "foodKey")
);

-- Development milestones ticked by the parent.
CREATE TABLE IF NOT EXISTS "FamilyMilestone" (
  "memberId" TEXT NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "key" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "markedOn" DATE,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("memberId", "key")
);

-- Medi's conversations about one child (never mixed with the parent's own consultations).
CREATE TABLE IF NOT EXISTS "FamilyChatSession" (
  "id" TEXT PRIMARY KEY,
  "memberId" TEXT NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "FamilyChatSession_member_idx" ON "FamilyChatSession" ("memberId", "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS "FamilyChatMessage" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL REFERENCES "FamilyChatSession"("id") ON DELETE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'COMPLETE',
  "triage" TEXT,
  "clientRequestId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "FamilyChatMessage_session_idx" ON "FamilyChatMessage" ("sessionId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "FamilyChatMessage_request_key" ON "FamilyChatMessage" ("sessionId", "clientRequestId");
