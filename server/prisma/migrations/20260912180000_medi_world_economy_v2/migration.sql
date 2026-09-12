-- Medi World Phase 39 economy. Additive. Keep in lockstep with prisma/phase39-medi-world-economy.sql.
-- Canonical apply for this repository is prisma db execute of that file.
-- Use this folder only with prisma migrate deploy on migrate-tracked databases.
-- Do not run both against the same database.

ALTER TABLE "MediWorldLedger" ADD COLUMN IF NOT EXISTS "reasonCode" TEXT;
ALTER TABLE "MediWorldLedger" ADD COLUMN IF NOT EXISTS "periodKey" TEXT;
ALTER TABLE "MediWorldLedger" ADD COLUMN IF NOT EXISTS "logicalEventId" TEXT;
ALTER TABLE "MediWorldLedger" ADD COLUMN IF NOT EXISTS "intentFingerprint" TEXT;

CREATE INDEX IF NOT EXISTS "MediWorldLedger_userId_periodKey_idx"
  ON "MediWorldLedger"("userId", "periodKey");
CREATE INDEX IF NOT EXISTS "MediWorldLedger_userId_logicalEventId_idx"
  ON "MediWorldLedger"("userId", "logicalEventId");
