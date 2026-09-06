-- Idempotent hydration events + step capability (Quest Phase 3)

CREATE TABLE IF NOT EXISTS "HydrationIntakeEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientEventId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "deltaMl" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HydrationIntakeEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HydrationIntakeEvent_userId_clientEventId_key"
  ON "HydrationIntakeEvent"("userId", "clientEventId");

CREATE INDEX IF NOT EXISTS "HydrationIntakeEvent_userId_date_idx"
  ON "HydrationIntakeEvent"("userId", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HydrationIntakeEvent_userId_fkey'
  ) THEN
    ALTER TABLE "HydrationIntakeEvent"
      ADD CONSTRAINT "HydrationIntakeEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "StepTrackingCapability" (
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StepTrackingCapability_pkey" PRIMARY KEY ("userId")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StepTrackingCapability_userId_fkey'
  ) THEN
    ALTER TABLE "StepTrackingCapability"
      ADD CONSTRAINT "StepTrackingCapability_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
