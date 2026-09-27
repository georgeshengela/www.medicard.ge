-- Referral with Medi coins (Phase 3.4, 2026-09-27). Additive only: two new tables, no change to existing rows.

-- One personal invite code per person.
CREATE TABLE IF NOT EXISTS "ReferralCode" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCode_code" ON "ReferralCode"(code);

-- A new account can be attributed to one inviter, once. Coins are paid only after the invitee's
-- first health action, both sides verified by phone. No monetary value.
CREATE TABLE IF NOT EXISTS "Referral" (
  id TEXT PRIMARY KEY,
  "inviterId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "inviteeId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  "deviceHash" TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REWARDED', 'EXPIRED', 'REJECTED')),
  reason TEXT,
  "inviterRewarded" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rewardedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "Referral_invitee" ON "Referral"("inviteeId");
CREATE UNIQUE INDEX IF NOT EXISTS "Referral_device" ON "Referral"("deviceHash");
CREATE INDEX IF NOT EXISTS "Referral_inviter_time" ON "Referral"("inviterId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Referral_status_time" ON "Referral"(status, "createdAt");

-- 2026-09-27 audit: installId is client-supplied, so claims also record a hash of the server-observed
-- request IP. One claim per inviter per network per 30 days. Additive nullable column.
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "networkHash" TEXT;
CREATE INDEX IF NOT EXISTS "Referral_inviter_network" ON "Referral"("inviterId", "networkHash", "createdAt");
