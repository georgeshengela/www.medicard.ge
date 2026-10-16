-- MEDIBOOK wave 6 (2026-10-16): group classes with seats. A service with `seats` > 1 is a class: many clients
-- book the same start with the same trainer. `BookClass` is one occurrence (planned ahead by the timetable helper
-- or formed by the first booking); every attendee stays a `BookAppointment` row (reminders, SMS, payroll,
-- analytics and the client history keep working per person) linked through `classId`. Additive only; installed by
-- server/scripts/install-medibook-6.mjs (in the root db:install); every statement may be re-run.

-- 1 = a normal visit; 2+ = a class with that many seats. `classSchedule` keeps the weekly template of the helper
-- ({ staffId, weeks, weekly: [{ weekday, time }] }) so the dialog reopens with it.
ALTER TABLE "BookService" ADD COLUMN IF NOT EXISTS seats INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "BookService" ADD COLUMN IF NOT EXISTS "classSchedule" JSONB;

-- One class occurrence: the trainer's time is blocked for every other service, the rooms it needs are held once,
-- and the same service may be booked into it while booked seats < seats. status OPEN | CANCELLED.
CREATE TABLE IF NOT EXISTS "BookClass" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "serviceId" TEXT NOT NULL REFERENCES "BookService"(id) ON DELETE CASCADE,
  "staffId" TEXT REFERENCES "BookStaff"(id) ON DELETE SET NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  seats INTEGER NOT NULL DEFAULT 1,
  "resourceIds" JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'OPEN',
  planned BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  "cancelReason" TEXT,
  "cancelledAt" TIMESTAMPTZ(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- `planned` = the business put it on the calendar (one class, or the weekly timetable); FALSE = formed by the first
-- booking. A service with a planned class ahead offers only its planned classes in the app, never the free grid.
ALTER TABLE "BookClass" ADD COLUMN IF NOT EXISTS planned BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS "BookClass_business_start" ON "BookClass"("businessId", "startsAt");
CREATE INDEX IF NOT EXISTS "BookClass_service_start" ON "BookClass"("serviceId", status, "startsAt");

-- An attendee's booking points at its class; a deleted (empty) class leaves old cancelled rows without one.
ALTER TABLE "BookAppointment" ADD COLUMN IF NOT EXISTS "classId" TEXT REFERENCES "BookClass"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "BookAppointment_class" ON "BookAppointment"("classId");
