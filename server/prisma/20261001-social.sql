-- Social-media campaign log (2026-10-01). Additive only: two new tables, no change to existing rows.
-- The operator records what it scheduled in Metricool with `node server/scripts/social-log.mjs`
-- (src/lib/socialPosts.js); admin #/social reads it. Marketing copy and public image URLs only —
-- never user data or health data.

CREATE TABLE IF NOT EXISTS "SocialPost" (
  id TEXT PRIMARY KEY,
  campaign TEXT NOT NULL,
  slot TEXT NOT NULL UNIQUE,
  networks TEXT[] NOT NULL DEFAULT '{}',
  kind TEXT NOT NULL,
  pillar TEXT,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  "textEn" TEXT,
  "mediaUrls" TEXT[] NOT NULL DEFAULT '{}',
  "scheduledAt" TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  "metricoolId" TEXT,
  "externalUrl" TEXT,
  "publishedAt" TIMESTAMPTZ,
  "lastSyncedAt" TIMESTAMPTZ,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "SocialPost_scheduledAt" ON "SocialPost"("scheduledAt");
CREATE INDEX IF NOT EXISTS "SocialPost_status" ON "SocialPost"(status);

CREATE TABLE IF NOT EXISTS "SocialPostEvent" (
  id TEXT PRIMARY KEY,
  "postId" TEXT NOT NULL REFERENCES "SocialPost"(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS "SocialPostEvent_post_at" ON "SocialPostEvent"("postId", at);
CREATE INDEX IF NOT EXISTS "SocialPostEvent_at" ON "SocialPostEvent"(at);
