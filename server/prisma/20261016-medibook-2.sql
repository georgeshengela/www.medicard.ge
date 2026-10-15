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

-- SMS reminders: which SMS already went out for a booking (push keeps remindedDay / remindedSoon).
ALTER TABLE "BookAppointment" ADD COLUMN IF NOT EXISTS "smsDay" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "BookAppointment" ADD COLUMN IF NOT EXISTS "smsSoon" BOOLEAN NOT NULL DEFAULT FALSE;

-- Loyalty: cashback on the client card, gift cards, memberships (visit packages / prepaid amounts), and a
-- ledger of every movement. A completed visit may be paid partly by a gift card, bonus points or a
-- membership: the parts are kept on the appointment ("paidParts") so undoing the completion puts them back.
ALTER TABLE "BookClient" ADD COLUMN IF NOT EXISTS "bonusBalance" NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "BookAppointment" ADD COLUMN IF NOT EXISTS "paidParts" JSONB;

CREATE TABLE IF NOT EXISTS "BookGiftCard" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  balance NUMERIC(12,2) NOT NULL,
  "buyerClientId" TEXT REFERENCES "BookClient"(id) ON DELETE SET NULL,
  "buyerName" TEXT,
  "recipientName" TEXT,
  "recipientPhone" TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED')),
  "expiresOn" TEXT,
  "paidMethod" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookGiftCard_code" ON "BookGiftCard"("businessId", code);
CREATE INDEX IF NOT EXISTS "BookGiftCard_business_status" ON "BookGiftCard"("businessId", status);

CREATE TABLE IF NOT EXISTS "BookMembership" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'VISITS' CHECK (kind IN ('VISITS', 'AMOUNT')),
  "serviceIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "visitsTotal" INTEGER,
  "amountTotal" NUMERIC(12,2),
  price NUMERIC(12,2) NOT NULL,
  "validDays" INTEGER NOT NULL DEFAULT 90,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookMembership_business" ON "BookMembership"("businessId", active);

CREATE TABLE IF NOT EXISTS "BookClientMembership" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "membershipId" TEXT REFERENCES "BookMembership"(id) ON DELETE SET NULL,
  "clientId" TEXT NOT NULL REFERENCES "BookClient"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  "serviceIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "visitsTotal" INTEGER,
  "visitsLeft" INTEGER,
  "amountTotal" NUMERIC(12,2),
  "amountLeft" NUMERIC(12,2),
  price NUMERIC(12,2) NOT NULL,
  "paidMethod" TEXT,
  "startsOn" TEXT NOT NULL,
  "endsOn" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED')),
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookClientMembership_client" ON "BookClientMembership"("clientId", status);
CREATE INDEX IF NOT EXISTS "BookClientMembership_business" ON "BookClientMembership"("businessId", status);

CREATE TABLE IF NOT EXISTS "BookLoyaltyLedger" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "clientId" TEXT REFERENCES "BookClient"(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('BONUS_EARN', 'BONUS_REDEEM', 'BONUS_ADJUST', 'GIFT_SOLD', 'GIFT_REDEEM', 'MEMBERSHIP_SOLD', 'MEMBERSHIP_USE')),
  amount NUMERIC(12,2) NOT NULL,
  "appointmentId" TEXT REFERENCES "BookAppointment"(id) ON DELETE SET NULL,
  "giftCardId" TEXT REFERENCES "BookGiftCard"(id) ON DELETE SET NULL,
  "clientMembershipId" TEXT REFERENCES "BookClientMembership"(id) ON DELETE SET NULL,
  note TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookLoyaltyLedger_business" ON "BookLoyaltyLedger"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "BookLoyaltyLedger_client" ON "BookLoyaltyLedger"("clientId", "createdAt");
