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
#   - a PDF import claims its upload targets, takes the pages the browser
#     writes to storage, and turns what actually landed into an edition;
#   - the entitlements the tiers are sold on are enforced where the money is:
#     a free author's lead gate does not run, their CSV export is refused and
#     their analytics stop at the window they were sold, and a redeemed one's
#     all three work;
#   - an edition can be put back to how it was, and restoring is not a
#     one-way door;
#   - a reviewer with no account can open a draft through a link and leave a
#     comment on it, and revoking the link closes the door;
#   - an asset upload lands under its own book and refuses a stranger's;
#   - the one profile field an author may set is settable and nothing else is;
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
echo "==> what the free plan is not sold"
# `readerPolicy` treats the settings as a request and the plan as the answer, so
# a free author can switch the gate on and it must not run. If it did, the lead
# capture the paid tiers are sold on would be free, and the badge with it.
GATED='{"published":true,"unlisted":false,"gating":{"enabled":true,"page_number":2,"type":"email","title":"Read the rest","description":"Your email, and the rest is yours."}}'
FREEBOOK=$(rows "select id from public.books where slug='free-edition-1'")
P1F=$(python3 -c 'import uuid;print(uuid.uuid4())'); P2F=$(python3 -c 'import uuid;print(uuid.uuid4())')
curl -s -o /dev/null --noproxy '*' -X PUT "$A/api/books/$FREEBOOK/pages" -H "Cookie: $FC" \
  -H 'content-type: application/json' \
  -d "[{\"id\":\"$P1F\",\"page_number\":1,\"type\":\"cover\",\"layout\":\"hero\",\"blocks\":[{\"id\":\"f1\",\"type\":\"text\",\"variant\":\"title\",\"content\":\"A Free Edition\"}],\"hotspots\":[]},
       {\"id\":\"$P2F\",\"page_number\":2,\"type\":\"content\",\"layout\":\"text\",\"blocks\":[{\"id\":\"f2\",\"type\":\"text\",\"variant\":\"body\",\"content\":\"Behind the gate that must not run.\"}],\"hotspots\":[]}]"
curl -s -o /dev/null --noproxy '*' -X PATCH "$A/api/books/$FREEBOOK" -H "Cookie: $FC" \
  -H 'content-type: application/json' -d "{\"settings\":$GATED}"

FREE_HTML=$(curl -s --noproxy '*' "$A/book/free-edition-1")
echo "$FREE_HTML" | grep -q 'Behind the gate that must not run' \
  && pass "a free author's gate does not run — the page is readable" \
  || fail "a free edition is gated, which is a paid entitlement given away"

EXPORT_FREE=$(status -H "Cookie: $FC" "$A/api/analytics/free-edition-1/export?kind=events")
[[ "$EXPORT_FREE" == "403" ]] && pass "CSV export is refused on free ($EXPORT_FREE)" \
  || fail "CSV export on free returned $EXPORT_FREE"

# The retention window is sold on every plan — 30 days on free — and used to be
# a label on a range picker. Two readers, one of them older than the window, and
# a request for a year: only the recent one may be counted.
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -c \"
  INSERT INTO public.events (book_id, session_id, event_type, page_number, created_at)
  VALUES ('$FREEBOOK','recent','book_open',1, now() - interval '5 days'),
         ('$FREEBOOK','ancient','book_open',1, now() - interval '60 days');\"" >/dev/null
WINDOW=$(curl -s --noproxy '*' -H "Cookie: $FC" "$A/api/analytics/free-edition-1?range=365d")
SEEN=$(echo "$WINDOW" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["summary"]["uniqueSessions"], d["window"]["days"], d["window"]["clamped"])' 2>/dev/null || echo 'parse-failed')
[[ "$SEEN" == "1 30 True" ]] \
  && pass "a year asked for, 30 days answered, one reader in range ($SEEN)" \
  || fail "the free window reported '$SEEN', expected '1 30 True'"

echo
echo "==> a PDF import, which is the product's first sentence"
# The browser renders the pages and writes them to storage itself, so the parts
# a script can drive are the two server halves and the signed targets between
# them: begin → PUT each page → finalize. That is the whole server contract.
PNG=$(mktemp /tmp/qlico-page-XXXXXX.png)
python3 - "$PNG" <<'PYPNG'
import base64, sys
# The smallest valid PNG: 1x1, opaque.
sys.argv[1]
open(sys.argv[1], 'wb').write(base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='))
PYPNG

BEGIN=$(curl -s --noproxy '*' -X POST "$A/api/import/pdf" -H "Cookie: $AC" \
  -H 'content-type: application/json' \
  -d '{"title":"A Scanned Catalogue","slug":"scanned-catalogue","pageCount":3}')
IMPORTED=$(echo "$BEGIN" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("bookId",""))' 2>/dev/null || true)
TARGETS=$(echo "$BEGIN" | python3 -c 'import json,sys;print(len(json.load(sys.stdin).get("uploads",[])))' 2>/dev/null || echo 0)
[[ -n "$IMPORTED" && "$TARGETS" == "3" ]] \
  && pass "the import claims the slug and hands back 3 upload targets" \
  || fail "begin answered: $(echo "$BEGIN" | head -c 300)"

# Two of the three pages land. The third is the ordinary failure — a dropped
# upload — and the finalizer is documented to treat storage, not the request, as
# the authority on which pages exist.
UPLOADED=0
for n in 1 2; do
  T=$(echo "$BEGIN" | python3 -c "import json,sys;u=json.load(sys.stdin)['uploads'];print(next(x['token'] for x in u if x['pageNumber']==$n))")
  P=$(echo "$BEGIN" | python3 -c "import json,sys;u=json.load(sys.stdin)['uploads'];print(next(x['path'] for x in u if x['pageNumber']==$n))")
  UP=$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' -X PUT \
    "http://127.0.0.1:$GATEWAY_PORT/storage/v1/object/upload/sign/folio-assets/$P?token=$T" \
    -H 'content-type: image/png' --data-binary "@$PNG")
  [[ "$UP" == "200" ]] && UPLOADED=$((UPLOADED + 1))
done
[[ "$UPLOADED" == "2" ]] && pass "two pages written to storage" || fail "only $UPLOADED of 2 uploads were accepted"

FIN=$(curl -s --noproxy '*' -X POST "$A/api/import/pdf/finalize" -H "Cookie: $AC" \
  -H 'content-type: application/json' -d "{\"bookId\":\"$IMPORTED\"}")
echo "$FIN" | grep -q '"pageCount":2' \
  && pass "the edition is the two pages that landed, not the three that were claimed ($FIN)" \
  || fail "finalize answered: $FIN"
[[ "$(rows "select count(*) from public.pages where book_id='$IMPORTED'")" == "2" ]] \
  && pass "two page rows" || fail "page rows: $(rows "select count(*) from public.pages where book_id='$IMPORTED'")"

# Each page has to point at the object that was uploaded for it, or the import
# succeeds and the edition renders blank.
IMG=$(rows "select (blocks[1]->>'src') from public.pages where book_id='$IMPORTED' and page_number=1")
echo "$IMG" | grep -q "books/$IMPORTED/pages/page-1.png" \
  && pass "page 1 points at its own object" || fail "page 1's image src is '$IMG'"

REFIN=$(curl -s --noproxy '*' -X POST "$A/api/import/pdf/finalize" -H "Cookie: $AC" \
  -H 'content-type: application/json' -d "{\"bookId\":\"$IMPORTED\"}")
echo "$REFIN" | grep -q 'alreadyFinalized' \
  && pass "finalising twice does not double the edition" || fail "the second finalize answered: $REFIN"

curl -s -o /dev/null --noproxy '*' -X PATCH "$A/api/books/$IMPORTED" -H "Cookie: $AC" \
  -H 'content-type: application/json' -d '{"settings":{"published":true,"unlisted":false}}'
[[ "$(status "$A/book/scanned-catalogue")" == "200" ]] \
  && pass "the imported edition serves at its public address" \
  || fail "the imported edition returned $(status "$A/book/scanned-catalogue")"
# 200 is not the same as showing the pages: the whole import is images, so the
# reader has to carry the object each page points at.
curl -s --noproxy '*' "$A/book/scanned-catalogue" | grep -q "books/$IMPORTED/pages/page-1.png" \
  && pass "and the page images are in its HTML" || fail "the imported edition renders without its page images"
rm -f "$PNG"

echo
echo "==> what this edition looked like earlier"
# Publishing is a named checkpoint; the autosave takes automatic ones, throttled
# in the database so a save every couple of seconds does not become a row every
# couple of seconds.
VERSIONS=$(curl -s --noproxy '*' -H "Cookie: $AC" "$A/api/books/$BOOK/versions")
LABELS=$(echo "$VERSIONS" | python3 -c 'import json,sys;print("|".join(str(v["label"]) for v in json.load(sys.stdin)["versions"]))' 2>/dev/null || echo 'parse-failed')
echo "$LABELS" | grep -q 'Published' \
  && pass "publishing left a named version ($LABELS)" || fail "versions after publish: $LABELS"

# Wreck it the way a bad afternoon would: retitle, and replace the pages.
curl -s -o /dev/null --noproxy '*' -X PATCH "$A/api/books/$BOOK" -H "Cookie: $AC" \
  -H 'content-type: application/json' -d '{"title":"Wrecked"}'
WRECK=$(python3 -c 'import uuid;print(uuid.uuid4())')
curl -s -o /dev/null --noproxy '*' -X PUT "$A/api/books/$BOOK/pages" -H "Cookie: $AC" \
  -H 'content-type: application/json' \
  -d "[{\"id\":\"$WRECK\",\"page_number\":1,\"type\":\"cover\",\"layout\":\"blank\",\"blocks\":[],\"hotspots\":[]}]"
[[ "$(rows "select count(*) from public.pages where book_id='$BOOK'")" == "1" ]] \
  && pass "the edition is down to one blank page" || fail "the wreck did not take"

PUBLISHED_VERSION=$(echo "$VERSIONS" | python3 -c 'import json,sys;print(next(v["id"] for v in json.load(sys.stdin)["versions"] if v["label"]=="Published"))')
RESTORE=$(curl -s --noproxy '*' -X POST "$A/api/books/$BOOK/versions/$PUBLISHED_VERSION/restore" -H "Cookie: $AC" -w '\n%{http_code}')
[[ "$(echo "$RESTORE" | tail -1)" == "200" ]] \
  && pass "restored ($(echo "$RESTORE" | sed '''$d'''))" || fail "restore answered: $RESTORE"

[[ "$(rows "select title from public.books where id='$BOOK'")" == "TheSilkTrench" ]] \
  && pass "the title came back" || fail "the title is '$(rows "select title from public.books where id='$BOOK'")'"
[[ "$(rows "select count(*) from public.pages where book_id='$BOOK'")" == "2" ]] \
  && pass "both pages came back" || fail "pages after restore: $(rows "select count(*) from public.pages where book_id='$BOOK'")"
[[ "$(rows "select slug from public.books where id='$BOOK'")" == "silk-trench" ]] \
  && pass "and the public address was left alone" || fail "the slug is now '$(rows "select slug from public.books where id='$BOOK'")'"

# Restoring is a destructive edit too, so it records where it came from.
AFTER=$(curl -s --noproxy '*' -H "Cookie: $AC" "$A/api/books/$BOOK/versions" \
  | python3 -c 'import json,sys;print("|".join(str(v["label"]) for v in json.load(sys.stdin)["versions"]))')
echo "$AFTER" | grep -q 'Before restoring' \
  && pass "and left a way back out of the restore itself" || fail "versions after restore: $AFTER"

LIST_FOREIGN=$(status -H "Cookie: $IC" "$A/api/books/$BOOK/versions")
RESTORE_FOREIGN=$(status -X POST -H "Cookie: $IC" "$A/api/books/$BOOK/versions/$PUBLISHED_VERSION/restore")
[[ "$LIST_FOREIGN" == "403" && "$RESTORE_FOREIGN" == "403" ]] \
  && pass "somebody else can neither read nor roll back this history ($LIST_FOREIGN/$RESTORE_FOREIGN)" \
  || fail "a stranger got $LIST_FOREIGN listing and $RESTORE_FOREIGN restoring"

echo
echo "==> a reviewer who has no account"
LINK=$(curl -s --noproxy '*' -X POST "$A/api/books/$BOOK/review-links" -H "Cookie: $AC" \
  -H 'content-type: application/json' -d '{"label":"Client"}')
REVIEW_PATH=$(echo "$LINK" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("path",""))' 2>/dev/null || true)
[[ "$REVIEW_PATH" == /review/* ]] && pass "the author gets a review link ($REVIEW_PATH)" \
  || fail "creating a review link answered: $(echo "$LINK" | head -c 200)"
TOKEN=${REVIEW_PATH#/review/}

# No cookie at all from here: this is somebody who has never signed in.
# A confidential draft: a passcode gate and a lead webhook, both of which live
# in `books.settings` and neither of which a reviewer may see.
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -c \"
  UPDATE public.books SET settings = settings
    || '{\\\"webhookUrl\\\":\\\"https://hooks.example.com/SECRET-HOOK\\\"}'::jsonb
    || jsonb_build_object('gating', (settings->'gating') || '{\\\"type\\\":\\\"passcode\\\",\\\"passcode\\\":\\\"Q3-NDA-2026\\\"}'::jsonb)
  WHERE id = '$BOOK';\"" >/dev/null

DRAFT=$(curl -s --noproxy '*' "$A/api/review/$TOKEN")
echo "$DRAFT" | grep -q 'The Silk Trench' \
  && pass "an anonymous visitor can open the draft" || fail "the review API answered: $(echo "$DRAFT" | head -c 200)"

# `gating.passcode` is the plaintext value /api/books/unlock compares against,
# so handing it to a reviewer hands over every gated page through the front
# door — and revoking the link afterwards does not take it back. `webhookUrl` is
# an unauthenticated capability URL into the author's CRM.
if echo "$DRAFT" | grep -q 'Q3-NDA-2026\|SECRET-HOOK\|webhookUrl\|passcode'; then
  fail "the draft response leaks the gate passcode or the lead webhook"
else
  pass "and gets none of the edition's settings — no passcode, no webhook"
fi
[[ "$(status "$A$REVIEW_PATH")" == "200" ]] && pass "and the page renders" \
  || fail "the review page returned $(status "$A$REVIEW_PATH")"
curl -s --noproxy '*' "$A$REVIEW_PATH" | grep -qi 'noindex' \
  && pass "with noindex, since the URL is the credential" || fail "the review page is indexable"

POSTED=$(curl -s --noproxy '*' -X POST "$A/api/review/$TOKEN/comments" \
  -H 'content-type: application/json' \
  -d '{"pageNumber":2,"authorName":"Marta","body":"The trench on page 2 needs a wider crop."}' \
  -w '\n%{http_code}')
[[ "$(echo "$POSTED" | tail -1)" == "201" ]] && pass "and leave a comment ($(echo "$POSTED" | tail -1))" \
  || fail "posting a comment answered: $POSTED"

BAD=$(status -X POST "$A/api/review/$TOKEN/comments" -H 'content-type: application/json' -d '{"pageNumber":2}')
[[ "$BAD" == "400" ]] && pass "a comment with no name or body is refused ($BAD)" \
  || fail "an empty comment returned $BAD"

SEEN=$(curl -s --noproxy '*' -H "Cookie: $AC" "$A/api/books/$BOOK/comments")
COMMENT_ID=$(echo "$SEEN" | python3 -c 'import json,sys;c=json.load(sys.stdin)["comments"];print(c[0]["id"] if c else "")' 2>/dev/null || true)
echo "$SEEN" | grep -q 'wider crop' && pass "the author sees it" || fail "the author's comments: $(echo "$SEEN" | head -c 200)"

RESOLVED=$(status -X PATCH "$A/api/books/$BOOK/comments/$COMMENT_ID" -H "Cookie: $AC" \
  -H 'content-type: application/json' -d '{"resolved":true}')
[[ "$RESOLVED" == "200" ]] && pass "and can resolve it ($RESOLVED)" || fail "resolving returned $RESOLVED"
[[ -n "$(rows "select resolved_at from public.book_comments where id='$COMMENT_ID'")" ]] \
  && pass "which is recorded" || fail "resolved_at is still null"

# A reviewer holds a capability, not an identity: no listing, no resolving.
[[ "$(status "$A/api/books/$BOOK/comments")" == "401" ]] \
  && pass "an anonymous caller cannot list the author's comments" \
  || fail "listing comments anonymously returned $(status "$A/api/books/$BOOK/comments")"
[[ "$(status -H "Cookie: $IC" "$A/api/books/$BOOK/review-links")" == "403" ]] \
  && pass "and another author cannot see the links" \
  || fail "a stranger listing links got $(status -H "Cookie: $IC" "$A/api/books/$BOOK/review-links")"

# A second reviewer, with their own link, must not read the first one's notes.
LINK2=$(curl -s --noproxy '*' -X POST "$A/api/books/$BOOK/review-links" -H "Cookie: $AC" \
  -H 'content-type: application/json' -d '{"label":"Other client"}')
TOKEN2=$(echo "$LINK2" | python3 -c 'import json,sys;print(json.load(sys.stdin)["path"].rsplit("/",1)[-1])')
OTHER=$(curl -s --noproxy '*' "$A/api/review/$TOKEN2")
if echo "$OTHER" | grep -q 'wider crop'; then
  fail "a second review link shows the first reviewer's comments"
else
  pass "a second link sees its own thread, not the first reviewer's"
fi
# The author still sees everything, which is the point of the author's view.
curl -s --noproxy '*' -H "Cookie: $AC" "$A/api/books/$BOOK/comments" | grep -q 'wider crop' \
  && pass "while the author sees them all" || fail "the author lost sight of a comment"

LINK_ID=$(echo "$LINK" | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')
[[ "$(status -X DELETE "$A/api/books/$BOOK/review-links/$LINK_ID" -H "Cookie: $AC")" == "200" ]] \
  && pass "the link revokes" || fail "revoking the link failed"
[[ "$(status "$A/api/review/$TOKEN")" == "404" ]] && pass "and stops opening at once" \
  || fail "a revoked link still answered $(status "$A/api/review/$TOKEN")"
[[ "$(status -X POST "$A/api/review/$TOKEN/comments" -H 'content-type: application/json' -d '{"pageNumber":1,"authorName":"Marta","body":"still here?"}')" == "404" ]] \
  && pass "and takes no more comments" || fail "a revoked link still accepted a comment"
[[ "$(status "$A/api/review/not-a-real-token")" == "404" ]] \
  && pass "a token that never existed answers the same way" \
  || fail "an unknown token returned $(status "$A/api/review/not-a-real-token")"

echo
echo "==> an asset upload, and the one profile field an author may set"
ASSET=$(mktemp /tmp/qlico-asset-XXXXXX.png)
python3 -c "import base64,sys;open(sys.argv[1],'wb').write(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='))" "$ASSET"

UP=$(curl -s --noproxy '*' -X POST "$A/api/upload" -H "Cookie: $AC" \
  -F "bookId=$BOOK" -F "file=@$ASSET;type=image/png;filename=a../../../x")
ASSET_URL=$(echo "$UP" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("url",""))' 2>/dev/null || true)
# The filename is client-supplied and used to become part of the storage key —
# "a../../../x" made the extension "/x", two extra path segments. It must land
# under this book's own assets prefix with a plain extension.
if [[ "$ASSET_URL" == *"books/$BOOK/assets/"* ]] && [[ "$ASSET_URL" =~ \.[a-z0-9]{1,8}$ ]]; then
  pass "the asset is under its own book with a sanitised extension"
else
  fail "upload answered: $UP"
fi
[[ "$(status "$ASSET_URL")" == "200" ]] && pass "and it reads back at that URL" \
  || fail "the asset URL returned $(status "$ASSET_URL")"

FOREIGN=$(status -X POST "$A/api/upload" -H "Cookie: $IC" -F "bookId=$BOOK" -F "file=@$ASSET;type=image/png")
[[ "$FOREIGN" == "403" ]] && pass "uploading into somebody else's edition is refused ($FOREIGN)" \
  || fail "a stranger's upload returned $FOREIGN"

SVG=$(status -X POST "$A/api/upload" -H "Cookie: $AC" -F "bookId=$BOOK" -F "file=@$ASSET;type=image/svg+xml")
[[ "$SVG" == "415" ]] && pass "SVG is refused, since it can carry script ($SVG)" \
  || fail "an SVG upload returned $SVG"
rm -f "$ASSET"

PREF=$(status -X POST "$A/api/account/preferences" -H "Cookie: $AC" \
  -H 'content-type: application/json' -d '{"digestOptOut":true}')
[[ "$PREF" == "200" ]] && pass "the digest opt-out saves ($PREF)" || fail "preferences returned $PREF"
[[ "$(rows "select digest_opt_out from public.profiles where id='$AUTHOR'")" == "t" ]] \
  && pass "and it is on the profile" || fail "digest_opt_out is '$(rows "select digest_opt_out from public.profiles where id='$AUTHOR'")'"

# `profiles` also carries `plan` and `status`, and 004 grants end users no
# UPDATE policy at all, so this route's one-field allowlist is the only way in.
# A Zod object strips unknown keys rather than rejecting them, so the request
# succeeds — what matters is that the extra field reaches nothing.
PROMOTE=$(status -X POST "$A/api/account/preferences" -H "Cookie: $AC" \
  -H 'content-type: application/json' -d '{"digestOptOut":false,"plan":"ltd_tier3"}')
[[ "$PROMOTE" == "200" ]] && pass "a body carrying a plan is accepted and the plan ignored ($PROMOTE)" \
  || fail "preferences with an extra field returned $PROMOTE"
[[ "$(rows "select plan from public.profiles where id='$AUTHOR'")" == "free" ]] \
  && pass "the plan is untouched" || fail "the plan is now '$(rows "select plan from public.profiles where id='$AUTHOR'")'"
BAD_PREF=$(status -X POST "$A/api/account/preferences" -H "Cookie: $AC" \
  -H 'content-type: application/json' -d '{"digestOptOut":"yes"}')
[[ "$BAD_PREF" == "400" ]] && pass "a wrongly-typed value is refused ($BAD_PREF)" \
  || fail "a string where a boolean belongs returned $BAD_PREF"

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
echo "==> what the code buys"
curl -s -o /dev/null --noproxy '*' -X PATCH "$A/api/books/$BOOK" -H "Cookie: $AC" \
  -H 'content-type: application/json' -d "{\"settings\":$GATED}"
PAID_HTML=$(curl -s --noproxy '*' "$A/book/silk-trench")
echo "$PAID_HTML" | grep -q 'Read the rest' \
  && pass "the same settings now run the gate" || fail "a redeemed author's gate did not run"
echo "$PAID_HTML" | grep -q 'Hand-tailored in Milan' \
  && fail "the gated page's text is in the HTML anyway — the gate is decoration" \
  || pass "and the text behind it is not in the HTML"

EXPORT_PAID=$(curl -s --noproxy '*' -H "Cookie: $AC" "$A/api/analytics/silk-trench/export?kind=events" -w '\n%{http_code}')
EXPORT_CODE=$(echo "$EXPORT_PAID" | tail -1)
[[ "$EXPORT_CODE" == "200" ]] && pass "CSV export works on the redeemed plan ($EXPORT_CODE)" \
  || fail "CSV export on tier 2 returned $EXPORT_CODE"

# 180 days on tier 2, so the same 60-day-old reader is now inside the window.
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -c \"
  INSERT INTO public.events (book_id, session_id, event_type, page_number, created_at)
  VALUES ('$BOOK','recent','book_open',1, now() - interval '5 days'),
         ('$BOOK','ancient','book_open',1, now() - interval '60 days');\"" >/dev/null
PWINDOW=$(curl -s --noproxy '*' -H "Cookie: $AC" "$A/api/analytics/silk-trench?range=365d")
PSEEN=$(echo "$PWINDOW" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["summary"]["uniqueSessions"], d["window"]["days"])' 2>/dev/null || echo 'parse-failed')
[[ "$PSEEN" == "2 180" ]] \
  && pass "the window opens to 180 days and both readers are in it ($PSEEN)" \
  || fail "the tier-2 window reported '$PSEEN', expected '2 180'"

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
