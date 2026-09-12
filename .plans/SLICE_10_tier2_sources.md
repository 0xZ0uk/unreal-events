# SLICE_10 — Tier 2 sources, re-assessed

SLICE_9 parked a list of "Tier 2" sources: real events, but each had a known
catch. This slice re-probes each one live and decides build / defer / drop.
Recon date: **2026-09-12**, all evidence from live HTTP (no vendor docs).

## Verdicts

| Source | Catch from SLICE_9 | What live recon says | Verdict |
| --- | --- | --- | --- |
| **nocartaz.pt** | `/eventos/` index JS-driven | `/distrito/leiria/` is **Astro server-rendered**: 203 `article.event-card` with `data-id`/`data-concelho`/`data-starts-at`/`data-venue`/`data-genre`, no pagination. Details are JSON-LD `Event`/`Festival`/`MusicEvent`. Hub claims 273 events / 11 concelhos but renders 203 — the hub caps its own list. | **BUILT** (this slice) |
| turismodocentro.pt | open `wp/v2/event`, ~24 Leiria events all-time | 64 events all-time; `county_mirror` maps to county posts. The "3 touch the district" read below came from filtering the `destination_mirror` region term — gating on county ids gives **19 upcoming in-district**. | **BUILT** (Round 2) |
| gazetadascaldas.pt/agenda/ | HTML agenda | `/agenda/` is a news hub: article cards carry their *publication* date, and an article's JSON-LD has only `BreadcrumbList`/`WebSite`/`WebPage` — no `Event`. WP `types` has no event CPT; `/wp-json/tribe/events/v1/` → 404. Event dates exist only in prose. | **DROP** (Round 2) — no data path, not worth guessing |
| Figueiró dos Vinhos | Joomla `com_djevents` + `listar-agenda-rss` | `/index.php/listar-agenda-rss` is HTML (not RSS): **6** `djev_item` blocks, 6 distinct dated events (the "13 blocks / mostly duplicates" read below was wrong). Long-form PT dates, some with clock times. | **BUILT** (Round 2) |
| aondevamos.pt | district filters via `admin-ajax` | HTTP 429 on recon; needs a slow, single-request probe before any decision. | **DEFER** |
| uniaodeleiria.pt | UD Leiria fixtures, `Desporto` category | `/calendario/` is a **league standings table** (21 `<tr>`, 514 Elementor widgets, no iframes) — no fixtures on it. Fixtures must come from another route/fed widget. | **DEFER** |
| Bombarral | agenda path not located | `/agenda` is a client-rendered SPA: `<tr>`-less, no `buildId`, no `/api`/`.json` asset in the shell. `/turismo/eventos` is empty. | **DEFER** — needs the JS bundle mined |
| Castanheira de Pêra | agenda path not located | `/PT/agenda` is a 200 KB calendar shell with no event links and one date string in the markup; the site's agenda ships as monthly posts. | **DEFER** |

Three of the eight earned an adapter (nocartaz in this pass; turismodocentro and
Figueiró in Round 2, after re-probing them with a county-id gate instead of a
region term). The bigger Round 2 win was not a source at all: the district gate
itself was wrong (`district.ts` was missing Ansião and Peniche), which had been
silently dropping two concelhos from every gated source. The rest are either
tiny, silently stale, or serve their calendar out of client-side JS we cannot
see in HTML.

## nocartaz — what shipped

`apps/server/src/scraper/nocartaz.ts`

- **One listing request** (`/distrito/leiria/`) carries the roster and enough
  attributes to render a card without ever opening the detail page.
- **Detail pages are cached, not refetched** (`state/nocartaz.json`, keyed by the
  hub's own `data-id`). A cached detail is reused verbatim, so re-runs neither
  re-fetch 200 pages nor flip a card between "rich" and "card-only" data.
  The cache is pruned to the ids the listing still shows, so it tracks the live
  roster instead of growing forever. Budget: `MAX_DETAIL_REQUESTS = 400`.
- **District gate runs on the resolved locality**, never on the hub route. The
  Leiria hub regularly files rows from outside the district — Bandsintown and
  3cket gigs arrive with an empty `data-concelho` (and a placeholder venue
  "Portugal" on the detail page), e.g. *Vengeful Fate @ Sociedade Recreativa
  Operária de Santarém*. Those rows resolve to no locality and are dropped.
- **Timestamps**: `data-starts-at` mixes offset-suffixed (`+01:00`) and bare
  wall-clock strings; JSON-LD `startDate` is bare. Offset form → `Date.parse`,
  bare form → `toEpochInLisbon`. A bare string parsed as host-local time would
  shift every card by the host's timezone.
- **`endDate` is never invented.** The hub's JSON-LD omits it even for a
  multi-day Festival ("Festas de Nossa Senhora da Nazaré… de 4 a 13 de setembro")
  — the range exists only in prose. Cards ship with `endAt: null`.
- **Genres** map onto canonical labels (`rock-pop` → Concertos, `literatura` →
  Literatura, `eletroacustica`/`eletronica` → Clubbing, `outro` → Outros);
  unmapped slugs are dropped rather than leaking into the filter UI as
  "surf-de-camarao".

### Verified

- `bun run check-types` clean; `bun test src/scraper/` → **327 pass / 0 fail**
  (29 new tests in `nocartaz.test.ts`, run against real captured fixtures in
  `__fixtures__/nocartaz-*.html`).
- Live run against `local.db` — see run log / PR description.

### Notes for the next person

- The hub is a *venue-hub aggregator*: `data-venue` names the upstream feed
  (`tjls-leiria`, `cm-mgrande-eventos`, `folio-festival`, `ticketline`,
  `bandsintown-leiria`, `3cket-leiria`, …). Expect overlap with sources already
  registered; the fingerprint/identity pass is what stops it becoming duplicates.
- `/salas/<venue-slug>/` pages exist per venue if we ever want per-venue scoping
  instead of per-district.
- `robots.txt` disallows `/api/`, `/events.json`, `/events-rest.json`,
  `/search-index.json` — this adapter uses only the public HTML routes.

## Round 2 (2026-09-12, later) — sources 1–3 revisited, district gate fixed

Pedro picked sources 1–3. Re-probing them with a better filter flipped two
verdicts and exposed a scope bug that had been silently starving the district.

### District gate was wrong (the real find)

`district.ts` listed **14** municipalities. The Distrito de Leiria has **16**:
**Ansião** and **Peniche** were missing. Every gated source (caldas, nocartaz,
municipal, viralagenda, …) was dropping Peniche/Ansião rows — the DB held
**zero** events for either concelho. Fixed (`district.ts`, `district.test.ts`).

Effect of the fix on nocartaz alone: listing rows in scope 172 → **180**, +9 new
events, and **Peniche 0 → 8** live cards (incl. *MEO Rip Curl Pro Portugal*).

### Built

- **`turismodocentro.ts`** — WP REST (`wp/v2/event` + `wp/v2/county_mirror`).
  64 events all-time; gate on the event's `county_mirror` ids resolved to
  concelho names through `isInScope` (injected `isLeiriaDistrict`). The first
  in-district concelho becomes both `venueName` and `city` (the API has no venue
  field; region-wide bundles like *World Wellness Weekend* are placed on their
  first tagged in-district concelho and counted in `multiConcelho`).
  Dates are **day-precision only** (`start_date`/`end_date` are local midnight
  as UTC seconds) → calendar parts read in UTC, rebuilt to Lisbon midnight, and
  `dateText` stays `null`. Roster fetch failure fails **closed**: without the
  county map nothing can be gated, so the run reports the failure and emits 0.
  Run: **19 found / 19 new**.
- **`figueiro.ts`** — com_djevents HTML at `/index.php/listar-agenda-rss`
  (server-rendered, one request, 6 `djev_item` blocks). Long-form PT dates
  ("Sábado, 19 setembro 2026 at 18:30") parsed to real epochs; a `to` without a
  clock time ends the day (`23:59`), a `from` with no time and no `to` also ends
  the day (day precision), a timed row with no `to` ships `endAt: null` rather
  than an invented duration. Municipal agenda carries no venue → concelho as
  `venueName`. Category "Agenda" is dropped (it is the whole agenda, not a
  category). Run: **6 found / 6 new**.

### Dropped

- **`gazetadascaldas.pt/agenda/`** — final verdict **DROP**. The hub is the
  paper's news archive (cards are articles with their *publication* date), and a
  sample article's JSON-LD carries only `BreadcrumbList`/`WebSite`/`WebPage` —
  no `Event`, no times, no venue. Event dates live inside article prose, so any
  adapter would be guessing. Revisit only if a real data path appears.

### First-pass verdicts corrected

- turismodocentro was marked DROP ("3 events touch the district"): that read
  came from filtering on the `destination_mirror` region term. Gating on county
  ids yields 64 events / **19 upcoming in-district**. Verdict: BUILT.
- Figueiró was marked DEFER ("13 blocks, mostly duplicates of one event"): the
  listing is **6 distinct items**, all dated, 6 rows shipped.

### Verified

- `bun run check-types` clean; `bun test src/` → **373 pass / 0 fail**.
- `local.db` → Turso publish: **585 events / 524 upcoming / 224 venues**
  (before this round: 557 / 505 / 222).
- Live `findleiria.vercel.app`: **492 cards** (was 473), collection "hoje,
  05:55"; the CONCELHO filter now shows **Peniche (8)** and
  **Figueiró dos Vinhos (4)** — both were absent before. Spot-checked
  "18:30 · Figueiró Colorido | Caminhada Solidária · Figueiró dos Vinhos" —
  the parsed clock time renders.
- `municipal` still fails (Marinha Grande pagination → HTTP 403); unchanged.
