#!/usr/bin/env bash
#
# Run supabase/master_migration.sql against a real PostgreSQL and check what it
# built.
#
# That file is what every launch document tells an operator to paste into the
# Supabase SQL editor, and it had never been executed anywhere — it is generated
# by concatenation and its idempotency guards were added with a regex. A syntax
# error in it is discovered at 2am on launch night.
#
# So: apply it to a scratch database, apply it again to prove it is re-runnable,
# then exercise the schema through the paths the app actually uses and confirm
# it accepts every value the app can produce and still refuses the rest. The two
# constraint bugs in this repo's history are exactly what this catches — a
# Postgres enum a value or two behind the TypeScript one, invisible to
# typecheck, lint and every unit test.
#
#   npm run verify:migration
#
# Uses libpq environment variables when they are set (PGHOST/PGUSER/PGPASSWORD),
# which is how it runs in CI against a service container. With none set it falls
# back to a local socket as the `postgres` superuser, which is how it runs on a
# machine with `service postgresql start`. It touches only its own scratch
# database and drops it first.

set -euo pipefail

DB="${PGDATABASE_SCRATCH:-qlico_migration_check}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -n "${PGHOST:-}" ]]; then
  # CI: connect over TCP as whoever PGUSER says.
  run() { eval "$*"; }
  PSQL_BASE="psql -v ON_ERROR_STOP=1 -q"
else
  # Local: a peer-authenticated socket needs to be the postgres role.
  run() { su postgres -c "$*"; }
  PSQL_BASE="psql -v ON_ERROR_STOP=1 -q"
fi

PSQL="$PSQL_BASE -d $DB"

echo "==> scratch database: $DB"
run "dropdb --if-exists $DB" >/dev/null 2>&1 || true
run "createdb $DB"

echo "==> Supabase shim (auth schema, roles, auth.uid())"
run "$PSQL -f $ROOT/scripts/supabase-shim.sql" >/dev/null

echo "==> apply master_migration.sql"
run "$PSQL -f $ROOT/supabase/master_migration.sql" >/dev/null

echo "==> apply it again (must be a no-op, not an error)"
run "$PSQL -f $ROOT/supabase/master_migration.sql" >/dev/null

echo "==> exercise the schema through the paths the app uses"
run "$PSQL -f $ROOT/scripts/verify-migration.sql"

echo
echo "OK — the consolidated migration runs, re-runs, and accepts every value."
