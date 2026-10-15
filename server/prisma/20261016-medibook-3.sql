-- MEDIBOOK wave 3 (2026-10-16): the stock room — supplies a visit uses up (gloves, napkins, colour, anaesthetic),
-- norms per service (what one visit uses), automatic write-off when a visit is completed, deliveries, write-offs,
-- counts. Additive only: new columns with defaults, one widened CHECK, one new table. Installed by
-- server/scripts/install-medibook-3.mjs (in the root db:install); every statement may be re-run.

-- A product is either sold over the counter (RETAIL) or used up by visits (SUPPLY). Supplies have no price.
ALTER TABLE "BookProduct" ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'RETAIL';
CREATE INDEX IF NOT EXISTS "BookProduct_kind" ON "BookProduct"("businessId", kind, active);

-- A stock move learns why it happened (a visit, a manual write-off, a count) and the unit cost of the day, so the
-- ledger explains every number and consumption can be priced.
ALTER TABLE "BookStockMove" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT REFERENCES "BookAppointment"(id) ON DELETE SET NULL;
ALTER TABLE "BookStockMove" ADD COLUMN IF NOT EXISTS "serviceId" TEXT;
ALTER TABLE "BookStockMove" ADD COLUMN IF NOT EXISTS "staffId" TEXT;
ALTER TABLE "BookStockMove" ADD COLUMN IF NOT EXISTS cost NUMERIC(12,2);
ALTER TABLE "BookStockMove" DROP CONSTRAINT IF EXISTS "BookStockMove_reason_check";
ALTER TABLE "BookStockMove" ADD CONSTRAINT "BookStockMove_reason_check" CHECK (reason IN ('SALE', 'REFUND', 'RESTOCK', 'ADJUST', 'USE', 'WRITE_OFF', 'COUNT'));
CREATE INDEX IF NOT EXISTS "BookStockMove_business_at" ON "BookStockMove"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "BookStockMove_appointment" ON "BookStockMove"("appointmentId") WHERE "appointmentId" IS NOT NULL;

-- Norms: what one visit of a service uses, per supply.
CREATE TABLE IF NOT EXISTS "BookServiceSupply" (
  id TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "BookBusiness"(id) ON DELETE CASCADE,
  "serviceId" TEXT NOT NULL REFERENCES "BookService"(id) ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "BookProduct"(id) ON DELETE CASCADE,
  qty NUMERIC(12,2) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookServiceSupply_service_product" ON "BookServiceSupply"("serviceId", "productId");
CREATE INDEX IF NOT EXISTS "BookServiceSupply_product" ON "BookServiceSupply"("productId");
