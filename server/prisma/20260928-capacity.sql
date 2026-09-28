-- Server capacity monitor (2026-09-28). Additive only; never touches existing tables.
-- One row per instance per minute (purged after 7 days) and the owner-alert history.
CREATE TABLE IF NOT EXISTS "CapacitySample" (
  "instance" TEXT NOT NULL,
  "at" TIMESTAMPTZ NOT NULL,
  "data" JSONB NOT NULL,
  PRIMARY KEY ("instance", "at")
);
CREATE INDEX IF NOT EXISTS "CapacitySample_at_idx" ON "CapacitySample" ("at");
CREATE TABLE IF NOT EXISTS "CapacityEvent" (
  "id" TEXT PRIMARY KEY,
  "at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "level" TEXT NOT NULL,
  "reasons" JSONB NOT NULL DEFAULT '[]',
  "message" TEXT NOT NULL,
  "delivered" BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS "CapacityEvent_at_idx" ON "CapacityEvent" ("at");
