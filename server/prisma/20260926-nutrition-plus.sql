BEGIN;
-- Dish title for a diary entry (photo dish name, label product, described meal).
ALTER TABLE "NutritionMeal" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '';
-- Saved / recent / custom foods and recipes owned by one account.
CREATE TABLE IF NOT EXISTS "NutritionFood" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "name" TEXT NOT NULL, "brand" TEXT NOT NULL DEFAULT '',
 "per100" JSONB NOT NULL, "serving" JSONB,
 "source" TEXT NOT NULL DEFAULT 'custom', "barcode" TEXT,
 "favorite" BOOLEAN NOT NULL DEFAULT FALSE, "useCount" INTEGER NOT NULL DEFAULT 0,
 "lastUsedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "NutritionFood_userId_lastUsedAt_idx" ON "NutritionFood"("userId","lastUsedAt" DESC);
CREATE INDEX IF NOT EXISTS "NutritionFood_userId_barcode_idx" ON "NutritionFood"("userId","barcode");
-- Shared, non-personal barcode cache (Open Food Facts product facts only).
CREATE TABLE IF NOT EXISTS "NutritionProduct" (
 "barcode" TEXT PRIMARY KEY, "data" JSONB NOT NULL, "source" TEXT NOT NULL DEFAULT 'openfoodfacts',
 "hits" INTEGER NOT NULL DEFAULT 0, "fetchedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Exercise and daily activity energy, per account and civil date.
CREATE TABLE IF NOT EXISTS "NutritionActivity" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "date" TEXT NOT NULL, "kind" TEXT NOT NULL, "minutes" INTEGER NOT NULL, "kcal" INTEGER NOT NULL,
 "note" TEXT NOT NULL DEFAULT '', "source" TEXT NOT NULL DEFAULT 'manual',
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "NutritionActivity_userId_date_idx" ON "NutritionActivity"("userId","date");
-- Per-account nutrition preferences (rollover, burned calories, reminders). Never a second goal.
CREATE TABLE IF NOT EXISTS "NutritionPreference" (
 "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
 "data" JSONB NOT NULL DEFAULT '{}'::jsonb, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Body measurements (centimetres), one row per account and date.
CREATE TABLE IF NOT EXISTS "BodyMeasurement" (
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "date" TEXT NOT NULL,
 "waistCm" REAL, "hipsCm" REAL, "chestCm" REAL, "armCm" REAL, "thighCm" REAL,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY ("userId","date")
);
COMMIT;
