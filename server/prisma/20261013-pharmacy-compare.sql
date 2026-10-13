-- Pharmacy compare v2 (2026-10-13). Additive only: new nullable columns and indexes, no change to existing rows.

-- What each pharmacy says about the box (substance, dose, form, count, maker, country, prescription…).
ALTER TABLE "PharmacyOffer" ADD COLUMN IF NOT EXISTS facts JSONB;

-- A product whose offers now belong to another product points there (old links and medicines keep working).
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS "mergedIntoId" TEXT;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS "latinName" TEXT;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS inn TEXT;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS "innKa" TEXT;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS "innKey" TEXT;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS "formGroup" TEXT;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS "doseKey" TEXT;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS "unitCount" INTEGER;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS "volumeKey" TEXT;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS rx BOOLEAN;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS "brandKey" TEXT;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS "countryIso" TEXT;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS "manufacturerLatin" TEXT;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS "chainCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS "savingsPercent" INTEGER;
ALTER TABLE "CatalogProduct" ADD COLUMN IF NOT EXISTS "searchText" TEXT;

CREATE INDEX IF NOT EXISTS "CatalogProduct_mergedIntoId_idx" ON "CatalogProduct"("mergedIntoId");
CREATE INDEX IF NOT EXISTS "CatalogProduct_innKey_idx" ON "CatalogProduct"("innKey");
CREATE INDEX IF NOT EXISTS "CatalogProduct_brandKey_idx" ON "CatalogProduct"("brandKey");
