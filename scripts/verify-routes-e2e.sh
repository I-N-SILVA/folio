#!/usr/bin/env bash
#
# The HTTP routes, against a real database.
#
# `verify-appsumo-e2e.sh` exercises `lib/appsumo.ts` directly. This runs the
# built Next.js app in front of the same stack and drives it over HTTP, which
# covers the parts a library test cannot: the webhook's signature check writing
# a real row, and the digest route actually sending an email.
#
# Both of those had bugs that only a real PostgREST could reveal — the licence
# claim and the digest's slot claim were each a `.or()` on an UPDATE, which
# PostgREST rejects with 42703 (see migrations 015 and 016). The claims are
# fixed and unit-tested; this proves the whole route works end to end, because
# fixing one statement in the middle of a route is not the same as the route
# working.
#
#   npm run verify:routes:e2e
#
# Needs a local PostgreSQL and the PostgREST binary. Emails go to a local
# capture server, never to Resend.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${DB:-qlico_routes}"
PGRST_PORT="${PGRST_PORT:-5698}"
GATEWAY_PORT="${GATEWAY_PORT:-5699}"
MAIL_PORT="${MAIL_PORT:-5700}"
APP_PORT="${APP_PORT:-5701}"
POSTGREST_BIN="${POSTGREST_BIN:-$(command -v postgrest || echo ./postgrest)}"
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters"
APPSUMO_KEY="e2e-appsumo-key"
CRON_SECRET="e2e-cron-secret"
MAILBOX="${TMPDIR:-/tmp}/qlico-mailbox.jsonl"

[[ -x "$POSTGREST_BIN" ]] || { echo "PostgREST not found — set POSTGREST_BIN. See scripts/verify-appsumo-e2e.sh."; exit 2; }

cleanup() { kill ${PGRST_PID:-} ${GW_PID:-} ${MAIL_PID:-} ${APP_PID:-} 2>/dev/null || true; }
trap cleanup EXIT

fail() { echo "  ✗ $1"; FAILED=$((FAILED + 1)); }
pass() { echo "  ✓ $1"; }
FAILED=0

echo "==> database"
su postgres -c "dropdb --if-exists $DB" >/dev/null 2>&1 || true
su postgres -c "createdb $DB"
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f $ROOT/scripts/supabase-shim.sql" >/dev/null
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f $ROOT/supabase/master_migration.sql" >/dev/null
su postgres -c "psql -tAc \"ALTER ROLE postgres WITH PASSWORD 'postgres'\"" >/dev/null

AUTHOR=$(su postgres -c "psql -tAq -d $DB -c \"INSERT INTO auth.users (email) VALUES ('author@example.com') RETURNING id\"" | head -1 | tr -d '[:space:]')

echo "==> a published edition with a reader, so the digest has something to report"
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB" >/dev/null <<SQL
INSERT INTO public.books (id, owner_id, slug, title, theme, settings)
VALUES ('55555555-5555-5555-5555-555555555555', '$AUTHOR', 'e2e-edition', 'E2E Edition',
        '{"preset":"ivory"}'::jsonb, '{"published":true,"unlisted":false}'::jsonb);
SELECT public.replace_book_pages('55555555-5555-5555-5555-555555555555',
  jsonb_build_array(jsonb_build_object('page_number',1,'type','cover','layout','hero','blocks','[]'::jsonb)));
INSERT INTO public.events (book_id, session_id, event_type, page_number)
VALUES ('55555555-5555-5555-5555-555555555555', 'reader-1', 'book_open', 1),
       ('55555555-5555-5555-5555-555555555555', 'reader-1', 'gate_unlock', 1);
SQL

echo "==> PostgREST, gateway, mail capture"
PGRST_DB_URI="postgres://postgres:postgres@127.0.0.1:5432/$DB" PGRST_DB_SCHEMAS=public \
PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT="$PGRST_PORT" \
  "$POSTGREST_BIN" >/tmp/pgrst-routes.log 2>&1 &
PGRST_PID=$!

SUPABASE_JWT_SECRET="$JWT_SECRET" node "$ROOT/scripts/supabase-gateway.mjs" \
  --port "$GATEWAY_PORT" --postgrest "http://127.0.0.1:$PGRST_PORT" >/tmp/gateway-routes.log 2>&1 &
GW_PID=$!

: > "$MAILBOX"
PORT="$MAIL_PORT" MAILBOX="$MAILBOX" node -e '
  const { createServer } = require("node:http")
  const { appendFileSync } = require("node:fs")
  createServer((req, res) => {
    let body = ""
    req.on("data", (c) => (body += c))
    req.on("end", () => {
      appendFileSync(process.env.MAILBOX, body + "\n")
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ id: "captured" }))
    })
  }).listen(Number(process.env.PORT), "127.0.0.1")
' &
MAIL_PID=$!

KEYS=$(SUPABASE_JWT_SECRET="$JWT_SECRET" node "$ROOT/scripts/supabase-gateway.mjs" --print-keys)
ANON=$(echo "$KEYS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["anon"])')
SRV=$(echo "$KEYS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["service_role"])')

# `NEXT_PUBLIC_*` is inlined at build time, so the app has to be *built*
# against the gateway. Setting it only at `next start` leaves the bundle
# pointing wherever the last build pointed — which is a real deployment
# footgun, not just a harness one: changing NEXT_PUBLIC_SUPABASE_URL in a
# hosting dashboard does nothing until the next build.
echo "==> build against the gateway (NEXT_PUBLIC_* is baked in)"
( cd "$ROOT" && NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$GATEWAY_PORT" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" \
  NEXT_PUBLIC_SITE_URL="http://127.0.0.1:$APP_PORT" \
  SUPABASE_SERVICE_ROLE_KEY="$SRV" \
  npx next build --webpack ) >/tmp/app-build.log 2>&1 || { tail -20 /tmp/app-build.log; exit 1; }

echo "==> the app"
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$GATEWAY_PORT" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" \
SUPABASE_SERVICE_ROLE_KEY="$SRV" \
NEXT_PUBLIC_SITE_URL="http://127.0.0.1:$APP_PORT" \
APPSUMO_API_KEY="$APPSUMO_KEY" \
CRON_SECRET="$CRON_SECRET" \
RESEND_API_KEY="e2e" EMAIL_FROM="QLICO <e2e@example.com>" \
RESEND_API_URL="http://127.0.0.1:$MAIL_PORT/emails" \
  npx next start -p "$APP_PORT" >/tmp/app-routes.log 2>&1 &
APP_PID=$!

until curl -s --noproxy '*' "http://127.0.0.1:$APP_PORT/api/appsumo/webhook" >/dev/null 2>&1; do sleep 1; done

echo
echo "==> the AppSumo webhook, over HTTP, with a real signature"
LICENSE="ROUTES-$RANDOM"
BODY=$(python3 -c "import json,sys;print(json.dumps({'action':'activate','license_key':sys.argv[1],'tier':2,'activation_email':'author@example.com'}))" "$LICENSE")
SIG=$(python3 -c "import hmac,hashlib,sys;print(hmac.new(sys.argv[1].encode(),sys.argv[2].encode(),hashlib.sha256).hexdigest())" "$APPSUMO_KEY" "$BODY")

CODE=$(curl -s -o /tmp/wh.json -w '%{http_code}' --noproxy '*' -X POST "http://127.0.0.1:$APP_PORT/api/appsumo/webhook" \
  -H 'content-type: application/json' -H "x-appsumo-signature: $SIG" -d "$BODY")
[[ "$CODE" == "200" ]] && pass "webhook accepts a correctly signed activate ($CODE)" || fail "webhook returned $CODE: $(cat /tmp/wh.json)"

ROW=$(su postgres -c "psql -tAq -d $DB -c \"select plan||'|'||status from public.appsumo_licenses where license_key='$LICENSE'\"" | head -1 | tr -d '[:space:]')
[[ "$ROW" == "ltd_tier2|active" ]] && pass "the licence row exists with the right tier ($ROW)" || fail "licence row is '$ROW'"

echo
echo "==> the weekly digest, over HTTP, with the fixed slot claim"
DIGEST=$(curl -s --noproxy '*' -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:$APP_PORT/api/cron/digest")
echo "     $DIGEST"
SENT=$(echo "$DIGEST" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("sent",0))')
[[ "$SENT" -ge 1 ]] && pass "the digest actually sent ($SENT)" || fail "the digest sent nothing: $DIGEST"

MAILS=$(wc -l < "$MAILBOX" | tr -d ' ')
[[ "$MAILS" -ge 1 ]] && pass "an email reached the provider ($MAILS)" || fail "no email was sent"

if [[ "$MAILS" -ge 1 ]]; then
  SUBJ=$(head -1 "$MAILBOX" | python3 -c 'import json,sys;print(json.load(sys.stdin)["subject"])')
  TEXT=$(head -1 "$MAILBOX" | python3 -c 'import json,sys;print(json.load(sys.stdin)["text"])')
  echo
  echo "     ── the email, as sent ──"
  echo "     Subject: $SUBJ"
  echo "$TEXT" | sed 's/^/     /'
  echo
  echo "$TEXT" | grep -q 'Turn this off at' && pass "it carries an unsubscribe line" || fail "no unsubscribe line"
fi

echo
echo "==> running it again must not double-send"
AGAIN=$(curl -s --noproxy '*' -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:$APP_PORT/api/cron/digest")
SENT2=$(echo "$AGAIN" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("sent",0))')
[[ "$SENT2" == "0" ]] && pass "a second run sends nothing ($AGAIN)" || fail "double-sent: $AGAIN"

echo
if [[ "$FAILED" -gt 0 ]]; then
  echo "  $FAILED failing"
  exit 1
fi
echo "  The webhook and the digest both work end to end."
