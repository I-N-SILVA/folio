# QLICO — MVP scope

Written 4 September 2026, after cutting commerce and auditing what was left.
The companion documents say what was wrong (`product-proof-2026-09.md`) and what
to build (`editor-redesign-spec.md`). This one says what the product **is**, and
what to stop doing.

---

## §1 — The product, in one sentence

**Send a PDF. See who actually read it.**

Everything that serves that sentence stays. Everything that doesn't is either
cut or has to earn its place with a real user asking for it. That test is what
this document applies.

The loop, end to end, and nothing else is load-bearing:

1. Drop in a PDF, or start from a gallery edition.
2. QLICO finds the products, links and callouts and offers to make them
   interactive. One click, one undo.
3. Publish. The link is in your hand before the dialog closes.
4. Send it to one person.
5. Insights fills in, and a digest brings you back next week.

---

## §2 — What was cut, and why

Each of these failed the same test: it did not do what it said.

| Cut | What it actually did |
|---|---|
| Checkout | Collected a card number, waited 1.8s, invented an order number, confirmed a sale that never happened |
| The cart | Four paths fed a bag whose only destination was that checkout |
| `ButtonBlock` magic hrefs | `#cart` / `#buy` silently added an item at an invented $120 |
| Language picker | `getTranslation` was imported and never called — picking a language moved a checkmark |
| Review drawer | Took a client's typed feedback into React state and dropped it on refresh; the author never saw it |
| Social Teaser Studio | Built a download link, never clicked it, then said "Downloaded!" |

**The pattern is worth more than the list.** Four of the six had tests, and every
one of those tests reimplemented the logic inside the test file and asserted
against its own copy. Green suites, dead features. Two came from a single commit
that shipped five features at once; two of that five did nothing.

Two habits fall out of it, and they are cheaper than any of the fixes:

- **A test that does not import the shipped path is not a test.** If the test
  file defines `addCommentHelper`, it is testing `addCommentHelper`.
- **Grep for unimported files as a habit** — `HANDOVER.md` §5 already says this,
  and it found four more this session. Typecheck, lint and tests are all blind
  to a component nothing imports.

---

## §3 — What stays, and what it is for

**The spine — do not touch without a reason**

- PDF import, and the auto-detect step that follows it. This is the aha.
- The editor: one insert surface, flow and canvas layouts, spreads.
- Publish → share link → read → Insights → weekly digest. The only loop that
  compounds.
- The email gate. It is what makes a read worth something.
- `/gallery`. Six readable editions are the cheapest proof the product works.

**Earning its keep, quietly**

- Passcode and allowed-domain gating — real, enforced server-side, and the
  reason an investor letter or a board pack can use this at all.
- Offline kiosk export — genuinely builds and saves a standalone file.
- QR studio — works, though it depends on `api.qrserver.com`, a third party with
  no contract. Worth knowing before a customer prints one on a menu.
- Narration, page-turn sound, paper physics, the fore-edge. Cheap, on-brand, and
  behind *More* where they cost a reader nothing.

**On probation — no user has asked for these**

Not cut, because they work. But if any of them needs maintenance before a
customer mentions it, cut it instead:

- Webhooks on lead capture.
- The embed route.
- The filmstrip scrubber.

---

## §4 — Stop building. This is the part that matters.

There is more product here than there is evidence. The honest constraint is not
engineering capacity, it is that **nobody has validated any of it**:

- Pricing is unvalidated. $19 Pro undercuts Issuu, Flipsnack and FlippingBook —
  which is a decision, but nobody has tested whether it reads as cheap or as
  unserious.
- There are no design partners, so every feature priority is a guess.
- The digest — the entire retention half of the loop — **has never been sent.**
  It is written, scheduled, idempotent and typechecked, and no human has
  received one.

Before the next feature, in this order:

1. **Send the digest by hand.** `curl -H "Authorization: Bearer $CRON_SECRET"`,
   then read the email in a real inbox. Until that happens, retention is
   theoretical.
2. **Apply the pending migration** (`009_post_audit_features.sql`). Everything
   degrades silently without it — grep production logs for `is missing`.
3. **Publish the six gallery editions and send them to ten people** who fit an
   ICP. Not for feedback on the gallery: to find out which of the six they
   recognise as their own problem. That answers the positioning question the
   audit could not.
4. **Watch five people import a PDF** without helping them. Where they stop is
   the roadmap. Everything in `editor-redesign-spec.md` §9 is a guess until then.

---

## §5 — If the next thing has to be a feature

The three ranked here have since been built — live data server-side, edition
styles on fonts that are actually loaded, and save-as-template — along with
multi-select, a cross-edition clipboard and a draggable focal point. See
`editor-redesign-spec.md` §9 for what shipped and what did not.

**That does not change §4.** Building three more features is exactly what §4
says to stop doing, and the reason they were built anyway is that each one was
either broken or absent in a way a customer would hit in the first hour — not
because the evidence arrived. It has not. Nobody has sent the digest, nobody
has watched five people import a PDF, and pricing is still a guess.

What is left in the spec's §9 waits for a person to ask for it. The next thing
is §4, in the order it is written.

**One thing worth carrying forward.** The typography work found that eight font
families were named across the theme presets and the studio's "curated
pairings" and none of them was ever loaded — so four buttons that claimed to
change the type produced identical output, and had for as long as they had
existed. That is the same failure as the six cut features in §2, found the same
way: by checking what the shipped path actually does rather than reading the
code that describes it. Chromium is available in this repo's dev environment;
`getComputedStyle` on a real built page answers in two minutes what source
reading cannot answer at all.
