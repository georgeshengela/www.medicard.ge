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

-- Branches: several locations of one brand. A group ties them; each location stays a full business with its own
-- calendar, team, clients and money — the panel adds a branch from an existing one and compares them.
CREATE TABLE IF NOT EXISTS "BookGroup" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "ownerUserId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "BookBusiness" ADD COLUMN IF NOT EXISTS "groupId" TEXT REFERENCES "BookGroup"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "BookBusiness_group" ON "BookBusiness"("groupId");

-- Products and sales: what the business sells over the counter (shampoo, a cream), stock per product, every
-- sale as one row with its items; a sale is income (category PRODUCT) and a stock move; a refund puts both back.
CREATE TABLE IF NOT EXISTS "BookProduct" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  price NUMERIC(12,2) NOT NULL,
  cost NUMERIC(12,2),
  stock NUMERIC(12,2),
  unit TEXT NOT NULL DEFAULT 'pc',
  "lowStock" NUMERIC(12,2) NOT NULL DEFAULT 3,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookProduct_business" ON "BookProduct"("businessId", active, "sortOrder");

CREATE TABLE IF NOT EXISTS "BookSale" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "clientId" TEXT REFERENCES "BookClient"(id) ON DELETE SET NULL,
  "clientName" TEXT,
  "appointmentId" TEXT REFERENCES "BookAppointment"(id) ON DELETE SET NULL,
  "staffId" TEXT REFERENCES "BookStaff"(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(12,2) NOT NULL,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  "paidMethod" TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'DONE' CHECK (status IN ('DONE', 'REFUNDED')),
  "transactionId" TEXT,
  at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookSale_business_at" ON "BookSale"("businessId", at);
CREATE INDEX IF NOT EXISTS "BookSale_staff" ON "BookSale"("staffId", at);

CREATE TABLE IF NOT EXISTS "BookStockMove" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "BookProduct"(id) ON DELETE CASCADE,
  delta NUMERIC(12,2) NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('SALE', 'REFUND', 'RESTOCK', 'ADJUST')),
  "saleId" TEXT REFERENCES "BookSale"(id) ON DELETE SET NULL,
  note TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookStockMove_product" ON "BookStockMove"("productId", "createdAt");

-- Payroll: pay rules per person (a share of service value, of product sales, a fixed monthly amount) and the
-- payouts made; a payout is an expense (category SALARY) for that person.
ALTER TABLE "BookStaff" ADD COLUMN IF NOT EXISTS pay JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS "BookPayout" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "staffId" TEXT NOT NULL REFERENCES "BookStaff"(id) ON DELETE CASCADE,
  "periodFrom" TEXT NOT NULL,
  "periodTo" TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  method TEXT,
  note TEXT,
  "transactionId" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookPayout_staff" ON "BookPayout"("staffId", "periodFrom");
