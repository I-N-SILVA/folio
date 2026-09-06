#!/usr/bin/env bash
#
# The launch runbook's "dry-run one real licence" step, minus AppSumo's servers.
#
# Stands up PostgreSQL + PostgREST + a Supabase-shaped gateway, applies the
# consolidated migration, then runs the real `applyAppSumoEvent` and
# `redeemLicense` against it: activate → redeem → a second account refused →
# stack a code → reduce → refund → the code is dead.
#
# `lib/appsumo.test.ts` asserts against a mock of the Supabase client, which
# cannot catch a filter PostgREST parses differently, a column that is not
# there, or an RLS policy that refuses the write. This can.
#
#   npm run verify:appsumo:e2e
#
# Needs a local PostgreSQL (`service postgresql start`) and the PostgREST binary
# on PATH or at ./postgrest — see scripts/README-e2e.md.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${DB:-qlico_e2e}"
PGRST_PORT="${PGRST_PORT:-5598}"
GATEWAY_PORT="${GATEWAY_PORT:-5599}"
POSTGREST_BIN="${POSTGREST_BIN:-$(command -v postgrest || echo ./postgrest)}"
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters"

if [[ ! -x "$POSTGREST_BIN" ]]; then
  echo "PostgREST not found. Set POSTGREST_BIN, or:"
  echo "  curl -sSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar xJ"
  exit 2
fi

cleanup() { kill "${PGRST_PID:-}" "${GW_PID:-}" 2>/dev/null || true; }
trap cleanup EXIT

echo "==> database"
su postgres -c "dropdb --if-exists $DB" >/dev/null 2>&1 || true
su postgres -c "createdb $DB"
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f $ROOT/scripts/supabase-shim.sql" >/dev/null
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f $ROOT/supabase/master_migration.sql" >/dev/null
su postgres -c "psql -tAc \"ALTER ROLE postgres WITH PASSWORD 'postgres'\"" >/dev/null

echo "==> two users, as Supabase Auth would create them"
# `head -1` because psql prints the "INSERT 0 1" command tag after the value.
BUYER=$(su postgres -c "psql -tAq -d $DB -c \"INSERT INTO auth.users (email) VALUES ('buyer@example.com') RETURNING id\"" | head -1 | tr -d '[:space:]')
OTHER=$(su postgres -c "psql -tAq -d $DB -c \"INSERT INTO auth.users (email) VALUES ('other@example.com') RETURNING id\"" | head -1 | tr -d '[:space:]')

echo "==> PostgREST"
PGRST_DB_URI="postgres://postgres:postgres@127.0.0.1:5432/$DB" \
PGRST_DB_SCHEMAS="public" PGRST_DB_ANON_ROLE="anon" \
PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT="$PGRST_PORT" \
  "$POSTGREST_BIN" >/tmp/pgrst-e2e.log 2>&1 &
PGRST_PID=$!

echo "==> Supabase gateway"
SUPABASE_JWT_SECRET="$JWT_SECRET" \
  node "$ROOT/scripts/supabase-gateway.mjs" --port "$GATEWAY_PORT" --postgrest "http://127.0.0.1:$PGRST_PORT" \
  >/tmp/gateway-e2e.log 2>&1 &
GW_PID=$!

until curl -s --noproxy '*' "http://127.0.0.1:$GATEWAY_PORT/rest/v1/" >/dev/null 2>&1; do sleep 1; done

KEYS=$(SUPABASE_JWT_SECRET="$JWT_SECRET" node "$ROOT/scripts/supabase-gateway.mjs" --print-keys)
ANON=$(echo "$KEYS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["anon"])')
SRV=$(echo "$KEYS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["service_role"])')

echo "==> the licence lifecycle"
CI=1 \
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$GATEWAY_PORT" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" \
SUPABASE_SERVICE_ROLE_KEY="$SRV" \
E2E_BUYER_ID="$BUYER" E2E_OTHER_ID="$OTHER" \
  npx vitest run "$ROOT/scripts/live-postgrest.test.ts"
