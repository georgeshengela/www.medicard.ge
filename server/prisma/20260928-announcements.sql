-- Home news cards („სიახლეები“, 2026-09-28). Additive only; never touches existing tables.
-- Announcement: what the admin publishes. AnnouncementImage: the uploaded picture (bytes live in
-- Postgres so they survive Render deploys without object storage). AnnouncementReceipt: one row per
-- person and card — first view, first tap, dismissal — for reach/CTR and cross-device dismissal.
CREATE TABLE IF NOT EXISTS "Announcement" (
  "id" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "placement" TEXT NOT NULL DEFAULT 'home',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL DEFAULT '',
  "details" TEXT NOT NULL DEFAULT '',
  "badge" TEXT NOT NULL DEFAULT '',
  "tone" TEXT NOT NULL DEFAULT 'teal',
  "imageId" TEXT,
  "imageUrl" TEXT,
  "ctaLabel" TEXT NOT NULL DEFAULT '',
  "ctaKind" TEXT NOT NULL DEFAULT 'none',
  "ctaTarget" TEXT NOT NULL DEFAULT '',
  "audience" JSONB NOT NULL DEFAULT '{}',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "dismissible" BOOLEAN NOT NULL DEFAULT TRUE,
  "startsAt" TIMESTAMPTZ,
  "endsAt" TIMESTAMPTZ,
  "publishedAt" TIMESTAMPTZ,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "Announcement_live_idx" ON "Announcement" ("status", "placement", "priority");
CREATE TABLE IF NOT EXISTS "AnnouncementImage" (
  "id" TEXT PRIMARY KEY,
  "mime" TEXT NOT NULL,
  "bytes" BYTEA NOT NULL,
  "size" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "AnnouncementReceipt" (
  "announcementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "seenAt" TIMESTAMPTZ,
  "clickedAt" TIMESTAMPTZ,
  "dismissedAt" TIMESTAMPTZ,
  PRIMARY KEY ("announcementId", "userId")
);
CREATE INDEX IF NOT EXISTS "AnnouncementReceipt_user_idx" ON "AnnouncementReceipt" ("userId");
