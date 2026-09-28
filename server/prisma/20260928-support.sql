-- Support inbox (2026-09-28). Additive only: three new tables, nothing existing is changed.
-- Installed by scripts/install-support.mjs in the db:install chain. See src/lib/support/.
--
-- Mail to any @medicard.ge address reaches Resend Inbound; the `email.received` webhook
-- (POST /api/email/webhook) stores it here and admin #/support reads and answers it.
--
-- Privacy: unlike EmailLog (hash + masked address only), support rows keep the full sender
-- address and the message bodies, because answering a person requires both. They are visible
-- only to admins with SUPPORT_VIEW / SUPPORT_MANAGE. HTML bodies are stored already sanitized
-- (no scripts, styles, event handlers, forms or remote images). Attachments are never stored:
-- only their metadata; files are proxied from Resend on demand. The inbox never shows health
-- data — a linked account shows name, status and sign-up date plus a link to #/users/:id.
-- Retention: closed threads whose last message is older than 2 years are deleted daily
-- (JobLease "support-retention", src/lib/support/inbound.js); their messages cascade.
-- Deleting a User account clears SupportThread.userId (the correspondence itself is mail the
-- person sent to us and follows the 2-year rule).

CREATE TABLE IF NOT EXISTS "SupportThread" (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL DEFAULT '',
  -- lowercased subject without Re:/Fwd:/AW:… prefixes — thread matching key
  "subjectKey" TEXT NOT NULL DEFAULT '',
  -- the outside party (lowercased) and display name
  "counterpartEmail" TEXT NOT NULL,
  "counterpartName" TEXT,
  -- our address that received the first message (support@medicard.ge, hello@…)
  mailbox TEXT,
  -- new | open | waiting | closed
  status TEXT NOT NULL DEFAULT 'new',
  "assignedAdminId" TEXT,
  "userId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  unread BOOLEAN NOT NULL DEFAULT true,
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastInboundAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  -- owner notice (SUPPORT_NOTIFY_EMAIL) already covered this thread
  "notifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SupportThread_status_time_idx" ON "SupportThread"(status, "lastMessageAt");
CREATE INDEX IF NOT EXISTS "SupportThread_counterpart_idx" ON "SupportThread"("counterpartEmail", "subjectKey");
CREATE INDEX IF NOT EXISTS "SupportThread_lastMessageAt_idx" ON "SupportThread"("lastMessageAt");
CREATE INDEX IF NOT EXISTS "SupportThread_userId_idx" ON "SupportThread"("userId");
CREATE INDEX IF NOT EXISTS "SupportThread_assigned_idx" ON "SupportThread"("assignedAdminId");

-- inbound (from outside), outbound (admin reply, emailed), note (internal, never emailed)
CREATE TABLE IF NOT EXISTS "SupportMessage" (
  id TEXT PRIMARY KEY,
  "threadId" TEXT NOT NULL REFERENCES "SupportThread"(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  -- Resend received-email id: idempotency key for the webhook (inbound only)
  "resendId" TEXT,
  -- RFC 5322 Message-ID / In-Reply-To / References (threading and reply headers)
  "messageId" TEXT,
  "inReplyTo" TEXT,
  "references" TEXT,
  "fromEmail" TEXT,
  "fromName" TEXT,
  "toEmails" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "ccEmails" JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT NOT NULL DEFAULT '',
  "textBody" TEXT,
  -- sanitized HTML (src/lib/support/sanitize.js); rendered only in a sandboxed iframe
  "htmlBody" TEXT,
  -- ok | pending | failed | restricted (key cannot read inbound) | none (outbound/note)
  "bodyStatus" TEXT NOT NULL DEFAULT 'none',
  "bodyAttempts" INTEGER NOT NULL DEFAULT 0,
  "bodyNextAt" TIMESTAMP(3),
  "bodyError" TEXT,
  -- [{ id, filename, contentType, size, disposition }] — metadata only
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Auto-Submitted / Precedence / sender on our own domain: never triggers a notice
  "isAuto" BOOLEAN NOT NULL DEFAULT false,
  "authorAdminId" TEXT,
  -- outbound: Resend email id and send status (sent | failed | skipped)
  "providerId" TEXT,
  "sendStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "SupportMessage_resendId_key" ON "SupportMessage"("resendId");
CREATE INDEX IF NOT EXISTS "SupportMessage_thread_time_idx" ON "SupportMessage"("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportMessage_messageId_idx" ON "SupportMessage"("messageId");
CREATE INDEX IF NOT EXISTS "SupportMessage_body_idx" ON "SupportMessage"("bodyStatus", "bodyNextAt");

-- Canned replies for the composer.
CREATE TABLE IF NOT EXISTS "SupportSnippet" (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
