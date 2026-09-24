BEGIN;
ALTER TABLE "NutritionSettings" ADD COLUMN IF NOT EXISTS "programEnabled" BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS "NutritionProgram" (
 "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
 "revision" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT TRUE,
 "config" JSONB NOT NULL, "targets" JSONB NOT NULL, "goalLink" JSONB,
 "startedOn" TEXT NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "NutritionTargetHistory" (
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "date" TEXT NOT NULL, "targets" JSONB,
 PRIMARY KEY ("userId","date")
);
CREATE TABLE IF NOT EXISTS "NutritionRecipe" (
 "id" TEXT PRIMARY KEY, "data" JSONB NOT NULL, "active" BOOLEAN NOT NULL DEFAULT TRUE,
 "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "NutritionPlannedMeal" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "date" TEXT NOT NULL, "type" TEXT NOT NULL CHECK ("type" IN ('breakfast','lunch','dinner','snack')),
 "recipeId" TEXT NOT NULL REFERENCES "NutritionRecipe"("id"), "programRevision" TEXT NOT NULL,
 "data" JSONB NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE ("userId","date","type")
);
CREATE INDEX IF NOT EXISTS "NutritionPlannedMeal_userId_date_idx" ON "NutritionPlannedMeal"("userId","date");
COMMIT;
