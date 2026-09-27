-- Price-drop alerts (Phase 3.2, 2026-09-27). Additive only: two new tables, no change to existing rows.

-- Best-price history per catalog product, one row per change.
CREATE TABLE IF NOT EXISTS "CatalogPriceHistory" (
  id TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL REFERENCES "CatalogProduct"(id) ON DELETE CASCADE,
  "bestPriceGel" DOUBLE PRECISION NOT NULL,
  "sourceId" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CatalogPriceHistory_product_time" ON "CatalogPriceHistory"("productId", "recordedAt" DESC);

-- Outbox of price-drop alerts: queued when a price falls, sent in daytime, at most one per person per day.
CREATE TABLE IF NOT EXISTS "PriceDropAlert" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "CatalogProduct"(id) ON DELETE CASCADE,
  "medName" TEXT NOT NULL,
  "fromGel" DOUBLE PRECISION NOT NULL,
  "toGel" DOUBLE PRECISION NOT NULL,
  "sourceId" TEXT,
  state TEXT NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING', 'SENT', 'SKIPPED', 'FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "PriceDropAlert_state" ON "PriceDropAlert"(state, "createdAt");
CREATE INDEX IF NOT EXISTS "PriceDropAlert_user_sent" ON "PriceDropAlert"("userId", "sentAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PriceDropAlert_user_product_price" ON "PriceDropAlert"("userId", "productId", "toGel");
