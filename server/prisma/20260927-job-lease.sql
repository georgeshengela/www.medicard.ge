-- Background-job leader lease (audit 2026-09-27). Additive only: one new table.
-- In-process jobs (price-drop push, referral rewards, pharmacy sync) run only on the instance that
-- holds the lease, so a second instance or an overlapping deploy never sends a push twice.
CREATE TABLE IF NOT EXISTS "JobLease" (
  name TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
