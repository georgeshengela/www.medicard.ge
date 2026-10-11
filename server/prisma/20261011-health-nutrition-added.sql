-- Calories a person added to a day by hand or through Medi (health sync fix 2026-10-11).
-- nutritionKcal = the phone's Apple Health / Health Connect day total + these additions, so a
-- device read replaces only its own part and never erases (or re-adds) what she logged herself.
-- Additive only. Read/written with raw SQL (src/lib/nutritionKcalSync.js); the Prisma field is @ignore.
-- NULL (every existing row) means "no additions known": the next device total replaces the value.
ALTER TABLE "HealthMetricDaily" ADD COLUMN IF NOT EXISTS "nutritionKcalAdded" DOUBLE PRECISION;
