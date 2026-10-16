-- MEDIBOOK wave 5 (2026-10-16): the client card — personal fields, a segment card (JSON: anamnesis, allergies,
-- tooth chart, skin type…), dated notes with an author (plain notes, hair colour formulas, injection log),
-- private photos and documents (before/after, X-rays, consents). Additive only; installed by
-- server/scripts/install-medibook-5.mjs (in the root db:install); every statement may be re-run.

ALTER TABLE "BookClient" ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE "BookClient" ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE "BookClient" ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE "BookClient" ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE "BookClient" ADD COLUMN IF NOT EXISTS "preferredStaffId" TEXT;
ALTER TABLE "BookClient" ADD COLUMN IF NOT EXISTS card JSONB NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS "BookClient_business_birthday" ON "BookClient"("businessId", birthday);

-- A picture that only the business's members may see (client photos, X-rays, consents): the public image route refuses it.
ALTER TABLE "BookImage" ADD COLUMN IF NOT EXISTS private BOOLEAN NOT NULL DEFAULT FALSE;

-- Dated entries on the card: NOTE (text), FORMULA (hair colour: brand, shade, developer, minutes, zones),
-- INJECTION (product, units, lot, zone), TREATMENT (a step of a plan). `data` holds the structured part.
CREATE TABLE IF NOT EXISTS "BookClientNote" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "clientId" TEXT NOT NULL REFERENCES "BookClient"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'NOTE',
  text TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  "appointmentId" TEXT REFERENCES "BookAppointment"(id) ON DELETE SET NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookClientNote_client" ON "BookClientNote"("clientId", "createdAt");

-- Photos and documents on the card, each a private BookImage.
CREATE TABLE IF NOT EXISTS "BookClientFile" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "clientId" TEXT NOT NULL REFERENCES "BookClient"(id) ON DELETE CASCADE,
  "imageId" TEXT NOT NULL REFERENCES "BookImage"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'PHOTO',
  caption TEXT,
  "appointmentId" TEXT REFERENCES "BookAppointment"(id) ON DELETE SET NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BookClientFile_client" ON "BookClientFile"("clientId", "createdAt");
