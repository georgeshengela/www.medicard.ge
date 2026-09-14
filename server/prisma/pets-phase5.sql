-- My Pets Phase 5 — honest local-reminder delivery log. Additive.
-- Apply AFTER pets-phase2.sql, pets-phase3.sql, and pets-phase4.sql:
--   npx prisma db execute --file prisma/pets-phase2.sql --schema prisma/schema.prisma
--   npx prisma db execute --file prisma/pets-phase3.sql --schema prisma/schema.prisma
--   npx prisma db execute --file prisma/pets-phase4.sql --schema prisma/schema.prisma
--   npx prisma db execute --file prisma/pets-phase5.sql --schema prisma/schema.prisma
-- Do NOT use prisma db push. Do NOT run against hosted Neon unless an operator explicitly asks.
--
-- This table is telemetry only. Missing it must not break care CRUD or local OS scheduling.
-- Allowed status values: SCHEDULED_LOCAL | SCHEDULE_FAILED | CANCELLED | RECEIVED_CALLBACK | USER_RESPONSE | COMPLETION_CONFIRMED
-- Do not store notification title/body, pet names, product names, notes, or JWTs.
-- "SCHEDULED_LOCAL" is not proof the OS displayed a banner.

CREATE TABLE IF NOT EXISTS "PetReminderDelivery" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "occurrenceKey" TEXT NOT NULL,
  "alertKind" TEXT NOT NULL,
  "identity" TEXT NOT NULL,
  "installId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "fireAtMs" BIGINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PetReminderDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PetReminderDelivery_userId_identity_idx"
  ON "PetReminderDelivery"("userId", "identity");
CREATE INDEX IF NOT EXISTS "PetReminderDelivery_petId_createdAt_idx"
  ON "PetReminderDelivery"("petId", "createdAt");
CREATE INDEX IF NOT EXISTS "PetReminderDelivery_userId_status_createdAt_idx"
  ON "PetReminderDelivery"("userId", "status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "PetReminderDelivery"
    ADD CONSTRAINT "PetReminderDelivery_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetReminderDelivery"
    ADD CONSTRAINT "PetReminderDelivery_petId_fkey"
    FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetReminderDelivery"
    ADD CONSTRAINT "PetReminderDelivery_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "PetCareSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
