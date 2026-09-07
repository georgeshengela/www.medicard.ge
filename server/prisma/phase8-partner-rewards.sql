-- Medi Quest Phase 8 — Partner Rewards platform (additive only).
-- Apply: npx prisma db execute --file prisma/phase8-partner-rewards.sql --schema prisma/schema.prisma
-- Do NOT use prisma db push.

-- Admin capabilities (null = full legacy access)
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "capabilities" JSONB;

-- Expand RewardPartner
ALTER TABLE "RewardPartner" ADD COLUMN IF NOT EXISTS "legalName" TEXT;
ALTER TABLE "RewardPartner" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "RewardPartner" ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE "RewardPartner" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "RewardPartner" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;
ALTER TABLE "RewardPartner" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "RewardPartner" ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER;

-- RewardCampaign
CREATE TABLE IF NOT EXISTS "RewardCampaign" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "rewardDefinitionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  -- DRAFT | SCHEDULED | ACTIVE | PAUSED | ENDED | ARCHIVED
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  -- SPONSORED_FIXED | PER_REDEMPTION | PER_USED | AFFILIATE | INTERNAL
  "fundingModel" TEXT,
  "budgetType" TEXT,
  "budgetValue" INTEGER,
  "maxRedemptions" INTEGER,
  "perUserLimit" INTEGER,
  "periodLimitType" TEXT,
  "periodLimitCount" INTEGER,
  "periodWindowDays" INTEGER,
  "marketCountryCode" TEXT,
  "commercialValueMinor" INTEGER,
  "commercialCurrency" TEXT,
  "internalCostMinor" INTEGER,
  "lowStockThreshold" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdByAdminId" TEXT,
  "updatedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RewardCampaign_key_key" ON "RewardCampaign"("key");
CREATE INDEX IF NOT EXISTS "RewardCampaign_partnerId_status_idx" ON "RewardCampaign"("partnerId", "status");
CREATE INDEX IF NOT EXISTS "RewardCampaign_rewardDefinitionId_status_idx" ON "RewardCampaign"("rewardDefinitionId", "status");
CREATE INDEX IF NOT EXISTS "RewardCampaign_status_startsAt_endsAt_idx" ON "RewardCampaign"("status", "startsAt", "endsAt");

DO $$ BEGIN
  ALTER TABLE "RewardCampaign"
    ADD CONSTRAINT "RewardCampaign_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "RewardPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RewardCampaign"
    ADD CONSTRAINT "RewardCampaign_rewardDefinitionId_fkey"
    FOREIGN KEY ("rewardDefinitionId") REFERENCES "RewardDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Redemption campaign snapshot + commercial snapshot
ALTER TABLE "RewardRedemption" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;
ALTER TABLE "RewardRedemption" ADD COLUMN IF NOT EXISTS "partnerIdSnapshot" TEXT;
ALTER TABLE "RewardRedemption" ADD COLUMN IF NOT EXISTS "commercialValueMinorSnapshot" INTEGER;
ALTER TABLE "RewardRedemption" ADD COLUMN IF NOT EXISTS "commercialCurrencySnapshot" TEXT;

CREATE INDEX IF NOT EXISTS "RewardRedemption_campaignId_idx" ON "RewardRedemption"("campaignId");
CREATE INDEX IF NOT EXISTS "RewardRedemption_partnerIdSnapshot_idx" ON "RewardRedemption"("partnerIdSnapshot");
CREATE INDEX IF NOT EXISTS "RewardRedemption_redeemedAt_idx" ON "RewardRedemption"("redeemedAt");
CREATE INDEX IF NOT EXISTS "RewardRedemption_status_redeemedAt_idx" ON "RewardRedemption"("status", "redeemedAt");

DO $$ BEGIN
  ALTER TABLE "RewardRedemption"
    ADD CONSTRAINT "RewardRedemption_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "RewardCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RewardDefinition low-stock threshold
ALTER TABLE "RewardDefinition" ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER;

CREATE INDEX IF NOT EXISTS "RewardCode_status_expiresAt_idx" ON "RewardCode"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "RewardCode_expiresAt_idx" ON "RewardCode"("expiresAt");
