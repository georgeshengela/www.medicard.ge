BEGIN;
CREATE TABLE IF NOT EXISTS "UserAiConsent" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "version" TEXT NOT NULL,
  "decision" TEXT NOT NULL CHECK ("decision" IN ('accepted', 'declined', 'revoked')),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "AiConsentEvent" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "version" TEXT NOT NULL,
  "decision" TEXT NOT NULL CHECK ("decision" IN ('accepted', 'declined', 'revoked')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AiConsentEvent_userId_createdAt_idx" ON "AiConsentEvent"("userId", "createdAt");
COMMIT;
