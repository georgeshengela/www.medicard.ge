-- MEDIBOOK, second wave (2026-10-16): several services in one booking. Additive only; installed by
-- server/scripts/install-medibook-2.mjs (npm run db:install), safe to run again.

-- One row per service inside a booking. The appointment row keeps the first service id, the joined
-- names, the total duration and the total price, so every older reader keeps working.
CREATE TABLE IF NOT EXISTS "BookAppointmentItem" (
  id TEXT PRIMARY KEY,
  "appointmentId" TEXT NOT NULL REFERENCES "BookAppointment"(id) ON DELETE CASCADE,
  "serviceId" TEXT REFERENCES "BookService"(id) ON DELETE SET NULL,
  "serviceName" TEXT NOT NULL,
  "durationMin" INTEGER NOT NULL,
  price NUMERIC(10,2),
  "discountId" TEXT,
  "discountAmount" NUMERIC(10,2),
  "sortOrder" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "BookAppointmentItem_appointment" ON "BookAppointmentItem"("appointmentId");

-- Waiting list: a client wants a time that is not free yet — a range of days, parts of the day, optionally one
-- person. Cancellations, moves, removed time off and the five-minute pass match open entries and offer the
-- first fitting slot (one push, then nothing for a day); a booking in the range closes the entry.
CREATE TABLE IF NOT EXISTS "BookWaitlist" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "clientUserId" TEXT REFERENCES "User"(id) ON DELETE CASCADE,
  "clientId" TEXT REFERENCES "BookClient"(id) ON DELETE SET NULL,
  "clientName" TEXT NOT NULL,
  "clientPhone" TEXT,
  "serviceId" TEXT REFERENCES "BookService"(id) ON DELETE SET NULL,
  "serviceIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "serviceName" TEXT NOT NULL,
  "staffId" TEXT REFERENCES "BookStaff"(id) ON DELETE SET NULL,
  "fromDate" TEXT NOT NULL,
  "toDate" TEXT NOT NULL,
  "dayParts" JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'OFFERED', 'BOOKED', 'CANCELLED', 'EXPIRED')),
  source TEXT NOT NULL DEFAULT 'APP' CHECK (source IN ('APP', 'WEB', 'BUSINESS')),
  "offeredAt" TIMESTAMPTZ(3),
  "offeredStartsAt" TIMESTAMPTZ(3),
  "offeredStaffId" TEXT,
  "offerCount" INTEGER NOT NULL DEFAULT 0,
  "appointmentId" TEXT REFERENCES "BookAppointment"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookWaitlist_business_status" ON "BookWaitlist"("businessId", status, "fromDate");
CREATE INDEX IF NOT EXISTS "BookWaitlist_client_user" ON "BookWaitlist"("clientUserId", status);
