#!/usr/bin/env bash
# Run the database migrations and pgTAP tests against a local PostgreSQL (no Docker needed).
# Requires: PostgreSQL 16+ server, pgTAP and pg_prove (e.g. apt install postgresql-16-pgtap
# libtap-parser-sourcehandler-pgtap-perl). CI runs the same tests on the real Supabase stack
# with `supabase test db`.
set -euo pipefail

cd "$(dirname "$0")/.."
DB="${GRECO_TEST_DB:-greco_test}"
PG_VERSION="${PG_VERSION:-16}"

as_postgres() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}

if command -v pg_ctlcluster >/dev/null 2>&1; then
  pg_ctlcluster "$PG_VERSION" main start >/dev/null 2>&1 || true
fi

as_postgres dropdb --if-exists "$DB"
as_postgres createdb "$DB"
as_postgres psql -q -v ON_ERROR_STOP=1 -d "$DB" -c "alter database \"$DB\" set search_path = \"\$user\", public, extensions"

PSQL=(as_postgres psql -q -v ON_ERROR_STOP=1 -d "$DB")
"${PSQL[@]}" -f scripts/db/supabase-stubs.sql
for migration in supabase/migrations/*.sql; do
  echo "migrate: $(basename "$migration")"
  "${PSQL[@]}" --single-transaction -f "$migration"
done
"${PSQL[@]}" -f supabase/seed.sql

as_postgres pg_prove -d "$DB" --ext .sql -r supabase/tests
