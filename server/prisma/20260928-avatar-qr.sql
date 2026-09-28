-- Photo avatars and personal QR codes (2026-09-28). Additive only. See docs/TRAINER.md.

-- A person's own photo avatar (private storage key; served by /api/avatars/:userId with a viewer check).
-- Preset avatars stay in HealthProfile.extraAnswers.avatarId; the women's space never uses this photo.
CREATE TABLE IF NOT EXISTS "UserAvatar" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
  "fileKey" TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Personal QR: a random, renewable token (never the user id). A verified trainer scans it in the app.
CREATE TABLE IF NOT EXISTS "UserQr" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotatedAt" TIMESTAMPTZ(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserQr_token" ON "UserQr"(token);

-- Who started a link: CLIENT (code or search) or TRAINER (scanned the client's QR; the client must accept).
ALTER TABLE "TrainerLink" ADD COLUMN IF NOT EXISTS initiator TEXT NOT NULL DEFAULT 'CLIENT'
