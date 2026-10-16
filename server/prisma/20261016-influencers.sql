-- Influencer referral program (owner 2026-10-16): medicard.ge/promo accounts, their codes, the registrations they
-- bring, an append-only money ledger (tetri, integer) and payout requests. Additive only: new tables, no change to
-- existing rows. Influencer accounts are separate from consumer health accounts — no health data lives here.

CREATE TABLE IF NOT EXISTS "Influencer" (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  phone TEXT NOT NULL,
  socials JSONB NOT NULL DEFAULT '{}'::jsonb,
  "photoKey" TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED')),
  "statusReason" TEXT,
  "adminNote" TEXT,
  lang TEXT NOT NULL DEFAULT 'ka',
  "termsVersion" TEXT,
  "termsAcceptedAt" TIMESTAMPTZ(6),
  "approvedAt" TIMESTAMPTZ(6),
  "lastLoginAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "Influencer_email_key" ON "Influencer"(email);
CREATE INDEX IF NOT EXISTS "Influencer_status_time" ON "Influencer"(status, "createdAt" DESC);

-- Opaque session tokens for the portal (httpOnly cookie); only the sha256 is stored.
CREATE TABLE IF NOT EXISTS "InfluencerSession" (
  id TEXT PRIMARY KEY,
  "influencerId" TEXT NOT NULL REFERENCES "Influencer"(id) ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "InfluencerSession_token" ON "InfluencerSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "InfluencerSession_owner" ON "InfluencerSession"("influencerId");

-- Password reset codes for the portal (6 digits, hashed, 15 minutes, 5 tries).
CREATE TABLE IF NOT EXISTS "InfluencerPasswordReset" (
  id TEXT PRIMARY KEY,
  "influencerId" TEXT NOT NULL REFERENCES "Influencer"(id) ON DELETE CASCADE,
  "codeHash" TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "usedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "InfluencerPasswordReset_owner" ON "InfluencerPasswordReset"("influencerId", "createdAt" DESC);

-- Every code an influencer ever had keeps working and stays taken (followers keep old posts).
-- kind AUTO = given at sign-up, CUSTOM = chosen by the influencer. "primary" = the one the portal shows.
CREATE TABLE IF NOT EXISTS "InfluencerCode" (
  code TEXT PRIMARY KEY,
  "influencerId" TEXT NOT NULL REFERENCES "Influencer"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('AUTO', 'CUSTOM')),
  "primary" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "InfluencerCode_owner" ON "InfluencerCode"("influencerId", "createdAt");

-- One row per consumer account that entered an influencer code. The account is linked with ON DELETE SET NULL:
-- a deletion inside the hold reverses the registration, a deletion after it keeps the earned amount.
-- PENDING (hold) → CREDITED (amount in the ledger) | REVERSED (account gone / admin) | REJECTED (rules / admin).
-- FLAGGED = held for an admin decision (burst from one network).
CREATE TABLE IF NOT EXISTS "InfluencerReferral" (
  id TEXT PRIMARY KEY,
  "influencerId" TEXT NOT NULL REFERENCES "Influencer"(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  "userId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "userRef" TEXT NOT NULL,
  "userCreatedAt" TIMESTAMPTZ(6),
  "deviceHash" TEXT,
  "networkHash" TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'FLAGGED', 'CREDITED', 'REVERSED', 'REJECTED')),
  reason TEXT,
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  seq INTEGER,
  amount INTEGER,
  "holdUntil" TIMESTAMPTZ(6) NOT NULL,
  "creditedAt" TIMESTAMPTZ(6),
  "decidedAt" TIMESTAMPTZ(6),
  "decidedBy" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "InfluencerReferral_user" ON "InfluencerReferral"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "InfluencerReferral_device" ON "InfluencerReferral"("deviceHash");
CREATE INDEX IF NOT EXISTS "InfluencerReferral_owner_time" ON "InfluencerReferral"("influencerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "InfluencerReferral_status_hold" ON "InfluencerReferral"(status, "holdUntil");
CREATE INDEX IF NOT EXISTS "InfluencerReferral_network" ON "InfluencerReferral"("influencerId", "networkHash", "createdAt");

-- Append-only money ledger in tetri. Balance = SUM(amount). CREDIT +, REVERSAL −, PAYOUT − (at request time),
-- RELEASE + (a rejected payout comes back), ADJUST ± (admin, with a note). One row per event and reference.
CREATE TABLE IF NOT EXISTS "InfluencerLedger" (
  id TEXT PRIMARY KEY,
  "influencerId" TEXT NOT NULL REFERENCES "Influencer"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('CREDIT', 'REVERSAL', 'PAYOUT', 'RELEASE', 'ADJUST')),
  amount INTEGER NOT NULL,
  "refId" TEXT NOT NULL,
  note TEXT,
  "adminEmail" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "InfluencerLedger_event" ON "InfluencerLedger"(kind, "refId");
CREATE INDEX IF NOT EXISTS "InfluencerLedger_owner_time" ON "InfluencerLedger"("influencerId", "createdAt" DESC);

-- Payout requests. The amount leaves the balance when requested (ledger PAYOUT) and comes back only on REJECTED
-- (ledger RELEASE). At most one open request (REQUESTED / APPROVED) per influencer. details = bank account as
-- entered (IBAN, holder, personal number) — admin-only, never in a list response.
CREATE TABLE IF NOT EXISTS "InfluencerPayout" (
  id TEXT PRIMARY KEY,
  "influencerId" TEXT NOT NULL REFERENCES "Influencer"(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED')),
  details JSONB NOT NULL,
  reference TEXT,
  "rejectReason" TEXT,
  "decidedBy" TEXT,
  "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "approvedAt" TIMESTAMPTZ(6),
  "paidAt" TIMESTAMPTZ(6),
  "rejectedAt" TIMESTAMPTZ(6)
);
CREATE UNIQUE INDEX IF NOT EXISTS "InfluencerPayout_open" ON "InfluencerPayout"("influencerId") WHERE status IN ('REQUESTED', 'APPROVED');
CREATE INDEX IF NOT EXISTS "InfluencerPayout_status_time" ON "InfluencerPayout"(status, "requestedAt");
CREATE INDEX IF NOT EXISTS "InfluencerPayout_owner_time" ON "InfluencerPayout"("influencerId", "requestedAt" DESC);

-- Program settings (one row): tier ladder, hold, entry window, minimum payout, burst flag, invitee coins, sign-up.
CREATE TABLE IF NOT EXISTS "InfluencerConfig" (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedBy" TEXT
);
