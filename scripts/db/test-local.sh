#!/usr/bin/env bash
# Runs the migrations and the pgTAP tests on a throw-away local PostgreSQL
# cluster (no Docker needed). Requires initdb/pg_ctl/psql on PATH.
#
#   npm run db:test:local
#
# With Docker + Supabase CLI prefer the official runner: `npm run db:test`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/sentinel-pg.XXXXXX")"
PORT="${PGTEST_PORT:-54399}"
export PGHOST="$WORK" PGPORT="$PORT" PGDATABASE=postgres

cleanup() { pg_ctl -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

initdb -D "$WORK/data" -A trust -U postgres --no-locale -E UTF8 >/dev/null
pg_ctl -D "$WORK/data" -o "-k $WORK -p $PORT -c listen_addresses=''" -l "$WORK/pg.log" -w start >/dev/null
export PGUSER=postgres

PSQL=(psql -X -q -v ON_ERROR_STOP=1 --no-psqlrc)

"${PSQL[@]}" -c 'alter database postgres set search_path = "$user", public, extensions'
"${PSQL[@]}" -f "$ROOT/scripts/db/supabase-shim.sql"
"${PSQL[@]}" -f "$ROOT/scripts/db/storage-shim.sql"
"${PSQL[@]}" -f "$ROOT/scripts/db/pgtap-lite.sql"

echo "▸ Applying migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "  $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "▸ Running tests"
status=0
for f in "$ROOT"/supabase/tests/*.sql; do
  name="$(basename "$f")"
  # The real pgTAP extension is not installed locally (pgtap-lite is preloaded).
  out="$(grep -v -i 'create extension if not exists pgtap' "$f" | psql -X --no-psqlrc -q -t -A -v ON_ERROR_STOP=1 2>&1)" || { echo "✖ $name"; echo "$out"; status=1; continue; }
  if grep -qE '^(not ok|# Looks like)' <<<"$out"; then
    echo "✖ $name"; grep -E '^(not ok|#)' <<<"$out"; status=1
  else
    echo "✔ $name ($(grep -c '^ok' <<<"$out") assertions)"
  fi
done
exit $status
