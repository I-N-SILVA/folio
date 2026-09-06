#!/usr/bin/env bash
#
# The MVP loop, for real: publish → read → measured → gated → reported.
#
# `docs/mvp-scope.md` §1 says the product is one sentence — "Send a PDF. See who
# actually read it." — and one loop. Every part of the AppSumo path has now been
# run against a real database and five launch-stoppers came out of it. This
# loop, which is the product itself, had never been run at all.
#
# What it exercises, over HTTP against a real PostgREST and a real PostgreSQL:
#
#   - a published edition renders at its public URL, and at its embed URL;
#   - the reader's analytics reach the events table (they are anonymous, so
#     this is the one core path testable without a session);
#   - the email gate accepts an address and records the unlock;
#   - Insights reports that reader and that lead back to the author;
#   - a renamed edition's old link still redirects, at the protocol level.
#
#   npm run verify:mvp:e2e
#
# Needs a local PostgreSQL and the PostgREST binary — see verify-appsumo-e2e.sh.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${DB:-qlico_mvp}"
PGRST_PORT="${PGRST_PORT:-5798}"
GATEWAY_PORT="${GATEWAY_PORT:-5799}"
APP_PORT="${APP_PORT:-5801}"
POSTGREST_BIN="${POSTGREST_BIN:-$(command -v postgrest || echo ./postgrest)}"
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters"

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

SLUG="mvp-edition"
BOOK="66666666-6666-6666-6666-666666666666"
SESSION="reader-session-1"

echo "==> database"
su postgres -c "dropdb --if-exists $DB" >/dev/null 2>&1 || true
su postgres -c "createdb $DB"
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f $ROOT/scripts/supabase-shim.sql" >/dev/null
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f $ROOT/supabase/master_migration.sql" >/dev/null
su postgres -c "psql -tAc \"ALTER ROLE postgres WITH PASSWORD 'postgres'\"" >/dev/null

AUTHOR=$(su postgres -c "psql -tAq -d $DB -c \"INSERT INTO auth.users (email) VALUES ('author@example.com') RETURNING id\"" | head -1 | tr -d '[:space:]')

echo "==> an author publishes a two-page edition with an email gate on page 2"
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB" >/dev/null <<SQL
INSERT INTO public.books (id, owner_id, slug, title, description, theme, settings)
VALUES ('$BOOK', '$AUTHOR', '$SLUG', 'The Silk Trench', 'A lookbook',
  '{"preset":"ivory","typeset":"editorial"}'::jsonb,
  '{"published":true,"unlisted":false,
    "gating":{"enabled":true,"page_number":2,"type":"email",
              "title":"Read the rest","description":"Your email, and the rest is yours."}}'::jsonb);
SELECT public.replace_book_pages('$BOOK', jsonb_build_array(
  jsonb_build_object('page_number',1,'type','cover','layout','hero','blocks',
    jsonb_build_array(jsonb_build_object('id','t1','type','text','variant','title','content','The Silk Trench'))),
  jsonb_build_object('page_number',2,'type','content','layout','text','blocks',
    jsonb_build_array(jsonb_build_object('id','t2','type','text','variant','body','content','Hand-tailored in Milan.')))
));
-- Plans are read off the profile; a paid one so the gate is actually enforced.
UPDATE public.profiles SET plan = 'ltd_tier2' WHERE id = '$AUTHOR';
SQL

echo "==> PostgREST + gateway"
PGRST_DB_URI="postgres://postgres:postgres@127.0.0.1:5432/$DB" PGRST_DB_SCHEMAS=public \
PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT="$PGRST_PORT" \
  "$POSTGREST_BIN" >/tmp/pgrst-mvp.log 2>&1 &
PGRST_PID=$!

SUPABASE_JWT_SECRET="$JWT_SECRET" node "$ROOT/scripts/supabase-gateway.mjs" \
  --port "$GATEWAY_PORT" --postgrest "http://127.0.0.1:$PGRST_PORT" >/tmp/gateway-mvp.log 2>&1 &
GW_PID=$!

KEYS=$(SUPABASE_JWT_SECRET="$JWT_SECRET" node "$ROOT/scripts/supabase-gateway.mjs" --print-keys)
ANON=$(echo "$KEYS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["anon"])')
SRV=$(echo "$KEYS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["service_role"])')

echo "==> build and start the app against it"
( cd "$ROOT" && NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$GATEWAY_PORT" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" NEXT_PUBLIC_SITE_URL="http://127.0.0.1:$APP_PORT" \
  SUPABASE_SERVICE_ROLE_KEY="$SRV" npx next build --webpack ) >/tmp/app-mvp-build.log 2>&1 \
  || { tail -20 /tmp/app-mvp-build.log; exit 1; }

NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$GATEWAY_PORT" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" SUPABASE_SERVICE_ROLE_KEY="$SRV" \
NEXT_PUBLIC_SITE_URL="http://127.0.0.1:$APP_PORT" \
  npx next start -p "$APP_PORT" >/tmp/app-mvp.log 2>&1 &
APP_PID=$!
until curl -s --noproxy '*' -o /dev/null "http://127.0.0.1:$APP_PORT/" 2>/dev/null; do sleep 1; done

api() { curl -s --noproxy '*' "http://127.0.0.1:$APP_PORT$1"; }
status() { curl -s -o /dev/null -w '%{http_code}' --noproxy '*' "http://127.0.0.1:$APP_PORT$1"; }
rows() { su postgres -c "psql -tAq -d $DB -c \"$1\"" | head -1 | tr -d '[:space:]'; }

echo
echo "==> a reader opens the published link"
PAGE=$(api "/book/$SLUG")
[[ "$(status "/book/$SLUG")" == "200" ]] && pass "the edition serves at /book/$SLUG" || fail "/book/$SLUG returned $(status "/book/$SLUG")"
echo "$PAGE" | grep -q "The Silk Trench" && pass "its title is in the HTML" || fail "the title is not in the rendered page"
[[ "$(status "/embed/$SLUG")" == "200" ]] && pass "it embeds at /embed/$SLUG" || fail "/embed/$SLUG returned $(status "/embed/$SLUG")"
[[ "$(status "/book/no-such-edition")" == "404" ]] && pass "an unknown slug is a 404" || fail "unknown slug returned $(status "/book/no-such-edition")"

echo
echo "==> the reader is measured"
for ev in book_open page_view page_flip; do
  curl -s -o /dev/null --noproxy '*' -X POST "http://127.0.0.1:$APP_PORT/api/events" \
    -H 'content-type: application/json' \
    -d "{\"bookId\":\"$BOOK\",\"sessionId\":\"$SESSION\",\"eventType\":\"$ev\",\"pageNumber\":1}"
done
COUNT=$(rows "select count(*) from public.events where book_id='$BOOK'")
[[ "$COUNT" == "3" ]] && pass "three reader events reached the table ($COUNT)" || fail "events table holds '$COUNT', expected 3"

BAD=$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' -X POST "http://127.0.0.1:$APP_PORT/api/events" \
  -H 'content-type: application/json' -d "{\"bookId\":\"$BOOK\",\"sessionId\":\"s\",\"eventType\":\"not_a_real_event\"}")
[[ "$BAD" == "400" ]] && pass "an unknown event type is refused ($BAD)" || fail "unknown event type returned $BAD"

echo
echo "==> the email gate"
# A won gate answers with the now-unlocked pages; a refused one answers
# `{"error":...}` on a 4xx. Asserting on the pages is asserting on the thing the
# reader actually gets back.
UNLOCK=$(curl -s -w '\n%{http_code}' --noproxy '*' -X POST "http://127.0.0.1:$APP_PORT/api/books/unlock" \
  -H 'content-type: application/json' \
  -d "{\"slug\":\"$SLUG\",\"email\":\"reader@example.com\",\"sessionId\":\"$SESSION\"}")
UNLOCK_CODE=$(echo "$UNLOCK" | tail -1)
UNLOCK_BODY=$(echo "$UNLOCK" | sed '$d')
if [[ "$UNLOCK_CODE" == "200" ]] && echo "$UNLOCK_BODY" | grep -q '"pages"' && ! echo "$UNLOCK_BODY" | grep -q '"error"'; then
  pass "the gate opens and hands back the rest of the edition ($UNLOCK_CODE)"
else
  fail "unlock answered $UNLOCK_CODE: $UNLOCK_BODY"
fi

LEADS=$(rows "select count(*) from public.events where book_id='$BOOK' and event_type='gate_unlock'")
[[ "$LEADS" == "1" ]] && pass "the lead is recorded as a gate_unlock ($LEADS)" || fail "gate_unlock rows: '$LEADS'"

EMAIL=$(rows "select payload->>'email' from public.events where book_id='$BOOK' and event_type='gate_unlock'")
[[ "$EMAIL" == "reader@example.com" ]] && pass "the address is captured ($EMAIL)" || fail "captured address is '$EMAIL'"

echo
echo "==> Insights reports it back to the author"
ENG=$(rows "select readers||'/'||leads from public.edition_engagement(ARRAY['$BOOK']::uuid[], now() - interval '7 days')")
[[ "$ENG" == "1/1" ]] && pass "one reader and one lead ($ENG)" || fail "engagement says '$ENG', expected 1/1"

echo
echo "==> a renamed edition keeps its old links working"
# Two old addresses, because they fail differently. `$SLUG` was opened above and
# is therefore in the ISR cache; `$SHARED` is a link that went out and has not
# been clicked yet, which is the ordinary state of most links an author sends.
#
# Production renames go through PATCH /api/books/[id], which calls
# `revalidateReader` on both addresses so neither is stale. This harness renames
# in SQL (there is no signed-in session here), so the cached one is expected to
# stay warm for the rest of its window and only $SHARED is asserted on.
SHARED="also-shared-link"
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -c \"
  INSERT INTO public.book_slug_history (book_id, slug) VALUES ('$BOOK', '$SLUG'), ('$BOOK', '$SHARED');
  UPDATE public.books SET slug = 'renamed-edition' WHERE id = '$BOOK';\"" >/dev/null
NEW=$(status "/book/renamed-edition")
OLD=$(status "/book/$SHARED")
OLD_LOC=$(curl -s -o /dev/null -w '%{redirect_url}' --noproxy '*' "http://127.0.0.1:$APP_PORT/book/$SHARED")
[[ "$NEW" == "200" ]] && pass "the new link works ($NEW)" || fail "new slug returned $NEW"
# Not 200. A 200 here is the soft 404 this harness was written to catch: the
# page streams, so `permanentRedirect` degrades to a meta refresh in the body
# and the status stays 200 with no Location. A browser follows that; an unfurl,
# a crawler and a link checker do not, and the old link reads "Not Found".
if [[ "$OLD" == "308" || "$OLD" == "301" ]] && [[ "$OLD_LOC" == *"/book/renamed-edition" ]]; then
  pass "the old link redirects at the protocol level ($OLD -> $OLD_LOC)"
else
  fail "old slug returned $OLD -> '${OLD_LOC:-no Location}' — every link already sent out unfurls as Not Found"
fi

echo
if [[ "$FAILED" -gt 0 ]]; then
  echo "  $FAILED failing"
  exit 1
fi
echo "  The MVP loop works: publish → read → measured → gated → reported."
