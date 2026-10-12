-- Support inbox (2026-10-12): the Message-ID our sent mail really carries.
-- Resend delivers through Amazon SES, which replaces the Message-ID we set (<uuid@medicard.ge>)
-- with <…@eu-west-1.amazonses.com>; answers point at that one, so a reply to a letter from ceo@
-- opened a second thread. Filled from Resend's email.sent / email.delivered webhooks
-- (data.message_id) or GET /emails/{providerId} — src/lib/support/sentIds.js — and matched
-- against inbound In-Reply-To / References inside the same counterpart (inbound.js findThread).
-- Additive only; NULL (every existing row) = not known yet. Installed by
-- scripts/install-support-smtp-id.mjs in the db:install chain.
ALTER TABLE "SupportMessage" ADD COLUMN IF NOT EXISTS "smtpMessageId" TEXT;
CREATE INDEX IF NOT EXISTS "SupportMessage_smtpMessageId_idx" ON "SupportMessage"("smtpMessageId");
