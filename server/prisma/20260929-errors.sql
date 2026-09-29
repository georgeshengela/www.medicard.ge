-- Self-hosted error monitoring (2026-09-29). Additive only: one new table, no change to existing rows.
-- Scrubbed error summaries only (src/lib/errorMonitor.js): no request bodies, no query strings,
-- no health data, no raw user ids. userHash = first 16 hex of sha256(user id).
-- "count" = this row plus the repeats of the same fingerprint that the in-memory 10 s de-dup folded into it.

CREATE TABLE IF NOT EXISTS "ErrorEvent" (
  id TEXT PRIMARY KEY,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  "stackTop" TEXT,
  route TEXT,
  platform TEXT,
  "appVersion" TEXT,
  fatal BOOLEAN NOT NULL DEFAULT FALSE,
  "userHash" TEXT,
  count INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS "ErrorEvent_fingerprint_time" ON "ErrorEvent"(fingerprint, "createdAt");
CREATE INDEX IF NOT EXISTS "ErrorEvent_time" ON "ErrorEvent"("createdAt");
