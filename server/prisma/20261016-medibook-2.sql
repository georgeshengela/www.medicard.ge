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
