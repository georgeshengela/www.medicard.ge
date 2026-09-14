-- Medi Hunt: one open session per user.
-- Prepared only. Do not execute against production from this pass.
-- Additive unique partial index. Prisma schema cannot express this constraint.
--
-- Migration-history risk: Hunt tables were previously applied with
-- `prisma db execute` of 20260914030000_medi_hunt. That does not write
-- `_prisma_migrations`. `schemaReady` does not prove history matches this folder.
-- Before a future `prisma migrate deploy`, verify the 20260914030000 SQL
-- matches the hosted tables, then:
--   npx prisma migrate resolve --applied 20260914030000_medi_hunt
-- then deploy this file. Do not run those commands in this pass.

CREATE UNIQUE INDEX IF NOT EXISTS "HuntSession_userId_open_uidx"
ON "HuntSession" ("userId")
WHERE status IN ('preparing', 'active', 'paused', 'encounter');
