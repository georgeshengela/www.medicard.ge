-- MEDI COACH: verified fitness trainers, Georgian gym directory, consented trainer↔client links,
-- sessions, trainer meal plans and progress photos (2026-09-28). Additive only: new tables, no change
-- to existing rows. See docs/TRAINER.md.

-- Gym directory (brands → branches). Seeded from server/src/data/gyms-ge.json; admins add/hide rows,
-- trainers can propose a missing gym (status PROPOSED until an admin approves it).
CREATE TABLE IF NOT EXISTS "Gym" (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  "brandKa" TEXT,
  name TEXT NOT NULL,
  "nameKa" TEXT,
  city TEXT NOT NULL,
  district TEXT,
  address TEXT,
  website TEXT,
  instagram TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'HIDDEN', 'PROPOSED')),
  "proposedBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Gym_status_brand" ON "Gym"(status, brand, city);

-- One trainer profile per person. Only VERIFIED trainers are searchable and can link clients.
CREATE TABLE IF NOT EXISTS "TrainerProfile" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
  "displayName" TEXT NOT NULL,
  bio TEXT,
  specialties JSONB NOT NULL DEFAULT '[]',
  "experienceYears" INTEGER,
  instagram TEXT,
  certificates JSONB NOT NULL DEFAULT '[]',
  "gymIds" JSONB NOT NULL DEFAULT '[]',
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED')),
  "reviewNote" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMPTZ(3),
  "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TrainerProfile_code" ON "TrainerProfile"(code);
CREATE INDEX IF NOT EXISTS "TrainerProfile_status" ON "TrainerProfile"(status, "submittedAt");

-- Trainer ↔ client. The client grants named scopes; revoking ends the link immediately.
-- A client has at most one ACTIVE or pending link at a time.
CREATE TABLE IF NOT EXISTS "TrainerLink" (
  id TEXT PRIMARY KEY,
  "trainerId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "clientId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('REQUESTED', 'ACTIVE', 'ENDED', 'DECLINED')),
  scopes JSONB NOT NULL DEFAULT '{}',
  "consentVersion" TEXT,
  "proposedGoal" JSONB,
  "clientNote" TEXT,
  "endedBy" TEXT,
  "trainerViewedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMPTZ(3),
  "endedAt" TIMESTAMPTZ(3),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TrainerLink_client_open" ON "TrainerLink"("clientId") WHERE status IN ('REQUESTED', 'ACTIVE');
CREATE INDEX IF NOT EXISTS "TrainerLink_trainer" ON "TrainerLink"("trainerId", status);

-- A booked session (clientId set) or an open slot (clientId null, status OPEN).
CREATE TABLE IF NOT EXISTS "TrainerSession" (
  id TEXT PRIMARY KEY,
  "trainerId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "clientId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "gymId" TEXT,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "durationMin" INTEGER NOT NULL DEFAULT 60,
  kind TEXT NOT NULL DEFAULT 'STRENGTH',
  note TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('OPEN', 'SCHEDULED', 'CANCELLED', 'DONE', 'NO_SHOW')),
  "seriesId" TEXT,
  "clientConfirmedAt" TIMESTAMPTZ(3),
  "cancelledBy" TEXT,
  "cancelReason" TEXT,
  "lateCancel" BOOLEAN NOT NULL DEFAULT FALSE,
  exercises JSONB NOT NULL DEFAULT '[]',
  "trainerNote" TEXT,
  "clientRating" INTEGER,
  "reminded24" BOOLEAN NOT NULL DEFAULT FALSE,
  "reminded1" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TrainerSession_trainer_time" ON "TrainerSession"("trainerId", "startsAt");
CREATE INDEX IF NOT EXISTS "TrainerSession_client_time" ON "TrainerSession"("clientId", "startsAt");
CREATE INDEX IF NOT EXISTS "TrainerSession_reminders" ON "TrainerSession"(status, "startsAt");

-- A trainer's meal plan for one client. One active plan per link; adherence is computed from the
-- client's own nutrition diary against these targets (the client's program is never overwritten).
CREATE TABLE IF NOT EXISTS "TrainerMealPlan" (
  id TEXT PRIMARY KEY,
  "trainerId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "clientId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  targets JSONB NOT NULL,
  meals JSONB NOT NULL DEFAULT '[]',
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "startsOn" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TrainerMealPlan_client" ON "TrainerMealPlan"("clientId", active, "updatedAt" DESC);

-- Progress photos belong to the person (not to the trainer); private storage key, never public.
CREATE TABLE IF NOT EXISTS "ProgressPhoto" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "takenOn" TEXT NOT NULL,
  pose TEXT NOT NULL CHECK (pose IN ('FRONT', 'SIDE', 'BACK', 'OTHER')),
  "fileKey" TEXT NOT NULL,
  "weightKg" DOUBLE PRECISION,
  note TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ProgressPhoto_user_time" ON "ProgressPhoto"("userId", "takenOn" DESC);

-- Workouts read from Apple Health / Health Connect (summary only: type, time, duration, energy,
-- average heart rate, distance). Synced by the app only while a trainer link shares workouts.
CREATE TABLE IF NOT EXISTS "WorkoutLog" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "externalId" TEXT NOT NULL,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  "startedAt" TIMESTAMPTZ(3) NOT NULL,
  "endedAt" TIMESTAMPTZ(3) NOT NULL,
  "durationMin" INTEGER NOT NULL,
  kcal INTEGER,
  "avgHeartRate" INTEGER,
  "distanceKm" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutLog_external" ON "WorkoutLog"("userId", "externalId");
CREATE INDEX IF NOT EXISTS "WorkoutLog_user_time" ON "WorkoutLog"("userId", "startedAt" DESC);
