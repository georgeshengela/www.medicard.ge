-- Product funnel (2026-09-28). Additive only: one new table, no change to existing rows.
-- Event names and small enums only (see src/lib/funnel.js allow-list). Never health values or free text.
-- installHash is sha256 of the app install id; the raw id is never stored.

CREATE TABLE IF NOT EXISTS "FunnelEvent" (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "User"(id) ON DELETE CASCADE,
  "installHash" TEXT,
  name TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  platform TEXT,
  "appVersion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "FunnelEvent_name_time" ON "FunnelEvent"(name, "createdAt");
CREATE INDEX IF NOT EXISTS "FunnelEvent_user_name" ON "FunnelEvent"("userId", name);
CREATE INDEX IF NOT EXISTS "FunnelEvent_install" ON "FunnelEvent"("installHash");

-- Once per install: the first open carries the attribution (source / utm).
CREATE UNIQUE INDEX IF NOT EXISTS "FunnelEvent_install_once" ON "FunnelEvent"("installHash", name) WHERE name = 'app_first_open';
-- Once per account: signup, onboarding finished, first health action.
CREATE UNIQUE INDEX IF NOT EXISTS "FunnelEvent_user_once" ON "FunnelEvent"("userId", name) WHERE name IN ('signup_completed', 'onboarding_completed', 'first_health_action');
