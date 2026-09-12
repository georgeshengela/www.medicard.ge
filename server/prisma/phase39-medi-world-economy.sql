-- Medi World Phase 39 economy — additive only.
-- Canonical apply:
--   npx prisma db execute --file prisma/phase39-medi-world-economy.sql --schema prisma/schema.prisma
-- Do not run against production from this working tree.
-- Do NOT use prisma db push.
-- Requires Phase 38 MediWorldProfile / MediWorldLedger to already exist.
-- Safe to re-run (IF NOT EXISTS). Do not also migrate deploy the same change on the same DB.

ALTER TABLE "MediWorldLedger" ADD COLUMN IF NOT EXISTS "reasonCode" TEXT;
ALTER TABLE "MediWorldLedger" ADD COLUMN IF NOT EXISTS "periodKey" TEXT;
ALTER TABLE "MediWorldLedger" ADD COLUMN IF NOT EXISTS "logicalEventId" TEXT;
ALTER TABLE "MediWorldLedger" ADD COLUMN IF NOT EXISTS "intentFingerprint" TEXT;

CREATE INDEX IF NOT EXISTS "MediWorldLedger_userId_periodKey_idx"
  ON "MediWorldLedger"("userId", "periodKey");
CREATE INDEX IF NOT EXISTS "MediWorldLedger_userId_logicalEventId_idx"
  ON "MediWorldLedger"("userId", "logicalEventId");
