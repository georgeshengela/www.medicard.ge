-- Extra tables so the isolated owner-pilot API can register/login and serve admin.
-- Never apply this to hosted Neon. Phase 5 tests do not use this file.

CREATE TABLE IF NOT EXISTS "Package" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "nameKa" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "descriptionKa" TEXT NOT NULL,
  "monthlyAiLimit" INTEGER NOT NULL DEFAULT 90,
  "dailyAiLimit" INTEGER NOT NULL DEFAULT 3,
  "priceGel" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "features" JSONB NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Package_code_key" ON "Package"("code");

CREATE TABLE IF NOT EXISTS "AppSettings" (
  "id" TEXT NOT NULL,
  "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
  "maintenanceMessage" TEXT NOT NULL DEFAULT 'აპლიკაცია დროებით განახლების რეჟიმშია. გთხოვთ, სცადოთ მოგვიანებით.',
  "minAppVersion" TEXT NOT NULL DEFAULT '1.0.0',
  "forceUpdate" BOOLEAN NOT NULL DEFAULT false,
  "allowRegistrations" BOOLEAN NOT NULL DEFAULT true,
  "supportEmail" TEXT NOT NULL DEFAULT 'support@medicard.ge',
  "qaOtpEnabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AppSettings" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "PhoneVerification" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'AUTH',
  "userId" TEXT,
  "reference" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PhoneVerification_phone_idx" ON "PhoneVerification"("phone");
CREATE INDEX IF NOT EXISTS "PhoneVerification_userId_idx" ON "PhoneVerification"("userId");
CREATE INDEX IF NOT EXISTS "PhoneVerification_expiresAt_idx" ON "PhoneVerification"("expiresAt");
CREATE INDEX IF NOT EXISTS "PhoneVerification_reference_idx" ON "PhoneVerification"("reference");

CREATE TABLE IF NOT EXISTS "SmsLog" (
  "id" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "sender" TEXT NOT NULL DEFAULT 'MEDICARD',
  "purpose" TEXT NOT NULL DEFAULT 'OTP',
  "reference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "providerCode" INTEGER,
  "providerMsg" TEXT,
  "userId" TEXT,
  "adminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PasswordReset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PasswordReset_email_idx" ON "PasswordReset"("email");
CREATE INDEX IF NOT EXISTS "PasswordReset_userId_idx" ON "PasswordReset"("userId");
CREATE INDEX IF NOT EXISTS "PasswordReset_expiresAt_idx" ON "PasswordReset"("expiresAt");

CREATE TABLE IF NOT EXISTS "PeriodUsage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "reservedAt" TIMESTAMP(3),
  "resetAt" TIMESTAMP(3),
  "notifyAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PeriodUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PeriodUsage_userId_periodKey_key" ON "PeriodUsage"("userId", "periodKey");
ALTER TABLE "PeriodUsage" ADD COLUMN IF NOT EXISTS "resetAt" TIMESTAMP(3);
