-- Sign in with Apple / Google (2026-10-01). Additive only: one new table, no change to existing rows.
-- One row per (provider, subject): subject is Apple's / Google's stable user id ("sub"), never the email.
-- "appleRefreshToken" is AES-256-GCM encrypted (src/lib/socialAuth.js) and exists only so account
-- deletion can revoke the Apple grant (App Review 5.1.1(v)). Rows cascade with the user.

CREATE TABLE IF NOT EXISTS "AuthIdentity" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  email TEXT,
  "appleRefreshToken" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lastUsedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "AuthIdentity_provider_subject" ON "AuthIdentity"(provider, subject);
CREATE INDEX IF NOT EXISTS "AuthIdentity_user" ON "AuthIdentity"("userId");
