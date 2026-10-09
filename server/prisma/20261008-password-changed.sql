-- Moment of the account's last password reset (auth hardening 2026-10-08): requireAuth refuses
-- JWTs signed before it, so a reset ends sessions left on other devices.
-- Additive only. Read/written with raw SQL (src/lib/sessionRevocation.js); the Prisma field is @ignore.
-- NULL (every existing row) means "never reset since this shipped": tokens are judged as before.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMPTZ;
