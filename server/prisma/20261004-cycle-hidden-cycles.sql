-- „ამ ციკლის დამალვა“ (Clue „Hide this cycle“, brief §9 „მერე“ item 6): cycle start dates (YYYY-MM-DD)
-- she left out of averages and forecasts. Additive only. Read/written with raw SQL
-- (src/lib/cycleHiddenCycles.js); the Prisma field is @ignore. Default = nothing hidden.
ALTER TABLE "CycleProfile" ADD COLUMN IF NOT EXISTS "hiddenCycles" JSONB NOT NULL DEFAULT '[]'::jsonb;
