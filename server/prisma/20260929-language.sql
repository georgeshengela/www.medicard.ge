-- App language per account (ka / en), for server-sent pushes, emails and background AI text.
-- Additive only. Read/written with raw SQL (src/lib/i18n.js); the Prisma field is @ignore.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT;
