-- Durable execution receipts. No dictated text, health context or audio is stored here.
CREATE TABLE IF NOT EXISTS "AssistantOperation" (
  "id" UUID PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tool" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('RUNNING', 'DONE', 'REJECTED', 'UNCERTAIN')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "AssistantOperation_userId_createdAt_idx"
  ON "AssistantOperation" ("userId", "createdAt");
