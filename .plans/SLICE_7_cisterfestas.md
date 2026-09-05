# SLICE_7 — two new sources: festasearraiais + cisterfestas

Pedro's live test case: **Festas da Tremoceira** (Tremoceira, freguesia de
Pedreiras, Porto de Mós) runs **4–7 September 2026** — confirmed on O
Portomosense (2026-09-02) and Cister FM. Missing from every current source
and from festasearraiais (has 2023+2024 only).

## Gap analysis — why one source isn't enough

| Source | Tremoceira 2026? | Why add anyway |
| --- | --- | --- |
| festasearraiais.pt | **no** (2023/2024 only) | 4103 event pages, daily lastmod, Leiria-wide |
| Cister FM (cister.fm) | **yes** — live now | only live source for Porto de Mós freguesia festas |

They're complementary, not redundant: festasearraiais = breadth (all 18
Leiria municipalities), Cister FM = depth (Alcobaça + Porto de Mós
freguesias, updated when radio advertises each festa). Verified live this
session: 27 festasearraiais Leiria events in September (8 currently
server-rendered) vs our 131 events for the whole month; Cister's listing
carries ~50 live festas with date+place on every card.

**Also checked and ruled out (dead ends, don't revisit):**
- Viral Agenda CCRSJT promoter page + Tremoceira place page — stale since
  2023 (the current VA district scrapes already cover VA; the gap is
  elsewhere).
- Município de Porto de Mós agenda (visite.portodemos.pt
  `/fazer/negocios-e-eventos/agenda`) — no Tremoceira.
- Cister FM WP REST — `itsec_rest_api_access_restricted` 401 (Kadence
  Security blocks /wp-json/). HTML listing only.
- festasearraiais `/api/events` JSON — clean JSON, but robots.txt
  disallows `/api/`; we honor that. Sitemap + JSON-LD pages instead.
- O Portomosense WP REST — works (`X-WP-Total: 5386`, search + tag RSS),
  but it's general news; festa posts are sparse. Phase 2 if Porto de Mós
  precision still matters.

## Source A — festasearraiais (breadth)

- Discovery: `sitemap.xml` → `sitemap-eventos.xml` (+`-2.xml`) → 4103 URLs,
  each with `<lastmod>` (regenerated daily). Slug tail = stable id
  (`...-5574`).
- Detail pages fully server-rendered, schema.org **JSON-LD `Event`**:
  name/description/startDate/endDate/image/url/sameAs, location
  (name, streetAddress, addressLocality, addressRegion, **geo lat/lng**),
  performer[], organizer. No categories in JSON-LD → deterministic title
  heuristic: `/^feira/i`, `/festival/i`, `/mercado/i` → Mercados e Feiras /
  Festivais; default `Tradição` (canonicalized at ingest).
- Incremental state: `state/festasearraiais.json` = `{ maxLastmod,
  seenIds[] }` (gitignored); first run = all 4103; steady state = a handful
  of detail fetches. Fingerprint re-ingest = no-op anyway.
- Dates ISO UTC; date-only startDate → 00:00 Lisbon
  (`toEpochInLisbon`); endDate is **exclusive** (site copy "(4 dias)" for
  30 Aug→2 Sep = inclusive 30 Aug–1 Sep) → inclusive end = endDate−1 day
  23:59 Lisbon; no endDate → same as start.
- Venue = `location.name` (e.g. "Tremoceira, Pedreiras") fallback
  addressLocality; city = addressLocality; gate =
  `isLeiriaDistrict(addressLocality || location.name)`.
- Politeness: `defaultFetchText` (curl fallback), 350–650 ms jitter,
  `MAX_REQUESTS = 400` per run cap.

## Source B — cisterfestas (depth, catches Tremoceira 2026)

- Discovery: `cister.fm/salao-de-festas/` + `/page/N/` while a page yields
  novel URLs (observed 50/page, ≥40 pages of history); filter to
  `/salaodefestas/` links only.
- Detail pages: server-rendered, structured card in body:
  `DATA EVENTO <raw date range>` / `LOCAL <venue/place>` (plus
  meta og fields, no JSON-LD Event).
- `dateText` = raw `DATA EVENTO` string ("4 a 7 de Setembro"); year
  inference when absent: try current year, else +1 (event must be ≥ now −
  a small tolerance, else keep dateText-only). LOCAL → venueName; city via
  `isLeiriaDistrict` + venue-name evidence, same as shotgun's per-event
  district decision.
- No categories → default `Festivais`/`Tradição` heuristic (title-based,
  same canonicalization).
- Politeness: same delays; request cap ~ listing pages ≤ 45 + detail fetch
  only for NEW urls (first run ≈ 2000 detail pages max, steady state =
  handful).

## Shared pre-fix (required): past-guard end-awareness

`upsertEvent` skips any event with `startAt < now` — that silently drops
**ongoing multi-day festas**. Vestiaria (28 Aug–8 Sep) is running today and
would be skipped; Tremoceira (4–7 Sep) hits the same trap mid-festa. Both
new sources would lose the exact events Pedro cares about.

- Change the guard to skip only when the event has fully ended:
  `(raw.endAt ?? raw.startAt) < now`.
- Ongoing multi-day events (festas, cinema weeks, festivals) stop being
  dropped; nothing else changes. Unit-test both guards.

## Files

- `apps/server/src/scraper/festasearraiais.ts` + `.test.ts`
- `apps/server/src/scraper/cisterfestas.ts` + `.test.ts`
- `apps/server/src/scraper/state/` (gitignored JSON state files)
- `apps/server/src/ingest-url.ts` — extend to festasearraiais (+ optionally
  cisterfestas) detail URLs for manual paste
- `apps/server/src/scraper/index.ts` — register both sources
- `apps/server/src/scraper/ingest.ts` — end-aware past guard
- `.plans/SLICE_7_cisterfestas.md` — this file

## Verification (acceptance)

1. `bun test` green (new + existing suites).
2. Cold run both sources via `bun run src/scraper/run.ts <id>`:
   - festasearraiais → Leiria-district subset of 4103 (expect hundreds in
     the Sept window; baseline 131 today)
   - cisterfestas → ~50-card listing scanned, Alcobaça + Porto de Mós
     festas land; **Festas da Tremoceira, 4–7 Sep, Tremoceira (Pedreiras)
     row exists**
3. `bun run src/scraper/purge.ts` → only expired rows removed.
4. Re-run both → `new: 0` (state + fingerprint idempotence).
5. Ongoing multi-day festas (Vestiaria 28 Aug–8 Sep) ingest instead of
   being skipped.
6. UI/API shows Tremoceira in the September calendar; 07:00 cron picks up
   both sources with zero prompt changes (run.ts + index.ts registration
   is all they need).
