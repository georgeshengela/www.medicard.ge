-- MEDIBOOK (2026-10-15): the catalogue of dental clinics, beauty salons, aesthetic centres, clinics and
-- studios; claimed businesses with staff, services, calendar, bookings, clients, discounts, finance and
-- reviews; and MEDICARD users' appointments. Additive only — new tables, no change to existing rows.
-- Installed by server/scripts/install-medibook.mjs (db:install). See docs/agents/medibook.md.

-- One place of business. Catalogue rows (status LISTED) come from public sources and carry only public
-- facts; a claimed row (CLAIMED) is edited by its owner through /business. PENDING = registered by an
-- owner, waiting for an admin; HIDDEN = removed from every list by an admin.
CREATE TABLE IF NOT EXISTS "BookBusiness" (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  "nameKa" TEXT,
  category TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  description TEXT,
  "descriptionKa" TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  instagram TEXT,
  facebook TEXT,
  address TEXT,
  "addressKa" TEXT,
  city TEXT,
  district TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  hours JSONB NOT NULL DEFAULT '{}',
  photos JSONB NOT NULL DEFAULT '[]',
  "logoImageId" TEXT,
  "coverImageId" TEXT,
  source TEXT NOT NULL DEFAULT 'OWNER',
  "sourceRef" TEXT,
  status TEXT NOT NULL DEFAULT 'LISTED' CHECK (status IN ('LISTED', 'PENDING', 'CLAIMED', 'HIDDEN')),
  "ownerUserId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "claimedAt" TIMESTAMPTZ(3),
  settings JSONB NOT NULL DEFAULT '{}',
  "ratingAvg" DOUBLE PRECISION,
  "ratingCount" INTEGER NOT NULL DEFAULT 0,
  "bookingCount" INTEGER NOT NULL DEFAULT 0,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookBusiness_slug" ON "BookBusiness"(slug);
CREATE UNIQUE INDEX IF NOT EXISTS "BookBusiness_source_ref" ON "BookBusiness"(source, "sourceRef") WHERE "sourceRef" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "BookBusiness_status_category" ON "BookBusiness"(status, category);
CREATE INDEX IF NOT EXISTS "BookBusiness_geo" ON "BookBusiness"(lat, lng);
CREATE INDEX IF NOT EXISTS "BookBusiness_city" ON "BookBusiness"(city);
CREATE INDEX IF NOT EXISTS "BookBusiness_owner" ON "BookBusiness"("ownerUserId");

-- Pictures (logo, cover, gallery): bytes in Postgres like announcements, public /api/book/image/:id.
CREATE TABLE IF NOT EXISTS "BookImage" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  bytes BYTEA NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookImage_business" ON "BookImage"("businessId");

-- Who may open a business in /business. OWNER = everything; MANAGER = everything but members and
-- deletion; STAFF = own calendar and clients. `staffId` links a member to the staff row that is them.
CREATE TABLE IF NOT EXISTS "BookMember" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'STAFF' CHECK (role IN ('OWNER', 'MANAGER', 'STAFF')),
  "staffId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookMember_business_user" ON "BookMember"("businessId", "userId");
CREATE INDEX IF NOT EXISTS "BookMember_user" ON "BookMember"("userId");

-- A claim of a listed business or the registration of a new one. An admin approves it in #/book;
-- approval makes the person OWNER and the business CLAIMED.
CREATE TABLE IF NOT EXISTS "BookClaim" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'CLAIM' CHECK (kind IN ('CLAIM', 'REGISTER')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  proof JSONB NOT NULL DEFAULT '{}',
  note TEXT,
  "reviewNote" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookClaim_status" ON "BookClaim"(status, "createdAt");
CREATE INDEX IF NOT EXISTS "BookClaim_user" ON "BookClaim"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "BookClaim_open" ON "BookClaim"("businessId", "userId") WHERE status = 'PENDING';

-- People who perform services. `schedule` = working hours per weekday {"1":[{"from":"10:00","to":"19:00"}],…}
-- (empty = the business hours), `serviceIds` = what they do (empty = every service).
CREATE TABLE IF NOT EXISTS "BookStaff" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  "imageId" TEXT,
  color TEXT,
  "userId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "serviceIds" JSONB NOT NULL DEFAULT '[]',
  schedule JSONB NOT NULL DEFAULT '{}',
  bookable BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookStaff_business" ON "BookStaff"("businessId", active, "sortOrder");

-- What can be booked. Prices in GEL (tetri-exact numeric); `priceTo` for „from … to“ ranges.
CREATE TABLE IF NOT EXISTS "BookService" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "group" TEXT,
  name TEXT NOT NULL,
  "nameKa" TEXT,
  description TEXT,
  "durationMin" INTEGER NOT NULL DEFAULT 30,
  "bufferMin" INTEGER NOT NULL DEFAULT 0,
  price NUMERIC(10,2),
  "priceTo" NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'GEL',
  online BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookService_business" ON "BookService"("businessId", active, "sortOrder");

-- Closed hours: a holiday for the whole business (staffId null) or one person's day off / break.
CREATE TABLE IF NOT EXISTS "BookTimeOff" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "staffId" TEXT REFERENCES "BookStaff"(id) ON DELETE CASCADE,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  reason TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookTimeOff_business" ON "BookTimeOff"("businessId", "startsAt");

-- The business's client book (CRM). A MEDICARD user who books becomes a client row (userId set);
-- walk-ins the business adds by hand have a name and a phone only.
CREATE TABLE IF NOT EXISTS "BookClient" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "userId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  tags JSONB NOT NULL DEFAULT '[]',
  visits INTEGER NOT NULL DEFAULT 0,
  "noShows" INTEGER NOT NULL DEFAULT 0,
  "totalSpent" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "firstVisitAt" TIMESTAMPTZ(3),
  "lastVisitAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookClient_business_user" ON "BookClient"("businessId", "userId") WHERE "userId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "BookClient_business_phone" ON "BookClient"("businessId", phone);
CREATE INDEX IF NOT EXISTS "BookClient_business_last" ON "BookClient"("businessId", "lastVisitAt");

-- Promotions: percent or fixed amount off, on every service or named ones, within dates, weekdays
-- and hours (happy hours / last-minute), optionally with a code and a use limit.
CREATE TABLE IF NOT EXISTS "BookDiscount" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'PERCENT' CHECK (kind IN ('PERCENT', 'FIXED')),
  value NUMERIC(10,2) NOT NULL,
  "serviceIds" JSONB NOT NULL DEFAULT '[]',
  "startsOn" DATE,
  "endsOn" DATE,
  weekdays JSONB NOT NULL DEFAULT '[]',
  "hoursFrom" TEXT,
  "hoursTo" TEXT,
  code TEXT,
  "maxUses" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookDiscount_business" ON "BookDiscount"("businessId", active);

-- An appointment. `clientUserId` is the MEDICARD account when the person booked in the app or on the
-- web; the business's own walk-ins have `clientId` only. Prices are copied at booking time.
CREATE TABLE IF NOT EXISTS "BookAppointment" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "serviceId" TEXT REFERENCES "BookService"(id) ON DELETE SET NULL,
  "serviceName" TEXT NOT NULL,
  "staffId" TEXT REFERENCES "BookStaff"(id) ON DELETE SET NULL,
  "clientId" TEXT REFERENCES "BookClient"(id) ON DELETE SET NULL,
  "clientUserId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "clientName" TEXT NOT NULL,
  "clientPhone" TEXT,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "durationMin" INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW')),
  source TEXT NOT NULL DEFAULT 'APP' CHECK (source IN ('APP', 'WEB', 'BUSINESS')),
  price NUMERIC(10,2),
  "discountId" TEXT,
  "discountAmount" NUMERIC(10,2),
  "paidAmount" NUMERIC(10,2),
  "paidMethod" TEXT,
  note TEXT,
  "internalNote" TEXT,
  "cancelledBy" TEXT,
  "cancelReason" TEXT,
  "cancelledAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "reviewedAt" TIMESTAMPTZ(3),
  "remindedDay" BOOLEAN NOT NULL DEFAULT FALSE,
  "remindedSoon" BOOLEAN NOT NULL DEFAULT FALSE,
  "reviewAsked" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookAppointment_business_time" ON "BookAppointment"("businessId", "startsAt");
CREATE INDEX IF NOT EXISTS "BookAppointment_staff_time" ON "BookAppointment"("staffId", "startsAt");
CREATE INDEX IF NOT EXISTS "BookAppointment_client_user" ON "BookAppointment"("clientUserId", "startsAt");
CREATE INDEX IF NOT EXISTS "BookAppointment_client" ON "BookAppointment"("clientId", "startsAt");
CREATE INDEX IF NOT EXISTS "BookAppointment_status_time" ON "BookAppointment"(status, "startsAt");

-- One review per completed appointment; the business may answer once.
CREATE TABLE IF NOT EXISTS "BookReview" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "appointmentId" TEXT NOT NULL REFERENCES "BookAppointment"(id) ON DELETE CASCADE,
  "userId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT,
  reply TEXT,
  "repliedAt" TIMESTAMPTZ(3),
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookReview_appointment" ON "BookReview"("appointmentId");
CREATE INDEX IF NOT EXISTS "BookReview_business" ON "BookReview"("businessId", "createdAt");

-- Saved places of a MEDICARD user.
CREATE TABLE IF NOT EXISTS "BookFavorite" (
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "businessId")
);

-- The business's money book: income from appointments (written when one is completed) and anything
-- the owner adds by hand (expenses, other income). Amounts in GEL.
CREATE TABLE IF NOT EXISTS "BookTransaction" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "appointmentId" TEXT REFERENCES "BookAppointment"(id) ON DELETE SET NULL,
  "staffId" TEXT REFERENCES "BookStaff"(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE')),
  category TEXT NOT NULL DEFAULT 'SERVICE',
  amount NUMERIC(12,2) NOT NULL,
  method TEXT,
  note TEXT,
  at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookTransaction_business_at" ON "BookTransaction"("businessId", at);
CREATE UNIQUE INDEX IF NOT EXISTS "BookTransaction_appointment" ON "BookTransaction"("appointmentId") WHERE "appointmentId" IS NOT NULL AND kind = 'INCOME';

-- What people do with a listing (page opened, call, route, booking started / made, share). Numbers
-- only: a hashed viewer id, never a name or a health fact. Feeds the owner's analytics funnel.
CREATE TABLE IF NOT EXISTS "BookEvent" (
  id BIGSERIAL PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  "viewerHash" TEXT,
  at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookEvent_business_at" ON "BookEvent"("businessId", at);
