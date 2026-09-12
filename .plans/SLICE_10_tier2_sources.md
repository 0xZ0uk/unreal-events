# SLICE_10 — Tier 2 sources, re-assessed

SLICE_9 parked a list of "Tier 2" sources: real events, but each had a known
catch. This slice re-probes each one live and decides build / defer / drop.
Recon date: **2026-09-12**, all evidence from live HTTP (no vendor docs).

## Verdicts

| Source | Catch from SLICE_9 | What live recon says | Verdict |
| --- | --- | --- | --- |
| **nocartaz.pt** | `/eventos/` index JS-driven | `/distrito/leiria/` is **Astro server-rendered**: 203 `article.event-card` with `data-id`/`data-concelho`/`data-starts-at`/`data-venue`/`data-genre`, no pagination. Details are JSON-LD `Event`/`Festival`/`MusicEvent`. Hub claims 273 events / 11 concelhos but renders 203 — the hub caps its own list. | **BUILT** (this slice) |
| turismodocentro.pt | open `wp/v2/event`, ~24 Leiria events all-time | 64 events all-time; `county_mirror` maps to county posts. **3** touch the district, and 2 of those are region-wide bundles (World Wellness Weekend, Jornadas do Património) that list 50+ counties. | **DROP** — yield ≈ 1 event/year |
| gazetadascaldas.pt/agenda/ | HTML agenda | `/agenda/` is a news hub (headings are ordinary news posts); 1 `/agenda/<id>/` link on page 1; WP `types` has no event CPT; `/wp-json/tribe/events/v1/` → 404 despite a `tribe-events` class in the markup. The real listing is behind something we haven't found. | **DEFER** — needs the actual data path |
| Figueiró dos Vinhos | Joomla `com_djevents` + `listar-agenda-rss` | `/index.php/listar-agenda-rss` is HTML (not RSS): 13 `djev_item` blocks, 12 detail links of which most are duplicates of one event; the index mixes 2025-01-01 staleness with 2026-04 entries. ~6 events/year. | **DEFER** — ROI negative |
| aondevamos.pt | district filters via `admin-ajax` | HTTP 429 on recon; needs a slow, single-request probe before any decision. | **DEFER** |
| uniaodeleiria.pt | UD Leiria fixtures, `Desporto` category | `/calendario/` is a **league standings table** (21 `<tr>`, 514 Elementor widgets, no iframes) — no fixtures on it. Fixtures must come from another route/fed widget. | **DEFER** |
| Bombarral | agenda path not located | `/agenda` is a client-rendered SPA: `<tr>`-less, no `buildId`, no `/api`/`.json` asset in the shell. `/turismo/eventos` is empty. | **DEFER** — needs the JS bundle mined |
| Castanheira de Pêra | agenda path not located | `/PT/agenda` is a 200 KB calendar shell with no event links and one date string in the markup; the site's agenda ships as monthly posts. | **DEFER** |

Only one of the eight earned an adapter. That is the honest reading of the
evidence: the other seven are either tiny (1–6 events/year), silently stale, or
serve their calendar out of client-side JS we cannot see in HTML.

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
