-- Additive QA workspace; no clinical records or production users are modified.
BEGIN;
CREATE TABLE IF NOT EXISTS "QaRun" (
 "id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "module" TEXT NOT NULL, "version" TEXT NOT NULL,
 "environment" TEXT NOT NULL, "device" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN',
 "notes" TEXT NOT NULL DEFAULT '', "createdBy" TEXT NOT NULL, "revision" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE IF NOT EXISTS "QaCheck" (
 "id" TEXT PRIMARY KEY, "runId" TEXT NOT NULL REFERENCES "QaRun"("id") ON DELETE CASCADE,
 "caseKey" TEXT NOT NULL, "title" TEXT NOT NULL, "stage" TEXT NOT NULL, "steps" TEXT NOT NULL,
 "expected" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "actual" TEXT NOT NULL DEFAULT '',
 "method" TEXT NOT NULL DEFAULT 'MANUAL', "revision" INTEGER NOT NULL DEFAULT 0, "updatedBy" TEXT,
 "updatedAt" TIMESTAMP(3) NOT NULL, UNIQUE ("runId", "caseKey")
);
CREATE TABLE IF NOT EXISTS "QaEvidence" (
 "id" TEXT PRIMARY KEY, "checkId" TEXT NOT NULL REFERENCES "QaCheck"("id") ON DELETE CASCADE,
 "caption" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sha256" TEXT NOT NULL, "bytes" BYTEA NOT NULL,
 "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "QaRun_module_createdAt_idx" ON "QaRun"("module","createdAt");
CREATE INDEX IF NOT EXISTS "QaEvidence_checkId_createdAt_idx" ON "QaEvidence"("checkId","createdAt");
COMMIT;
