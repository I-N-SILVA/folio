#!/usr/bin/env bash
#
# Measure the UX in a real browser, signed-in studio included.
#
#   npm run measure:ux
#
# The studio is behind a login and a database, which is why it had never been
# looked at in a browser by anything automated. This stands up just enough of
# Supabase to render it — scripts/supabase-gateway.mjs for auth, in front of
# scripts/studio-mock-rest.mjs for data (the bundled demo editions, owned by
# one test author) — builds the app against them, signs in, and runs
# scripts/measure-ux.mjs: reader layout and clipping, editor fit and toolbars,
# rendered text contrast, the try-it preview and the pricing buttons, at
# phone, tablet and laptop sizes. Exits non-zero if any check fails.
#
# Needs Chromium + Playwright (preinstalled in the dev container). No PostgREST,
# no PostgreSQL, no network.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOCK_PORT="${MOCK_PORT:-5701}"
GATEWAY_PORT="${GATEWAY_PORT:-5702}"
APP_PORT="${APP_PORT:-5703}"
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters"
USER_ID="11111111-1111-4111-8111-111111111111"

PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

# A server left on one of these ports by an earlier run would answer every
# probe below, and the run would measure *it* — a build that may not match the
# code. Refuse instead.
for port in "$MOCK_PORT" "$GATEWAY_PORT" "$APP_PORT"; do
  if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$port/"; then
    echo "port $port is already in use; stop whatever is on it, or set MOCK_PORT/GATEWAY_PORT/APP_PORT" >&2
    exit 1
  fi
done

wait_for() { for _ in $(seq 1 100); do curl -s -o /dev/null "$1" && return 0; sleep 0.2; done; echo "nothing answered at $1" >&2; exit 1; }

echo "==> data stand-in on :$MOCK_PORT, auth gateway on :$GATEWAY_PORT"
MOCK_REST_PORT="$MOCK_PORT" node "$ROOT/scripts/studio-mock-rest.mjs" >/dev/null & PIDS+=($!)
SUPABASE_JWT_SECRET="$JWT_SECRET" node "$ROOT/scripts/supabase-gateway.mjs" \
  --port "$GATEWAY_PORT" --postgrest "http://127.0.0.1:$MOCK_PORT" >/dev/null & PIDS+=($!)
wait_for "http://127.0.0.1:$GATEWAY_PORT/auth/v1/settings"

KEYS=$(SUPABASE_JWT_SECRET="$JWT_SECRET" node "$ROOT/scripts/supabase-gateway.mjs" --print-keys)
ANON=$(echo "$KEYS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["anon"])')
SRV=$(echo "$KEYS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["service_role"])')

# NEXT_PUBLIC_* are inlined at build time, so the build has to know the gateway.
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$GATEWAY_PORT"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON"
export SUPABASE_SERVICE_ROLE_KEY="$SRV"
export NEXT_PUBLIC_SITE_URL="http://localhost:$APP_PORT"

echo "==> build against the stand-ins"
(cd "$ROOT" && npm run build >/dev/null)

echo "==> app on :$APP_PORT"
# `exec`, so the PID recorded is the server's own: without it the trap killed
# the wrapping subshell and left the server running on the port.
(cd "$ROOT" && exec node node_modules/next/dist/bin/next start -p "$APP_PORT" >/dev/null) & PIDS+=($!)
wait_for "http://localhost:$APP_PORT/login"

COOKIE=$(node "$ROOT/scripts/harness-session.mjs" --url "$NEXT_PUBLIC_SUPABASE_URL" \
  --anon "$ANON" --user "$USER_ID" --email author@example.com)

echo "==> measure"
BASE="http://localhost:$APP_PORT" COOKIE="$COOKIE" node "$ROOT/scripts/measure-ux.mjs"
