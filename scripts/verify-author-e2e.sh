#!/usr/bin/env bash
#
# The buyer's first hour: sign in, make an edition, publish it, redeem a code.
#
# `verify-mvp-e2e.sh` covers the reader's half of the loop and reaches the
# database as `service_role`, which bypasses RLS entirely. Nothing here had ever
# executed a statement as a signed-in author, so the studio — every route behind
# a session, and every RLS policy — was untested by anything that runs.
#
# `scripts/harness-session.mjs` closes that: it drives @supabase/ssr over an
# in-memory cookie jar and prints the Cookie header a signed-in browser would
# send, so curl can be an author.
#
# What it exercises, over HTTP, against a real PostgREST and a real PostgreSQL:
#
#   - the studio is closed to a stranger and open to a session;
#   - an author creates, edits, saves and publishes an edition, and it appears
#     at its public address;
#   - the free plan's edition limit is the number the pricing page sells, and
#     hitting it is a 403 the client can render, not a 500;
#   - a second author cannot touch the first one's edition;
#   - an AppSumo code lifts the plan, cannot be redeemed twice by different
#     people, is idempotent for its rightful holder, and a refund takes it back.
#
#   npm run verify:author:e2e
#
# Needs a local PostgreSQL and the PostgREST binary — see verify-appsumo-e2e.sh.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${DB:-qlico_author_e2e}"
PGRST_PORT="${PGRST_PORT:-5802}"
GATEWAY_PORT="${GATEWAY_PORT:-5803}"
APP_PORT="${APP_PORT:-5804}"
POSTGREST_BIN="${POSTGREST_BIN:-$(command -v postgrest || echo ./postgrest)}"
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters"
APPSUMO_KEY="author-e2e-appsumo-key"

[[ -x "$POSTGREST_BIN" ]] || { echo "PostgREST not found — set POSTGREST_BIN."; exit 2; }

for port in "$PGRST_PORT" "$GATEWAY_PORT" "$APP_PORT"; do
  if curl -s --noproxy '*' -o /dev/null --max-time 2 "http://127.0.0.1:$port/" 2>/dev/null; then
    echo "Something is already listening on 127.0.0.1:$port — it would answer instead of this build."
    exit 2
  fi
done

cleanup() { kill ${PGRST_PID:-} ${GW_PID:-} ${APP_PID:-} 2>/dev/null || true; }
trap cleanup EXIT

FAILED=0
pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; FAILED=$((FAILED + 1)); }

echo "==> database"
su postgres -c "dropdb --if-exists $DB" >/dev/null 2>&1 || true
su postgres -c "createdb $DB"
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f $ROOT/scripts/supabase-shim.sql" >/dev/null
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f $ROOT/supabase/master_migration.sql" >/dev/null
su postgres -c "psql -tAc \"ALTER ROLE postgres WITH PASSWORD 'postgres'\"" >/dev/null

newuser() {
  su postgres -c "psql -tAq -d $DB -c \"INSERT INTO auth.users (email) VALUES ('$1') RETURNING id\"" \
    | head -1 | tr -d '[:space:]'
}
AUTHOR=$(newuser author@example.com)
INTRUDER=$(newuser intruder@example.com)
FREE=$(newuser free@example.com)

echo "==> PostgREST + gateway"
PGRST_DB_URI="postgres://postgres:postgres@127.0.0.1:5432/$DB" PGRST_DB_SCHEMAS=public \
PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT="$PGRST_PORT" \
  "$POSTGREST_BIN" >/tmp/pgrst-author.log 2>&1 &
PGRST_PID=$!

SUPABASE_JWT_SECRET="$JWT_SECRET" node "$ROOT/scripts/supabase-gateway.mjs" \
  --port "$GATEWAY_PORT" --postgrest "http://127.0.0.1:$PGRST_PORT" >/tmp/gateway-author.log 2>&1 &
GW_PID=$!

KEYS=$(SUPABASE_JWT_SECRET="$JWT_SECRET" node "$ROOT/scripts/supabase-gateway.mjs" --print-keys)
ANON=$(echo "$KEYS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["anon"])')
SRV=$(echo "$KEYS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["service_role"])')

echo "==> build and start the app against it"
( cd "$ROOT" && NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$GATEWAY_PORT" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" NEXT_PUBLIC_SITE_URL="http://127.0.0.1:$APP_PORT" \
  SUPABASE_SERVICE_ROLE_KEY="$SRV" APPSUMO_API_KEY="$APPSUMO_KEY" \
  npx next build --webpack ) >/tmp/app-author-build.log 2>&1 \
  || { tail -20 /tmp/app-author-build.log; exit 1; }

NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$GATEWAY_PORT" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" SUPABASE_SERVICE_ROLE_KEY="$SRV" \
NEXT_PUBLIC_SITE_URL="http://127.0.0.1:$APP_PORT" APPSUMO_API_KEY="$APPSUMO_KEY" \
  npx next start -p "$APP_PORT" >/tmp/app-author.log 2>&1 &
APP_PID=$!
until curl -s --noproxy '*' -o /dev/null "http://127.0.0.1:$APP_PORT/" 2>/dev/null; do sleep 1; done

A="http://127.0.0.1:$APP_PORT"
session() {
  node "$ROOT/scripts/harness-session.mjs" --url "http://127.0.0.1:$GATEWAY_PORT" \
    --anon "$ANON" --user "$1" --email "$2"
}
status() { curl -s -o /dev/null -w '%{http_code}' --noproxy '*' "$@"; }
rows() { su postgres -c "psql -tAq -d $DB -c \"$1\"" | head -1 | tr -d '[:space:]'; }

AC=$(session "$AUTHOR" author@example.com)
IC=$(session "$INTRUDER" intruder@example.com)
FC=$(session "$FREE" free@example.com)

echo
echo "==> the studio is shut to a stranger and open to a session"
for p in /dashboard /account /insights; do
  OUT=$(status "$A$p"); IN=$(status -H "Cookie: $AC" "$A$p")
  [[ "$OUT" == "307" && "$IN" == "200" ]] \
    && pass "$p — signed out $OUT, signed in $IN" \
    || fail "$p — signed out $OUT, signed in $IN (want 307 then 200)"
done

echo
echo "==> an author makes an edition and publishes it"
CREATED=$(curl -s --noproxy '*' -X POST "$A/api/books" -H "Cookie: $AC" \
  -H 'content-type: application/json' \
  -d '{"title":"The Silk Trench","description":"A lookbook","slug":"silk-trench"}')
BOOK=$(echo "$CREATED" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("id",""))' 2>/dev/null || true)
[[ -n "$BOOK" ]] && pass "created ($BOOK)" || fail "create answered: $(echo "$CREATED" | head -c 200)"

[[ "$(status -H "Cookie: $AC" "$A/editor/$BOOK")" == "200" ]] \
  && pass "the editor opens on it" || fail "the editor returned $(status -H "Cookie: $AC" "$A/editor/$BOOK")"

# Page ids are the editor's, not the database's — it creates them with
# crypto.randomUUID() before a page has ever been saved.
P1=$(python3 -c 'import uuid;print(uuid.uuid4())'); P2=$(python3 -c 'import uuid;print(uuid.uuid4())')
SAVE=$(status -X PUT "$A/api/books/$BOOK/pages" -H "Cookie: $AC" -H 'content-type: application/json' \
  -d "[{\"id\":\"$P1\",\"page_number\":1,\"type\":\"cover\",\"layout\":\"hero\",\"blocks\":[{\"id\":\"t1\",\"type\":\"text\",\"variant\":\"title\",\"content\":\"The Silk Trench\"}],\"hotspots\":[]},
      {\"id\":\"$P2\",\"page_number\":2,\"type\":\"content\",\"layout\":\"text\",\"blocks\":[{\"id\":\"t2\",\"type\":\"text\",\"variant\":\"body\",\"content\":\"Hand-tailored in Milan.\"}],\"hotspots\":[]}]")
[[ "$SAVE" == "204" ]] && pass "two pages saved ($SAVE)" || fail "saving pages returned $SAVE"
[[ "$(rows "select count(*) from public.pages where book_id='$BOOK'")" == "2" ]] \
  && pass "both are in the table" || fail "pages in the table: $(rows "select count(*) from public.pages where book_id='$BOOK'")"

curl -s -o /dev/null --noproxy '*' -X PATCH "$A/api/books/$BOOK" -H "Cookie: $AC" \
  -H 'content-type: application/json' -d '{"settings":{"published":true,"unlisted":false}}'
[[ "$(status "$A/book/silk-trench")" == "200" ]] \
  && pass "it is live at /book/silk-trench" || fail "the public page returned $(status "$A/book/silk-trench")"
curl -s --noproxy '*' "$A/book/silk-trench" | grep -q 'Hand-tailored in Milan' \
  && pass "the saved second page is in the HTML" || fail "the edited page is not in the rendered edition"
[[ "$(status -H "Cookie: $AC" "$A/analytics/silk-trench")" == "200" ]] \
  && pass "Insights opens for it" || fail "analytics returned $(status -H "Cookie: $AC" "$A/analytics/silk-trench")"

echo
echo "==> somebody else's edition is not theirs to change"
PATCHED=$(status -X PATCH "$A/api/books/$BOOK" -H "Cookie: $IC" -H 'content-type: application/json' -d '{"title":"stolen"}')
DELETED=$(status -X DELETE "$A/api/books/$BOOK" -H "Cookie: $IC")
[[ "$PATCHED" == "403" || "$PATCHED" == "404" ]] && pass "PATCH refused ($PATCHED)" || fail "PATCH by a stranger returned $PATCHED"
[[ "$DELETED" == "403" || "$DELETED" == "404" ]] && pass "DELETE refused ($DELETED)" || fail "DELETE by a stranger returned $DELETED"
# `rows` strips whitespace, so the title comes back closed up.
[[ "$(rows "select title from public.books where id='$BOOK'")" == "TheSilkTrench" ]] \
  && pass "the title is untouched" || fail "the title is now '$(rows "select title from public.books where id='$BOOK'")'"

echo
echo "==> the free plan gives what the pricing page sells"
LIMIT=$(rows "select public.book_limit_for_plan('free')")
for i in $(seq 1 "$LIMIT"); do
  C=$(status -X POST "$A/api/books" -H "Cookie: $FC" -H 'content-type: application/json' \
    -d "{\"title\":\"Edition $i\",\"slug\":\"free-edition-$i\"}")
  [[ "$C" == "201" ]] || fail "edition $i of $LIMIT returned $C"
done
pass "a free author gets $LIMIT editions"

OVER=$(curl -s --noproxy '*' -X POST "$A/api/books" -H "Cookie: $FC" -H 'content-type: application/json' \
  -d '{"title":"One too many","slug":"free-edition-over"}' -w '\n%{http_code}')
OVER_CODE=$(echo "$OVER" | tail -1); OVER_BODY=$(echo "$OVER" | sed '$d')
# Not 500. The trigger's raw `BOOK_LIMIT_REACHED: plan free allows 1 book(s)`
# reached the browser for as long as 006's ladder and lib/plans.ts disagreed.
if [[ "$OVER_CODE" == "403" ]] && echo "$OVER_BODY" | grep -q '"code":"plan_limit"'; then
  pass "the one after that is a 403 the client can render"
else
  fail "over the limit answered $OVER_CODE: $OVER_BODY"
fi

echo
echo "==> an AppSumo code"
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -c \"
  INSERT INTO public.appsumo_licenses (license_key, plan, tier, status, activation_email)
  VALUES ('AUTHOR-E2E-1','ltd_tier2',2,'active','author@example.com')\"" >/dev/null

REDEEM=$(curl -s --noproxy '*' -X POST "$A/api/appsumo/redeem" -H "Cookie: $AC" \
  -H 'content-type: application/json' -d '{"code":"AUTHOR-E2E-1"}')
echo "$REDEEM" | grep -q '"ok":true' && pass "redeemed ($REDEEM)" || fail "redeem answered: $REDEEM"
[[ "$(rows "select plan from public.profiles where id='$AUTHOR'")" == "ltd_tier2" ]] \
  && pass "the plan is on the profile" || fail "the profile says '$(rows "select plan from public.profiles where id='$AUTHOR'")'"
curl -s --noproxy '*' -H "Cookie: $AC" "$A/account" | grep -q 'Tier 2' \
  && pass "/account shows it" || fail "/account does not name the plan"

echo "$(curl -s --noproxy '*' -X POST "$A/api/appsumo/redeem" -H "Cookie: $IC" \
  -H 'content-type: application/json' -d '{"code":"AUTHOR-E2E-1"}')" | grep -qi 'already been redeemed' \
  && pass "a second person cannot redeem the same code" || fail "the code was redeemable twice"

curl -s --noproxy '*' -X POST "$A/api/appsumo/redeem" -H "Cookie: $AC" \
  -H 'content-type: application/json' -d '{"code":"AUTHOR-E2E-1"}' | grep -q '"ok":true' \
  && pass "its holder can redeem it again, so a lost response is not a lost code" \
  || fail "a repeat redemption by the rightful holder was refused"

[[ "$(status -X POST "$A/api/appsumo/redeem" -H 'content-type: application/json' -d '{"code":"AUTHOR-E2E-1"}')" == "401" ]] \
  && pass "an anonymous caller is refused" || fail "an anonymous redeem was not a 401"

echo
echo "==> a refund takes it back"
TS=$(date +%s)
BODY="{\"event\":\"refund\",\"license_key\":\"AUTHOR-E2E-1\",\"license_status\":\"refunded\",\"tier\":2}"
SIG=$(python3 -c "import hmac,hashlib,sys;print(hmac.new(sys.argv[1].encode(),(sys.argv[2]+sys.argv[3]).encode(),hashlib.sha256).hexdigest())" "$APPSUMO_KEY" "$TS" "$BODY")
WH=$(status -X POST "$A/api/appsumo/webhook" -H 'content-type: application/json' \
  -H "x-appsumo-signature: $SIG" -H "x-appsumo-timestamp: $TS" -d "$BODY")
[[ "$WH" == "200" ]] && pass "the refund webhook is accepted ($WH)" || fail "the refund webhook returned $WH"
PLAN_AFTER=$(rows "select plan||'|'||status from public.profiles where id='$AUTHOR'")
[[ "$PLAN_AFTER" == "free|refunded" || "$PLAN_AFTER" == "free|active" ]] \
  && pass "the author is back on free ($PLAN_AFTER)" || fail "after the refund the profile says '$PLAN_AFTER'"

echo
if [[ "$FAILED" -gt 0 ]]; then
  echo "  $FAILED failing"
  exit 1
fi
echo "  The author loop works: sign in → create → publish → redeem → refund."
