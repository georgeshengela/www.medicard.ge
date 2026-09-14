-- My Pets Phase 4 — products, care schedules, occurrences, administration events. Additive.
-- Apply AFTER pets-phase2.sql and pets-phase3.sql:
--   npx prisma db execute --file prisma/pets-phase2.sql --schema prisma/schema.prisma
--   npx prisma db execute --file prisma/pets-phase3.sql --schema prisma/schema.prisma
--   npx prisma db execute --file prisma/pets-phase4.sql --schema prisma/schema.prisma
-- Do NOT use prisma db push. Do NOT run against hosted Neon unless an operator explicitly asks.

CREATE TABLE IF NOT EXISTS "PetProduct" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "formulation" TEXT,
  "batchId" TEXT,
  "notes" TEXT,
  "expiresOn" TEXT,
  "archivedAt" TIMESTAMP(3),
  "clientRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PetProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PetProduct_petId_clientRequestId_key"
  ON "PetProduct"("petId", "clientRequestId");
CREATE INDEX IF NOT EXISTS "PetProduct_userId_petId_archivedAt_idx"
  ON "PetProduct"("userId", "petId", "archivedAt");

CREATE TABLE IF NOT EXISTS "PetCareSchedule" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "productId" TEXT,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "dose" TEXT,
  "doseUnit" TEXT,
  "route" TEXT,
  "startOn" TEXT NOT NULL,
  "dueTime" TEXT,
  "times" JSONB,
  "recurrenceKind" TEXT NOT NULL,
  "intervalCount" INTEGER,
  "recurrenceBasis" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceNote" TEXT,
  "courseEndsOn" TEXT,
  "occurrenceLimit" INTEGER,
  "anchorDay" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "nextDueOn" TEXT,
  "nextDueTime" TEXT,
  "nextSequence" INTEGER,
  "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
  "reminderOffsetsDays" JSONB NOT NULL DEFAULT '[0]',
  "timeMode" TEXT NOT NULL DEFAULT 'DATE_BASED',
  "timezone" TEXT,
  "clientRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PetCareSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PetCareSchedule_petId_clientRequestId_key"
  ON "PetCareSchedule"("petId", "clientRequestId");
CREATE INDEX IF NOT EXISTS "PetCareSchedule_userId_petId_status_idx"
  ON "PetCareSchedule"("userId", "petId", "status");
CREATE INDEX IF NOT EXISTS "PetCareSchedule_petId_nextDueOn_idx"
  ON "PetCareSchedule"("petId", "nextDueOn");

CREATE TABLE IF NOT EXISTS "PetCareEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "productId" TEXT,
  "scheduleId" TEXT,
  "titleSnapshot" TEXT NOT NULL,
  "productNameSnapshot" TEXT,
  "doseSnapshot" TEXT,
  "doseUnitSnapshot" TEXT,
  "routeSnapshot" TEXT,
  "administeredOn" TEXT NOT NULL,
  "administeredTime" TEXT,
  "timezone" TEXT,
  "utcOffsetMinutes" INTEGER,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RECORDED',
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "correctionMeta" JSONB,
  "previousNextDueOn" TEXT,
  "source" TEXT NOT NULL DEFAULT 'app',
  "idempotencyHash" TEXT,
  "clientRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PetCareEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PetCareEvent_petId_clientRequestId_key"
  ON "PetCareEvent"("petId", "clientRequestId");
CREATE INDEX IF NOT EXISTS "PetCareEvent_userId_petId_administeredOn_idx"
  ON "PetCareEvent"("userId", "petId", "administeredOn");
CREATE INDEX IF NOT EXISTS "PetCareEvent_scheduleId_idx"
  ON "PetCareEvent"("scheduleId");

CREATE TABLE IF NOT EXISTS "PetCareOccurrence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "plannedOn" TEXT NOT NULL,
  "plannedTime" TEXT,
  "sequence" INTEGER NOT NULL,
  "occurrenceKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "eventId" TEXT,
  "skipNote" TEXT,
  "skippedAt" TIMESTAMP(3),
  "clientRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PetCareOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PetCareOccurrence_scheduleId_occurrenceKey_key"
  ON "PetCareOccurrence"("scheduleId", "occurrenceKey");
CREATE UNIQUE INDEX IF NOT EXISTS "PetCareOccurrence_eventId_key"
  ON "PetCareOccurrence"("eventId");
CREATE UNIQUE INDEX IF NOT EXISTS "PetCareOccurrence_petId_clientRequestId_key"
  ON "PetCareOccurrence"("petId", "clientRequestId");
CREATE INDEX IF NOT EXISTS "PetCareOccurrence_petId_plannedOn_idx"
  ON "PetCareOccurrence"("petId", "plannedOn");
CREATE INDEX IF NOT EXISTS "PetCareOccurrence_scheduleId_status_idx"
  ON "PetCareOccurrence"("scheduleId", "status");

DO $$ BEGIN
  ALTER TABLE "PetProduct"
    ADD CONSTRAINT "PetProduct_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetProduct"
    ADD CONSTRAINT "PetProduct_petId_fkey"
    FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetCareSchedule"
    ADD CONSTRAINT "PetCareSchedule_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetCareSchedule"
    ADD CONSTRAINT "PetCareSchedule_petId_fkey"
    FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetCareSchedule"
    ADD CONSTRAINT "PetCareSchedule_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "PetProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetCareEvent"
    ADD CONSTRAINT "PetCareEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetCareEvent"
    ADD CONSTRAINT "PetCareEvent_petId_fkey"
    FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetCareEvent"
    ADD CONSTRAINT "PetCareEvent_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "PetProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetCareEvent"
    ADD CONSTRAINT "PetCareEvent_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "PetCareSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetCareOccurrence"
    ADD CONSTRAINT "PetCareOccurrence_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetCareOccurrence"
    ADD CONSTRAINT "PetCareOccurrence_petId_fkey"
    FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetCareOccurrence"
    ADD CONSTRAINT "PetCareOccurrence_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "PetCareSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetCareOccurrence"
    ADD CONSTRAINT "PetCareOccurrence_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "PetCareEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
