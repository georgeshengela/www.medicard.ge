-- My Pets Phase 3 — weight history, allergies, conditions. Additive.
-- Apply AFTER pets-phase2.sql:
--   npx prisma db execute --file prisma/pets-phase2.sql --schema prisma/schema.prisma
--   npx prisma db execute --file prisma/pets-phase3.sql --schema prisma/schema.prisma
-- Do NOT use prisma db push. Do NOT run against hosted Neon unless an operator explicitly asks.

CREATE TABLE IF NOT EXISTS "PetWeightLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "recordedOn" TEXT NOT NULL,
  "weightKg" DECIMAL(10,5) NOT NULL,
  "inputValue" DECIMAL(12,4) NOT NULL,
  "inputUnit" TEXT NOT NULL,
  "note" TEXT,
  "clientRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PetWeightLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PetWeightLog_petId_clientRequestId_key"
  ON "PetWeightLog"("petId", "clientRequestId");
CREATE INDEX IF NOT EXISTS "PetWeightLog_petId_recordedOn_createdAt_idx"
  ON "PetWeightLog"("petId", "recordedOn", "createdAt");
CREATE INDEX IF NOT EXISTS "PetWeightLog_userId_petId_idx"
  ON "PetWeightLog"("userId", "petId");

CREATE TABLE IF NOT EXISTS "PetAllergy" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'unknown',
  "reaction" TEXT,
  "reportedStatus" TEXT NOT NULL,
  "notedOn" TEXT,
  "notes" TEXT,
  "clientRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PetAllergy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PetAllergy_petId_clientRequestId_key"
  ON "PetAllergy"("petId", "clientRequestId");
CREATE INDEX IF NOT EXISTS "PetAllergy_userId_petId_idx"
  ON "PetAllergy"("userId", "petId");

CREATE TABLE IF NOT EXISTS "PetCondition" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reportedBasis" TEXT NOT NULL,
  "onsetOn" TEXT,
  "resolvedOn" TEXT,
  "notes" TEXT,
  "clientRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PetCondition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PetCondition_petId_clientRequestId_key"
  ON "PetCondition"("petId", "clientRequestId");
CREATE INDEX IF NOT EXISTS "PetCondition_petId_status_idx"
  ON "PetCondition"("petId", "status");
CREATE INDEX IF NOT EXISTS "PetCondition_userId_petId_idx"
  ON "PetCondition"("userId", "petId");

DO $$ BEGIN
  ALTER TABLE "PetWeightLog"
    ADD CONSTRAINT "PetWeightLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetWeightLog"
    ADD CONSTRAINT "PetWeightLog_petId_fkey"
    FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetAllergy"
    ADD CONSTRAINT "PetAllergy_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetAllergy"
    ADD CONSTRAINT "PetAllergy_petId_fkey"
    FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetCondition"
    ADD CONSTRAINT "PetCondition_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetCondition"
    ADD CONSTRAINT "PetCondition_petId_fkey"
    FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
