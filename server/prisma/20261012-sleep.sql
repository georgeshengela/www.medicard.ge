-- MEDISLEEP (2026-10-12): sleep plan, nights, sound library, tips, plays. Additive only (install-sleep.mjs).

-- One plan per person: how long they want to sleep, when they get up, which sleep reminders they want.
CREATE TABLE IF NOT EXISTS "SleepPlan" (
 "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
 "goalMinutes" INTEGER NOT NULL DEFAULT 480,
 "wakeTime" TEXT NOT NULL DEFAULT '07:00',
 "weekendWakeTime" TEXT,
 "windDownMinutes" INTEGER NOT NULL DEFAULT 30,
 "bedtimeReminder" BOOLEAN NOT NULL DEFAULT TRUE,
 "checkinReminder" BOOLEAN NOT NULL DEFAULT TRUE,
 "alarm" BOOLEAN NOT NULL DEFAULT FALSE,
 "hideScore" BOOLEAN NOT NULL DEFAULT FALSE,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per night, keyed by the morning it ends (the Health rule in mobile/src/lib/sleepNights.ts).
-- Times come from sleep mode, a hand entry or Apple Health / Health Connect; "timesSource" says which won.
CREATE TABLE IF NOT EXISTS "SleepNight" (
 "id" TEXT PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "night" DATE NOT NULL,
 "bedAt" TIMESTAMPTZ,
 "wakeAt" TIMESTAMPTZ,
 "inBedMinutes" INTEGER,
 "asleepMinutes" INTEGER,
 "awakeMinutes" INTEGER,
 "deepMinutes" INTEGER,
 "remMinutes" INTEGER,
 "coreMinutes" INTEGER,
 "latencyMinutes" INTEGER,
 "wakeups" INTEGER,
 "quality" SMALLINT,
 "factors" TEXT[] NOT NULL DEFAULT '{}',
 "sounds" TEXT[] NOT NULL DEFAULT '{}',
 "timesSource" TEXT NOT NULL DEFAULT 'manual',
 "checkedInAt" TIMESTAMPTZ,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "SleepNight_userId_night_key" ON "SleepNight"("userId","night");
CREATE INDEX IF NOT EXISTS "SleepNight_createdAt_feed_idx" ON "SleepNight"("createdAt" DESC);

-- Listening sessions (sound ids and minutes only) for the admin page and the person's own history.
CREATE TABLE IF NOT EXISTS "SleepPlay" (
 "id" TEXT PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "soundIds" TEXT[] NOT NULL DEFAULT '{}',
 "startedAt" TIMESTAMPTZ NOT NULL,
 "minutes" INTEGER NOT NULL DEFAULT 0,
 "timerMinutes" INTEGER,
 "sleepMode" BOOLEAN NOT NULL DEFAULT FALSE,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "SleepPlay_userId_startedAt_idx" ON "SleepPlay"("userId","startedAt" DESC);
CREATE INDEX IF NOT EXISTS "SleepPlay_startedAt_idx" ON "SleepPlay"("startedAt" DESC);
-- Plays arrive in batches, so the admin live feed reads them by "createdAt".
CREATE INDEX IF NOT EXISTS "SleepPlay_createdAt_feed_idx" ON "SleepPlay"("createdAt" DESC);

-- The sound library the admin manages. File bytes go to R2 when object storage is configured ("storageKey"),
-- otherwise into "SleepFile"."bytes" — either way they survive deploys.
CREATE TABLE IF NOT EXISTS "SleepSound" (
 "id" TEXT PRIMARY KEY,
 "category" TEXT NOT NULL,
 "titleKa" TEXT NOT NULL,
 "titleEn" TEXT NOT NULL,
 "subtitleKa" TEXT NOT NULL DEFAULT '',
 "subtitleEn" TEXT NOT NULL DEFAULT '',
 "tint" TEXT NOT NULL DEFAULT '#2B2452',
 "loop" BOOLEAN NOT NULL DEFAULT TRUE,
 "featured" BOOLEAN NOT NULL DEFAULT FALSE,
 "status" TEXT NOT NULL DEFAULT 'DRAFT',
 "sortOrder" INTEGER NOT NULL DEFAULT 0,
 "audioFileId" TEXT,
 "tailFileId" TEXT,
 "artFileId" TEXT,
 "durationMs" INTEGER,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "SleepFile" (
 "id" TEXT PRIMARY KEY,
 "kind" TEXT NOT NULL,
 "mime" TEXT NOT NULL,
 "bytes" BYTEA,
 "storageKey" TEXT,
 "size" INTEGER NOT NULL,
 "sha256" TEXT NOT NULL,
 "durationMs" INTEGER,
 "createdBy" TEXT,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evening and morning advice the admin can edit; "trigger" picks when the app offers it.
CREATE TABLE IF NOT EXISTS "SleepTip" (
 "id" TEXT PRIMARY KEY,
 "trigger" TEXT NOT NULL DEFAULT 'always',
 "titleKa" TEXT NOT NULL,
 "titleEn" TEXT NOT NULL,
 "bodyKa" TEXT NOT NULL,
 "bodyEn" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'LIVE',
 "sortOrder" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Module settings (one row, id 'default'): timer, fade, layers, check-in factors.
CREATE TABLE IF NOT EXISTS "SleepConfig" (
 "id" TEXT PRIMARY KEY,
 "data" JSONB NOT NULL DEFAULT '{}'::jsonb,
 "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
