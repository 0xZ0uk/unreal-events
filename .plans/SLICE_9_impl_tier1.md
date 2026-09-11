# SLICE_9 Tier 1 — implementation contract (recon 2026-09-11)

Goal: add 4 new source ids to the registry, zero regressions, zero duplicate events.
Existing ids (untouched): leiriagenda, cmleiriarss, bol, eventbrite, viralagenda,
ticketline, festasearraiais, cisterfestas, shotgun.

## Shared conventions (same as cisterfestas / festasearraiais)

- Repo `apps/server`. Source module `src/scraper/<id>.ts`, tests `<id>.test.ts`,
  fixtures `src/scraper/__fixtures__/`. `bun test` from `apps/server`.
- `export async function scrape(deps: ScrapeDeps = {...}, isInScope = () => true)` →
  `{ events: RawEvent[], failures, firstError, pagesFetched, discovered }`.
- Pure parse helpers exported for fixtures-based tests (no network in unit tests).
- HTTP: `defaultFetchText` from `./http`. State: `loadState/saveState` from `./state`
  (gitignored `state/<id>.json`). Epochs: `toEpochInLisbon` from `./fingerprint`
  (wall-clock Lisbon; sources put local time in a `Z` field — strip the Z).
- Place: `normalizePlace` / `isLeiriaDistrict` from `./district`.
- Past events: return `null` — never roll a date forward to invent a future event.
  No machine-readable date ⇒ `startAt: null` + `dateText` raw string (ingest pins a
  placeholder; that is the existing convention, not a duplicate risk).
- Faithful literals only: title / venueName / city / startAt exactly as the source
  states them. Never invent a venue. Unknown venue ⇒ municipality name (vague venue,
  which isVagueVenue already classifies as city-level).
- Do not edit `index.ts` (registry is wired centrally), existing sources, or their tests.

## (1) municipal wm-smile agendas — `municipal.ts` (8 concelhos, one parser)

Platform signature: `<div id="event_detail_<N>" class="widget event_detail">`, plus a
`.atc_event` block with machine-readable fields:

```html
<var class="atc_date_start">2026-10-01 09:30:00</var>
<var class="atc_date_end">2026-10-01 18:00:00</var>
<var class="atc_timezone">Europe/Lisbon</var>
<var class="atc_title">…</var>
<var class="atc_location">…</var>   <!-- sometimes the placeholder "Evento" -->
<var class="atc_organizer">…</var>
<div class="location widget_field"><div class="widget_label">Local:</div>…VENUE…</div>
```

Note: `atc_date_start`/`atc_date_end` are LOCAL wall-clock with a Europe/Lisbon
timezone var → parse with `toEpochInLisbon`, do not treat as UTC.
Dirty-data guard: when `atc_date_start`'s clock time equals the page's
`published_at`/`last_modified_date` clock time (PGG leaves the default), the time was
never set → use date-only (00:00) instead of the publish timestamp.
`meta[name=content_date]` is the fallback start; `og:title` is the title fallback;
`og:image` the image; page `<h1 class="pageTitle">` the last-resort title.

| id suffix | host | listing | paginator | max pages | venue source |
|---|---|---|---|---|---|
| marinha-grande | www.cm-mgrande.pt | /comunicar/eventos/todos-os-eventos | events_list_13_page | 44 | none → concelho (date-only, no atc) |
| nazare | www.cm-nazare.pt | /visitar/todos-os-eventos | events_list_73_page | 71 | `Local:` ✓ |
| batalha | www.cm-batalha.pt | /municipe/comunicacao/agenda-cultural | – | 1 | `Local:` ✓ |
| alvaiazere | www.cm-alvaiazere.pt | /municipio/comunicacao/eventos | events_list_57_page | 14 | placeholder → concelho |
| ansiao | www.cm-ansiao.pt | /concelho/comunicacao/eventos | – | 1 | `Local:` ✓ |
| peniche | www.cm-peniche.pt | /visitar/agenda-de-eventos/todos-os-eventos | events_list_69_page | 24 | `Local:` ✓ (long, `|`-separated) |
| pedrogao-grande | www.cm-pedrogaogrande.pt | /viver/cultura/agenda-de-eventos | – | 1 | placeholder → concelho |

Pombal dropped: its "agenda" is a `folders_list` document tree, no EventDetail widget.
Detail URL patterns: `<listing>/evento/<slug>`. State: `{ seen: string[] }` of detail
URLs; listings walked up to STEADY_PAGES=3 (stop early on a page with zero novel URLs;
first run crawls all pages to the caps above). Every event is in-district by
construction (city = concelho from the site config) — still run `normalizePlace`.

## (2) obidos-agenda — `obidos.ts`

`https://agenda.obidos.pt/etn-sitemap.xml` = ~95 event URLs, `<lastmod>` refreshed
daily → watermark discovery exactly like `festasearraiais`. Detail `/evento/<slug>/`
is server-rendered (REST `eventin/v2` is 401 — do not use it). City = Óbidos.

## (3) regiaoleiria — `regiaoleiria.ts` (JSON, cheapest)

REST lives under `/api/wp-json/`:
- `GET /api/wp-json/user/events/get-by-month?month=<m>&year=<y>` → dated rows
  (~256 rows / 114 unique posts in Sept 2026); recurring events appear once per date.
- `GET /api/wp-json/wp/v2/cartaz` → CPT posts (6324) with `localidade` taxonomy and
  `meta.tipo` (e.g. "festa"); join title/place from here by post id.
Fetch current month + horizon (next ~6 months), drop past, district-gate on place.

## (4) caldas — `caldas.ts`

`https://www.mcr.pt/agenda?lang=pt&amount=12` listing + `/agenda/<slug>` detail
(server-rendered). City = Caldas da Rainha.

## Acceptance (verified by me, real runs — no fabricated numbers)

1. `bun test` green, existing suites untouched.
2. Standalone live run per source: report events discovered / failures / first error.
3. Re-run: novel discovery = 0, same event count (idempotent).
4. Registry wired → full ingest into `local.db` (backed up first): `new` count sane,
   `updated`/unchanged on re-run, zero duplicate fingerprint rows vs the 9 old sources.
5. Title+day collisions with existing rows inspected by hand (expect reconciliation,
   not duplicates).
