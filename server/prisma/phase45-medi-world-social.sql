-- Medi World Phase 45 Friends / Trusted Circles / Social Privacy — additive only.
-- Canonical apply (databases without `_prisma_migrations`):
--   npx prisma db execute --file prisma/phase45-medi-world-social.sql --schema prisma/schema.prisma
-- Migrate-tracked databases:
--   npx prisma migrate deploy
--   (folder: prisma/migrations/20260913030000_medi_world_social/)
-- Ordered after 20260913020000_medi_world_garden (Phase 44).
-- Do not run against production from this working tree.
-- Do NOT use prisma db push.
-- No automatic opt-in, legal-name copy, friend suggestions, or Garden sharing.

CREATE TABLE IF NOT EXISTS "SocialProfile" (
  "userId" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL DEFAULT '',
  "bio" TEXT NOT NULL DEFAULT '',
  "friendCode" TEXT NOT NULL,
  "friendCodeNormalized" TEXT NOT NULL,
  "socialEnabled" BOOLEAN NOT NULL DEFAULT false,
  "adultConfirmedAt" TIMESTAMP(3),
  "eligibilityPolicyVersion" TEXT,
  "participationDisabledAt" TIMESTAMP(3),
  "privacyVersion" INTEGER NOT NULL DEFAULT 1,
  "profileVisibility" TEXT NOT NULL DEFAULT 'friends_only',
  "showWorldLevel" BOOLEAN NOT NULL DEFAULT false,
  "showBondLevel" BOOLEAN NOT NULL DEFAULT false,
  "showGardenPreview" BOOLEAN NOT NULL DEFAULT false,
  "wavesMuted" BOOLEAN NOT NULL DEFAULT false,
  "mediPresentationKey" TEXT NOT NULL DEFAULT 'present.spark',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialProfile_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialProfile_publicId_key" ON "SocialProfile"("publicId");
CREATE UNIQUE INDEX IF NOT EXISTS "SocialProfile_friendCodeNormalized_key" ON "SocialProfile"("friendCodeNormalized");

CREATE TABLE IF NOT EXISTS "SocialFriendship" (
  "id" TEXT NOT NULL,
  "pairKey" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "addresseeId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialFriendship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialFriendship_pairKey_key" ON "SocialFriendship"("pairKey");
CREATE INDEX IF NOT EXISTS "SocialFriendship_requesterId_idx" ON "SocialFriendship"("requesterId");
CREATE INDEX IF NOT EXISTS "SocialFriendship_addresseeId_idx" ON "SocialFriendship"("addresseeId");
CREATE INDEX IF NOT EXISTS "SocialFriendship_state_idx" ON "SocialFriendship"("state");

CREATE TABLE IF NOT EXISTS "SocialBlock" (
  "id" TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialBlock_blockerId_blockedUserId_key" ON "SocialBlock"("blockerId", "blockedUserId");
CREATE INDEX IF NOT EXISTS "SocialBlock_blockedUserId_idx" ON "SocialBlock"("blockedUserId");

CREATE TABLE IF NOT EXISTS "SocialCareWave" (
  "id" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "waveType" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialCareWave_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialCareWave_senderId_recipientId_waveType_periodKey_key"
  ON "SocialCareWave"("senderId", "recipientId", "waveType", "periodKey");
CREATE UNIQUE INDEX IF NOT EXISTS "SocialCareWave_senderId_idempotencyKey_key" ON "SocialCareWave"("senderId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "SocialCareWave_recipientId_periodKey_idx" ON "SocialCareWave"("recipientId", "periodKey");
CREATE INDEX IF NOT EXISTS "SocialCareWave_senderId_periodKey_idx" ON "SocialCareWave"("senderId", "periodKey");

CREATE TABLE IF NOT EXISTS "SocialCircle" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialCircle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialCircle_publicId_key" ON "SocialCircle"("publicId");
CREATE UNIQUE INDEX IF NOT EXISTS "SocialCircle_ownerUserId_key" ON "SocialCircle"("ownerUserId");

CREATE TABLE IF NOT EXISTS "SocialCircleMember" (
  "id" TEXT NOT NULL,
  "circleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialCircleMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialCircleMember_circleId_userId_key" ON "SocialCircleMember"("circleId", "userId");
CREATE INDEX IF NOT EXISTS "SocialCircleMember_userId_idx" ON "SocialCircleMember"("userId");

CREATE TABLE IF NOT EXISTS "SocialCircleInvite" (
  "id" TEXT NOT NULL,
  "circleId" TEXT NOT NULL,
  "codeNormalized" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "usedByUserId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialCircleInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialCircleInvite_codeNormalized_key" ON "SocialCircleInvite"("codeNormalized");
CREATE INDEX IF NOT EXISTS "SocialCircleInvite_circleId_idx" ON "SocialCircleInvite"("circleId");

CREATE TABLE IF NOT EXISTS "SocialInboxItem" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialInboxItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialInboxItem_recipientId_dedupeKey_key" ON "SocialInboxItem"("recipientId", "dedupeKey");
CREATE INDEX IF NOT EXISTS "SocialInboxItem_recipientId_createdAt_idx" ON "SocialInboxItem"("recipientId", "createdAt");

CREATE TABLE IF NOT EXISTS "SocialReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "targetPublicId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SocialReport_reporterId_createdAt_idx" ON "SocialReport"("reporterId", "createdAt");
CREATE INDEX IF NOT EXISTS "SocialReport_targetPublicId_idx" ON "SocialReport"("targetPublicId");

CREATE TABLE IF NOT EXISTS "SocialMutation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "resultJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialMutation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialMutation_userId_idempotencyKey_key" ON "SocialMutation"("userId", "idempotencyKey");

DO $$ BEGIN
  ALTER TABLE "SocialProfile"
    ADD CONSTRAINT "SocialProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SocialFriendship"
    ADD CONSTRAINT "SocialFriendship_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SocialFriendship"
    ADD CONSTRAINT "SocialFriendship_addresseeId_fkey"
    FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SocialBlock"
    ADD CONSTRAINT "SocialBlock_blockerId_fkey"
    FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SocialBlock"
    ADD CONSTRAINT "SocialBlock_blockedUserId_fkey"
    FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SocialCareWave"
    ADD CONSTRAINT "SocialCareWave_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SocialCareWave"
    ADD CONSTRAINT "SocialCareWave_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SocialCircle"
    ADD CONSTRAINT "SocialCircle_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SocialCircleMember"
    ADD CONSTRAINT "SocialCircleMember_circleId_fkey"
    FOREIGN KEY ("circleId") REFERENCES "SocialCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SocialCircleMember"
    ADD CONSTRAINT "SocialCircleMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SocialCircleInvite"
    ADD CONSTRAINT "SocialCircleInvite_circleId_fkey"
    FOREIGN KEY ("circleId") REFERENCES "SocialCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SocialInboxItem"
    ADD CONSTRAINT "SocialInboxItem_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SocialReport"
    ADD CONSTRAINT "SocialReport_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SocialMutation"
    ADD CONSTRAINT "SocialMutation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
