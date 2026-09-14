-- My Pets Phase 6 — Medi Vet chat sessions and messages. Additive.
-- Apply AFTER pets-phase2.sql, pets-phase3.sql, pets-phase4.sql (phase5 is optional and independent):
--   npx prisma db execute --file prisma/pets-phase2.sql --schema prisma/schema.prisma
--   npx prisma db execute --file prisma/pets-phase3.sql --schema prisma/schema.prisma
--   npx prisma db execute --file prisma/pets-phase4.sql --schema prisma/schema.prisma
--   npx prisma db execute --file prisma/pets-phase5.sql --schema prisma/schema.prisma
--   npx prisma db execute --file prisma/pets-phase6.sql --schema prisma/schema.prisma
-- Do NOT use prisma db push. Do NOT run against hosted Neon unless an operator explicitly asks.
--
-- Missing these tables must not break identity / health / care / reminder routes.
-- Roles are server-controlled. Do not store owner human health or API keys.

CREATE TABLE IF NOT EXISTS "PetChatSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'ახალი საუბარი',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PetChatSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PetChatSession_userId_petId_updatedAt_idx"
  ON "PetChatSession"("userId", "petId", "updatedAt");
CREATE INDEX IF NOT EXISTS "PetChatSession_petId_updatedAt_idx"
  ON "PetChatSession"("petId", "updatedAt");

CREATE TABLE IF NOT EXISTS "PetChatMessage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'COMPLETE',
  "clientRequestId" TEXT,
  "citations" JSONB,
  "draft" JSONB,
  "grounding" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PetChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PetChatMessage_sessionId_clientRequestId_key"
  ON "PetChatMessage"("sessionId", "clientRequestId");
CREATE INDEX IF NOT EXISTS "PetChatMessage_sessionId_createdAt_idx"
  ON "PetChatMessage"("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "PetChatMessage_petId_createdAt_idx"
  ON "PetChatMessage"("petId", "createdAt");
CREATE INDEX IF NOT EXISTS "PetChatMessage_userId_petId_status_idx"
  ON "PetChatMessage"("userId", "petId", "status");

DO $$ BEGIN
  ALTER TABLE "PetChatSession"
    ADD CONSTRAINT "PetChatSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetChatSession"
    ADD CONSTRAINT "PetChatSession_petId_fkey"
    FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetChatMessage"
    ADD CONSTRAINT "PetChatMessage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetChatMessage"
    ADD CONSTRAINT "PetChatMessage_petId_fkey"
    FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PetChatMessage"
    ADD CONSTRAINT "PetChatMessage_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "PetChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
