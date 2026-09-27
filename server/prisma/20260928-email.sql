-- Email system (2026-09-28). Additive only: four new tables and two new nullable/defaulted
-- User columns. No existing row is changed except for the column default (false / NULL).
-- Installed by scripts/install-email.mjs in the release chain. See src/lib/email/.
--
-- Privacy: EmailLog never stores a full address (sha256 of the lowercased address + a masked
-- form such as g***@gmail.com) and never stores message bodies or codes. Emails never carry
-- health data. Log rows older than 180 days are purged daily (src/lib/email/campaigns.js).

-- Admin overrides of the code-default templates (src/lib/email/templates.js). NULL field = default.
CREATE TABLE IF NOT EXISTS "EmailTemplate" (
  "key" TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'transactional',
  enabled BOOLEAN NOT NULL DEFAULT true,
  subject TEXT,
  preheader TEXT,
  heading TEXT,
  body TEXT,
  "ctaLabel" TEXT,
  "ctaUrl" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT
);

-- One row per attempted message. userId is cleared (not the row) when the account is deleted.
CREATE TABLE IF NOT EXISTS "EmailLog" (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "toHash" TEXT NOT NULL,
  "toMasked" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'transactional',
  subject TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  "providerId" TEXT,
  error TEXT,
  "campaignId" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- welcome:<userId>, account_deleted:<userId>, campaign:<id>:<userId> — a message is claimed once.
CREATE UNIQUE INDEX IF NOT EXISTS "EmailLog_idempotencyKey_key" ON "EmailLog"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "EmailLog_providerId_idx" ON "EmailLog"("providerId");
CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
CREATE INDEX IF NOT EXISTS "EmailLog_template_time_idx" ON "EmailLog"("templateKey", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailLog_userId_idx" ON "EmailLog"("userId");
CREATE INDEX IF NOT EXISTS "EmailLog_campaignId_idx" ON "EmailLog"("campaignId");

-- Hard bounces and spam complaints (Resend webhook). Nothing is sent to these addresses again.
CREATE TABLE IF NOT EXISTS "EmailSuppression" (
  "toHash" TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Marketing campaigns from admin #/email. Sent only to opted-in, non-suppressed, non-blocked users.
CREATE TABLE IF NOT EXISTS "EmailCampaign" (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  preheader TEXT,
  heading TEXT,
  body TEXT NOT NULL DEFAULT '',
  "ctaLabel" TEXT,
  "ctaUrl" TEXT,
  segment TEXT NOT NULL DEFAULT 'ALL_OPTED_IN',
  status TEXT NOT NULL DEFAULT 'draft',
  "targetCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS "EmailCampaign_status_idx" ON "EmailCampaign"(status, "createdAt");

-- Direct-marketing consent (Law 3144: prior explicit consent). Off by default for everyone.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailMarketingOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailMarketingOptInAt" TIMESTAMP(3);
