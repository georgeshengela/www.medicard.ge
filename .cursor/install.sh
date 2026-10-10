#!/usr/bin/env bash
#
# Cloud Agent install script for Medicard.GE.
#
# Idempotent repository bootstrap: installs a local PostgreSQL, provisions a
# throwaway dev database, installs both npm workspaces, generates the Prisma
# client, pushes the schema and seeds reference data. Safe to re-run.
#
# The production app runs against Neon serverless PostgreSQL. For local Cloud
# Agent development we stand up a self-contained PostgreSQL under $HOME so no
# external DATABASE_URL secret is required. Real AI provider keys (EvidenceMD,
# OpenRouter, ...) are optional and, when supplied as environment secrets, take
# precedence over the placeholders written to server/.env.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PGDATA="${MEDICARD_PGDATA:-$HOME/.medicard/pgdata}"
PGPORT="${MEDICARD_PGPORT:-5432}"
DB_USER="${MEDICARD_DB_USER:-medicard}"
DB_NAME="${MEDICARD_DB_NAME:-medicard}"

log() { printf '\n[install] %s\n' "$*"; }

# 1. Ensure PostgreSQL server binaries exist (installed once, baked into the build snapshot).
if ! ls /usr/lib/postgresql/*/bin/initdb >/dev/null 2>&1; then
  log "Installing PostgreSQL"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
export PATH="$PGBIN:$PATH"

# 2. Initialise the cluster once (data dir persists across boots / into the snapshot).
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  log "Initialising PostgreSQL cluster at $PGDATA"
  mkdir -p "$PGDATA"
  initdb -D "$PGDATA" -U "$DB_USER" --auth=trust --auth-host=trust --auth-local=trust >/dev/null
  {
    echo "listen_addresses = '127.0.0.1'"
    echo "port = $PGPORT"
    echo "unix_socket_directories = '/tmp'"
  } >> "$PGDATA/postgresql.conf"
fi

# 3. Start PostgreSQL just for provisioning, then stop it again at the end.
if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  rm -f "$PGDATA/postmaster.pid"
  log "Starting PostgreSQL for provisioning"
  pg_ctl -D "$PGDATA" -o "-p $PGPORT" -w -l "$PGDATA/postgres.log" start
fi
for _ in $(seq 1 30); do pg_isready -h 127.0.0.1 -p "$PGPORT" -q && break; sleep 1; done

# 4. Create the application database if it does not already exist.
if ! psql -h 127.0.0.1 -p "$PGPORT" -U "$DB_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  log "Creating database $DB_NAME"
  createdb -h 127.0.0.1 -p "$PGPORT" -U "$DB_USER" "$DB_NAME"
fi

# 5. Write dev env files only if absent (never clobber user edits or injected secrets).
if [ ! -f server/.env ]; then
  log "Writing server/.env (local dev defaults)"
  JWT_SECRET_VALUE="$(openssl rand -hex 24 2>/dev/null || echo 'dev-jwt-secret-change-me-0123456789')"
  cat > server/.env <<EOF
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://$DB_USER@127.0.0.1:$PGPORT/$DB_NAME?schema=public
JWT_SECRET=$JWT_SECRET_VALUE
JWT_EXPIRES_IN=30d

# Placeholder — lets the API boot. Set a real EVIDENCEMD_API_KEY (and optional
# OPENROUTER_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY) as environment secrets
# to exercise the AI modules; injected env vars override these placeholders.
EVIDENCEMD_API_KEY=dev-placeholder-key

# QA master OTP: 0000 verifies phone SMS locally (no SMS gateway needed).
QA_OTP_CODE=0000
EOF
fi
if [ ! -f mobile/.env ]; then
  log "Writing mobile/.env (points the web client at the local API)"
  echo "EXPO_PUBLIC_API_URL=http://localhost:4000" > mobile/.env
fi

# 6. Install workspaces and generate the Prisma client.
log "Installing npm workspaces (server + mobile)"
npm run install:all
log "Generating Prisma client"
npm --prefix server run prisma:generate

# 7. Apply the schema and seed reference data (idempotent upserts).
log "Pushing Prisma schema"
npm --prefix server run prisma:push
log "Seeding reference data"
npm --prefix server run seed

# 8. Stop the provisioning PostgreSQL; start.sh brings it up on each boot.
log "Stopping provisioning PostgreSQL (start.sh runs it per boot)"
pg_ctl -D "$PGDATA" -m fast stop || true

log "Install complete"
