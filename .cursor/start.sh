#!/usr/bin/env bash
#
# Cloud Agent start script for Medicard.GE.
#
# Per-boot reconciliation: brings the local PostgreSQL up from its persisted
# data directory and waits until it accepts connections, then returns so the
# API and Expo web terminals can start. Idempotent and safe to re-run.
set -euo pipefail

PGDATA="${MEDICARD_PGDATA:-$HOME/.medicard/pgdata}"
PGPORT="${MEDICARD_PGPORT:-5432}"

PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
if [ -z "$PGBIN" ]; then
  echo "[start] PostgreSQL is not installed — run .cursor/install.sh first" >&2
  exit 1
fi
export PATH="$PGBIN:$PATH"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[start] PostgreSQL data dir missing at $PGDATA — run .cursor/install.sh first" >&2
  exit 1
fi

if pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  echo "[start] PostgreSQL already running"
else
  rm -f "$PGDATA/postmaster.pid"
  echo "[start] Starting PostgreSQL"
  pg_ctl -D "$PGDATA" -o "-p $PGPORT" -w -l "$PGDATA/postgres.log" start
fi

for _ in $(seq 1 30); do
  pg_isready -h 127.0.0.1 -p "$PGPORT" -q && break
  sleep 1
done
pg_isready -h 127.0.0.1 -p "$PGPORT"
echo "[start] PostgreSQL ready on 127.0.0.1:$PGPORT"
