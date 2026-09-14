-- My Pets Phase 7 — quota reservation + reminder FK backfill + one in-flight Medi Vet turn.
-- Additive. Apply AFTER pets-phase2.sql … pets-phase6.sql (phase5 may already be present).
-- Do NOT use prisma db push. Do NOT run against hosted Neon unless an operator explicitly asks.
--
-- PeriodUsage.reserved is shared with human Medi. Missing the column is auto-healed at runtime
-- via ensureQuotaColumns(); this file is the operator source of truth.

ALTER TABLE "PeriodUsage" ADD COLUMN IF NOT EXISTS "reserved" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PeriodUsage" ADD COLUMN IF NOT EXISTS "reservedAt" TIMESTAMP(3);

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

CREATE UNIQUE INDEX IF NOT EXISTS "PetChatMessage_petId_inflight_key"
  ON "PetChatMessage" ("petId")
  WHERE role = 'assistant' AND status IN ('PENDING', 'PARTIAL');
