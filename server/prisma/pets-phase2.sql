-- My Pets Phase 2 — identity only. Additive.
-- Apply locally: npx prisma db execute --file prisma/pets-phase2.sql --schema prisma/schema.prisma
-- Do NOT use prisma db push. Do NOT run against hosted Neon unless an operator explicitly asks.

CREATE TABLE IF NOT EXISTS "Pet" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "speciesId" TEXT NOT NULL,
  "breedId" TEXT NOT NULL,
  "customBreed" TEXT,
  "sex" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "neutered" BOOLEAN,
  "ageKind" TEXT NOT NULL,
  "birthDate" DATE,
  "approxAgeYears" INTEGER,
  "approxAgeMonths" INTEGER,
  "approxAgeRecordedOn" TEXT,
  "photoUrl" TEXT,
  "vetClinicName" TEXT,
  "vetName" TEXT,
  "vetPhone" TEXT,
  "vetAddress" TEXT,
  "vetNotes" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Pet_userId_archivedAt_idx" ON "Pet"("userId", "archivedAt");
CREATE INDEX IF NOT EXISTS "Pet_userId_createdAt_idx" ON "Pet"("userId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "Pet"
    ADD CONSTRAINT "Pet_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
