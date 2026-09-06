-- Medi Quest Phase 2: server-side hydration goal. Additive.

CREATE TABLE IF NOT EXISTS "HydrationPreference" (
  "userId" TEXT NOT NULL,
  "goalMl" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HydrationPreference_pkey" PRIMARY KEY ("userId")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HydrationPreference_userId_fkey'
  ) THEN
    ALTER TABLE "HydrationPreference"
      ADD CONSTRAINT "HydrationPreference_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
