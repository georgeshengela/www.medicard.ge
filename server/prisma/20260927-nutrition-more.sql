BEGIN;
-- A saved food can be the person's own recipe: ingredients and servings kept for editing.
ALTER TABLE "NutritionFood" ADD COLUMN IF NOT EXISTS "recipe" JSONB;
-- Intermittent fasting windows, one row per fast. At most one open fast per account.
CREATE TABLE IF NOT EXISTS "NutritionFast" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "startedAt" TIMESTAMPTZ NOT NULL, "endedAt" TIMESTAMPTZ,
 "targetMinutes" INTEGER NOT NULL, "protocol" TEXT NOT NULL DEFAULT 'custom',
 "note" TEXT NOT NULL DEFAULT '',
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "NutritionFast_userId_startedAt_idx" ON "NutritionFast"("userId","startedAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "NutritionFast_one_open_idx" ON "NutritionFast"("userId") WHERE "endedAt" IS NULL;
COMMIT;
