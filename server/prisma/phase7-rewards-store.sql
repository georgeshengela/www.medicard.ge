-- Phase 7 — Medi Rewards Store (additive only; never drops or mutates existing tables)

CREATE TABLE IF NOT EXISTS "RewardPartner" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "logoAssetKey" TEXT,
  "website" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardPartner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RewardPartner_key_key" ON "RewardPartner"("key");

CREATE TABLE IF NOT EXISTS "RewardDefinition" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "titleKey" TEXT NOT NULL,
  "descriptionKey" TEXT NOT NULL,
  "termsKey" TEXT,
  "imageKey" TEXT,
  "coinCost" INTEGER NOT NULL,
  "partnerId" TEXT,
  "inventoryMode" TEXT NOT NULL DEFAULT 'UNLIMITED',
  "inventoryQuantity" INTEGER,
  "perUserLimit" INTEGER,
  "periodLimitType" TEXT,
  "periodLimitCount" INTEGER,
  "periodWindowDays" INTEGER,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "redemptionExpiryDays" INTEGER,
  "entitlementKey" TEXT,
  "entitlementDurationDays" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RewardDefinition_key_key" ON "RewardDefinition"("key");
CREATE INDEX IF NOT EXISTS "RewardDefinition_status_sortOrder_idx" ON "RewardDefinition"("status", "sortOrder");
CREATE INDEX IF NOT EXISTS "RewardDefinition_type_status_idx" ON "RewardDefinition"("type", "status");
CREATE INDEX IF NOT EXISTS "RewardDefinition_featured_status_idx" ON "RewardDefinition"("featured", "status");

DO $$ BEGIN
  ALTER TABLE "RewardDefinition"
    ADD CONSTRAINT "RewardDefinition_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "RewardPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "RewardCode" (
  "id" TEXT NOT NULL,
  "rewardId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "reservedByRedemptionId" TEXT,
  "reservedAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RewardCode_rewardId_code_key" ON "RewardCode"("rewardId", "code");
CREATE INDEX IF NOT EXISTS "RewardCode_rewardId_status_idx" ON "RewardCode"("rewardId", "status");

DO $$ BEGIN
  ALTER TABLE "RewardCode"
    ADD CONSTRAINT "RewardCode_rewardId_fkey"
    FOREIGN KEY ("rewardId") REFERENCES "RewardDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "RewardRedemption" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rewardId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "coinCost" INTEGER NOT NULL,
  "ledgerEntryId" TEXT,
  "codeId" TEXT,
  "idempotencyKey" TEXT,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RewardRedemption_codeId_key" ON "RewardRedemption"("codeId");
CREATE UNIQUE INDEX IF NOT EXISTS "RewardRedemption_userId_idempotencyKey_key" ON "RewardRedemption"("userId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "RewardRedemption_userId_redeemedAt_idx" ON "RewardRedemption"("userId", "redeemedAt");
CREATE INDEX IF NOT EXISTS "RewardRedemption_userId_status_idx" ON "RewardRedemption"("userId", "status");
CREATE INDEX IF NOT EXISTS "RewardRedemption_rewardId_status_idx" ON "RewardRedemption"("rewardId", "status");

DO $$ BEGIN
  ALTER TABLE "RewardRedemption"
    ADD CONSTRAINT "RewardRedemption_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RewardRedemption"
    ADD CONSTRAINT "RewardRedemption_rewardId_fkey"
    FOREIGN KEY ("rewardId") REFERENCES "RewardDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RewardRedemption"
    ADD CONSTRAINT "RewardRedemption_codeId_fkey"
    FOREIGN KEY ("codeId") REFERENCES "RewardCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "RewardInventoryAdjustment" (
  "id" TEXT NOT NULL,
  "rewardId" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardInventoryAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RewardInventoryAdjustment_rewardId_createdAt_idx" ON "RewardInventoryAdjustment"("rewardId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "RewardInventoryAdjustment"
    ADD CONSTRAINT "RewardInventoryAdjustment_rewardId_fkey"
    FOREIGN KEY ("rewardId") REFERENCES "RewardDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "UserRewardEntitlement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rewardRedemptionId" TEXT NOT NULL,
  "entitlementKey" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRewardEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserRewardEntitlement_userId_entitlementKey_status_idx"
  ON "UserRewardEntitlement"("userId", "entitlementKey", "status");
CREATE INDEX IF NOT EXISTS "UserRewardEntitlement_userId_endsAt_idx" ON "UserRewardEntitlement"("userId", "endsAt");
CREATE INDEX IF NOT EXISTS "UserRewardEntitlement_rewardRedemptionId_idx" ON "UserRewardEntitlement"("rewardRedemptionId");

DO $$ BEGIN
  ALTER TABLE "UserRewardEntitlement"
    ADD CONSTRAINT "UserRewardEntitlement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UserRewardEntitlement"
    ADD CONSTRAINT "UserRewardEntitlement_rewardRedemptionId_fkey"
    FOREIGN KEY ("rewardRedemptionId") REFERENCES "RewardRedemption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "RewardRedemptionAudit" (
  "id" TEXT NOT NULL,
  "redemptionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rewardId" TEXT NOT NULL,
  "coinCost" INTEGER NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardRedemptionAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RewardRedemptionAudit_redemptionId_createdAt_idx"
  ON "RewardRedemptionAudit"("redemptionId", "createdAt");
CREATE INDEX IF NOT EXISTS "RewardRedemptionAudit_userId_createdAt_idx"
  ON "RewardRedemptionAudit"("userId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "RewardRedemptionAudit"
    ADD CONSTRAINT "RewardRedemptionAudit_redemptionId_fkey"
    FOREIGN KEY ("redemptionId") REFERENCES "RewardRedemption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RewardRedemptionAudit"
    ADD CONSTRAINT "RewardRedemptionAudit_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
