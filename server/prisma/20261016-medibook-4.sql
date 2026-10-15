-- MEDIBOOK wave 4 (2026-10-16): rooms and equipment (ოთახები — კაბინეტები და აპარატურა). A service may need one or
-- more resources; availability refuses a start when every unit of a needed resource is taken by overlapping live
-- appointments; the appointment remembers the resources it holds. Additive only: two new tables, one new column
-- with a default. Installed by server/scripts/install-medibook-4.mjs (in the root db:install); every statement may
-- be re-run.

-- A resource: a treatment room, a chair, a laser, an X-ray unit. `capacity` = how many visits may use it at once
-- (a waiting lounge or a group studio has more than one unit).
CREATE TABLE IF NOT EXISTS "BookResource" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'ROOM' CHECK (kind IN ('ROOM', 'EQUIPMENT')),
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookResource_business" ON "BookResource"("businessId", active, "sortOrder");

-- Which resources a service needs (all of them, for the whole visit).
CREATE TABLE IF NOT EXISTS "BookServiceResource" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "serviceId" TEXT NOT NULL REFERENCES "BookService"(id) ON DELETE CASCADE,
  "resourceId" TEXT NOT NULL REFERENCES "BookResource"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookServiceResource_pair" ON "BookServiceResource"("serviceId", "resourceId");
CREATE INDEX IF NOT EXISTS "BookServiceResource_resource" ON "BookServiceResource"("resourceId");

-- The resources an appointment holds (the ids of what its services needed when it was booked or moved).
ALTER TABLE "BookAppointment" ADD COLUMN IF NOT EXISTS "resourceIds" JSONB NOT NULL DEFAULT '[]'::jsonb;
