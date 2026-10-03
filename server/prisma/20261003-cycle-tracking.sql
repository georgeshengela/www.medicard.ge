-- Cycle „თვალყურის დევნება“ / Tracking and the fertile-days display switch (brief §9 wave 2 item 17).
-- Additive only. Read/written with raw SQL (src/lib/cycleTrackingPrefs.js); the Prisma fields are @ignore.
-- expectsBleeding false = „მენსტრუაციას არ ველი“ (TRACK_PERIOD: no forecasts). fertilityDisplay = 'auto' | 'off'.
ALTER TABLE "CycleProfile" ADD COLUMN IF NOT EXISTS "expectsBleeding" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CycleProfile" ADD COLUMN IF NOT EXISTS "fertilityDisplay" TEXT NOT NULL DEFAULT 'auto';
