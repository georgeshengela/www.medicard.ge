-- MEDIHOROSCOPE (2026-10-13). Additive only; installed by scripts/install-horoscope.mjs (npm run db:install).

-- Sign readings per period, written by our generator from the real sky (source = 'ai'). One row per
-- kind + period + sign + source.
CREATE TABLE IF NOT EXISTS "HoroscopeReading" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "sign" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "body" JSONB NOT NULL,
  "sky" JSONB,
  "status" TEXT NOT NULL DEFAULT 'LIVE',
  "model" TEXT,
  "costUsd" DOUBLE PRECISION,
  "edited" BOOLEAN NOT NULL DEFAULT FALSE,
  "editedBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "HoroscopeReading_period_key" ON "HoroscopeReading" ("kind", "periodKey", "sign", "source");
CREATE INDEX IF NOT EXISTS "HoroscopeReading_createdAt_idx" ON "HoroscopeReading" ("createdAt");

-- A person's birth details beyond the profile birth date (time and place are optional).
CREATE TABLE IF NOT EXISTS "HoroscopeProfile" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "birthTime" TEXT,
  "placeName" TEXT,
  "placeDetail" TEXT,
  "lat" DOUBLE PRECISION,
  "lon" DOUBLE PRECISION,
  "tz" TEXT,
  "showOnHome" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Interpretation texts (sign profiles, natal placements, transits, compatibility, tarot, numbers, dreams…).
CREATE TABLE IF NOT EXISTS "HoroscopeLibrary" (
  "key" TEXT NOT NULL,
  "lang" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'ai',
  "model" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("key", "lang")
);

-- Generator / horoskopi.ge runs (admin log).
CREATE TABLE IF NOT EXISTS "HoroscopeRun" (
  "id" TEXT PRIMARY KEY,
  "job" TEXT NOT NULL,
  "periodKey" TEXT,
  "status" TEXT NOT NULL,
  "ok" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "costUsd" DOUBLE PRECISION,
  "detail" JSONB,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "finishedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "HoroscopeRun_startedAt_idx" ON "HoroscopeRun" ("startedAt");

-- Admin settings (one row, id = 1).
CREATE TABLE IF NOT EXISTS "HoroscopeConfig" (
  "id" INTEGER PRIMARY KEY,
  "data" JSONB NOT NULL,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per person per Tbilisi day they opened the module, with the parts they opened (admin usage).
CREATE TABLE IF NOT EXISTS "HoroscopeVisit" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "day" DATE NOT NULL,
  "views" INTEGER NOT NULL DEFAULT 1,
  "sections" TEXT[] NOT NULL DEFAULT '{}',
  "lastAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("userId", "day")
);
CREATE INDEX IF NOT EXISTS "HoroscopeVisit_day_idx" ON "HoroscopeVisit" ("day");

-- The Oracle chat (MEDIHOROSCOPE's own assistant). Personal: only its owner reads it; admin sees counts.
CREATE TABLE IF NOT EXISTS "HoroscopeChatSession" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "HoroscopeChatSession_user_idx" ON "HoroscopeChatSession" ("userId", "updatedAt");

CREATE TABLE IF NOT EXISTS "HoroscopeChatMessage" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL REFERENCES "HoroscopeChatSession"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'COMPLETE',
  "cards" JSONB,
  "clientRequestId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "HoroscopeChatMessage_session_idx" ON "HoroscopeChatMessage" ("sessionId", "createdAt");
