# SLICE_14 — Mapa de atividade (density map)

Status: **layers 1 and 2 shipped** (2026-09-12). Layer 1 = PR #28. Layer 2 = the
pins, on `feat/slice16-map-pins`. Data pipeline: /root/workspaces/products/events-tracker.

## What was asked

"Dynamic Map Pins: heatmap overlay showing real-time activity hotspots
(Leiria Castle events vs Caldas da Rainha art pop-ups)."

## Two framing corrections (measured, not opinion)

1. **Not "real-time".** The corpus refreshes once a day (cron 07:00 scrape →
   `publish-turso.ts`). "Real-time activity" would require the map to show things
   happening *now*; what we actually have is a forward agenda. So the honest
   product is a **density map over a window you choose** (next 7d / 30d / 90d),
   reusing the SLICE_10 period presets — not a live activity feed.
2. **Not "heatmap of pins" yet.** Coordinates are the blocker, see the audit.

## Data audit (Turso, 2026-09-12)

- 224 venues, **10 with lat/lng** (4.5%).
- 519 upcoming events (no `date_text`), **108 with coordinates (21%)**.
- Of those 108, **106 are in the concelho of Leiria** — every other concelho is
  at 0. A point heatmap today renders one blob over Leiria city and a blank district.
- 36 venues are *named after their municipality* ("Óbidos", "Marinha Grande",
  "Caldas da Rainha"). Óbidos alone carries **113 upcoming events** on that one
  pseudo-venue. Pinning these to a centroid would be a fabricated location.
- Upside: `venues.city` is populated for **100% of venues**, and `municipalityOf()`
  in `packages/api/src/places.ts` already folds freguesias onto the 16 municípios
  (the web app already imports it). Municipality-level truth is complete today.

## Layer 1 — Concelho choropleth (no new data, no keys, no cost)

Shade the 16 municípios of Distrito de Leiria by upcoming-event count for the
selected window; clicking a concelho applies the existing `city` filter.

- Geometry: Nominatim `polygon_geojson=1` for each município (16 requests, ~1.1s
  apart, ODbL attribution). Verified working: Leiria returns an administrative
  relation Polygon. Simplify (Douglas–Peucker ≈0.001°) → ~60–120 KB total,
  committed as a static asset. No runtime API calls, no tiles, no key.
- Counts: existing `useAgenda` query + `municipalityOf()`. Zero new SQL.
- Renders as inline SVG → styles to brand (dark + amber), no raster clash.
- Honest by construction: municipal buckets stay at municipal resolution.

## Layer 2 — Venue pins + heat

Status 2026-09-12: **shipped**. Steps 1–2 are on master (PRs #29/#30); step 3 —
the runtime layer — is `feat/slice16-map-pins`.

### Step 3 — the pins

The pins are drawn in the same Leaflet canvas as the choropleth, in their own
pane (`map-pins`, zIndex 460) so a picked concelho's `bringToFront()` can never
bury a dot. No tile layer was added: the district's own outlines are the
reference the reader came for, and a vendor basemap would add a key, a bill and
a second visual language to a page that already draws the geography it needs.
**The tile question below is therefore closed — no tiles, at either layer.**

The data reaches the client on the event row: `venueLat`, `venueLng`,
`venueScope` ride along in the list payload (~40 B/row). Null means the pipeline
could not place that venue honestly — never `0`, which is a real coordinate.

`pinTallies()` in `apps/web/src/utils/pins.ts` is the whole policy:

- **One pin per place**, keyed by venue slug — the same key `?local=` and the
  venue facet use, so clicking a pin and picking the venue in the filter bar are
  the same statement.
- **`scope=concelho` is never a pin.** "Óbidos" carries every Óbidos listing no
  source located; a dot there would be a fabricated location. It stays an area.
- **`scope=lugar` is a dashed ring, not a dot.** A settlement coordinate is
  honest as a place and dishonest as a building, so it keeps its own shape.
- **No coordinates, no pin** — and a coordinate that is not a finite point on
  Earth is refused rather than drawn.
- Radius is `sqrt(count)`-scaled (floor 3.5 px, ceiling 13 px), for the same
  reason the choropleth ramp is: one venue holds a tenth of the window.

The map now ignores **both** of its own selections (concelho *and* venue) and
draws them instead: clicking a pin lights it and its concelho without collapsing
the district to one shape, which is the property the concelho rule was there for.

Heat: **not drawn as a continuous field.** Fifty-odd dots across a district do
not support a density surface — it would paint a gradient between two towns that
have nothing between them, which is the same objection that decided Layer 1
against a heat map. Size-by-count is the discrete version of the same reading.

Because Leaflet's vector paths are not focusable, the accessible route is the
**"Locais no mapa"** list beside the map: same numbers, real buttons, keyboard
reachable. It names the top 12 and states the remainder out loud rather than
implying the list is the whole set.

### Step 1 — coordinates, with the check that used to be missing

`geocode:venues` (Nominatim, ~1 req/s, idempotent) took the first hit and wrote
it. That is how an "Auditório Municipal" in Gaia ends up pinned inside Leiria:
the string matched something, the something was elsewhere, nothing checked. It
now keeps only hits that land **inside the concelho the venue's own `city`
belongs to** — `concelhoAt()` in `packages/api/src/geo.ts` runs ray-casting
point-in-polygon against the same `concelhos.json` the map draws. A candidate
that cannot be drawn in the right concelho is a miss with a reason, not a row.

Three query shapes per venue, tried in order: `name, city, Portugal`;
`name, Portugal` bounded to the concelho's own box; `name, Portugal` unbounded
(validated like the rest). Note the codec: Nominatim wants
`viewbox=<west>,<north>,<east>,<south>`, and `boundsOf()` returns `[W,S,E,N]`.

`geocode:venues --verify` re-tests every coordinate already in the database
against its own concelho — no network, no writes, exit 1 on a mismatch. The ten
rows that already had coordinates pass; that is the only reason to trust the new
ones.

`--dry-run --report=<path>` writes the whole outcome list — what was found, by
which query shape, in which concelho, and why the rest were refused — so the run
is reviewable before it touches a row.

### Step 2 — `scope`, three values rather than two

`venues.scope` is `venue` | `lugar` | `concelho` (migration
`0002_fixed_sally_floyd.sql`, not null, default `venue`). Two of the three are
not buildings, and the difference decides how Layer 2 draws them:

- `concelho` — the record is the municipality's own name ("Óbidos", "Marinha
  Grande"). Drawn as the area. Never geocoded, never pinned.
- `lugar` — a freguesia or vila ("Vieira de Leiria", "São Bento (Porto de Mós)",
  "Benedita (Vila)"). Honest as a dot at the settlement, dishonest as a building.
- `venue` — everything else, including a real venue that has a place name inside
  it ("Castelo de Porto de Mós", "Museu Escolar de Marrazes"). Pins live here.

`scopeOfName()` in `packages/api/src/places.ts` reads the scope off the name:
decode HTML entities (one source ships `Marinha Grande &#x2F; Marinha Grande`),
take the segment before `,` or `/`, drop a trailing `(qualifier)`, then match
against the município and freguesia tables. One judgement it deliberately does
not make: `Moleanos (Alcobaça)` is a lugar the parish table does not list, so the
name reads as `venue` — the geocoder downgrades it to `lugar` when OSM answers
with a settlement instead of a building, which is the only place that call can be
made honestly.

### The 214, measured (local.db, 2026-09-12)

| kind | rows | upcoming events | what happens |
| --- | --- | --- | --- |
| município's own name | 13 | 248 | `scope=concelho`, no coordinates |
| listed freguesia/vila | 16 | 36 | `scope=lugar`, dot at the settlement |
| everything else | 185 | 125 | geocoded as a venue, validated by concelho |

The third bucket is not all venues. It carries out-of-district rows
("Auditório Municipal De Vila Nova De Gaia | Leiria", "Alfândega Do Porto |
Leiria", "Auditório Municipal Beatriz Costa (Mafra)"), the source's own label
("Agenda Cultural Óbidos"), and place-with-concelho strings ("Vimeiro, Vimeiro",
"Vila Cã, Vila Cã"). Point-in-polygon is what keeps every one of those unpinned.
97 of the 214 carry upcoming activity (409 events); the other 117 are silent
today. Those silent places are exactly what the coverage line under the map
reports, instead of a threshold that hides them when coverage is low.

## Tile strategy — closed

Layer 2 shipped without tiles, so the question below resolved itself: nothing is
needed. Kept for the record — if a basemap is ever wanted (road context at street
zoom), the recommendation stands.

- **A. Protomaps PMTiles on R2** — one district `.pmtiles` (~10–50 MB) on the
  existing bucket, free, brand-styled, no key, no third-party requests.
  Most work, best look and least lock-in. **Recommended if a basemap is ever
  wanted.**
- **B. MapTiler free tier** — key, 100k loads/mo free, styleable-ish. Fastest path.
- **C. OSM raster tiles** — no key, but usage policy + generic look that fights
  the current design. Fine for an internal prototype only.

## Verification

- Layer 1: Playwright at 390px + 1440px; assert the 16 concelhos render, counts
  equal a direct Turso aggregate, filter clicks change `location.search`.
- Layer 2, run 2026-09-12 against the deployed Turso from the dev server
  (`?vista=mapa`, headless Chromium):
  - the DOM's `data-venue` set is **byte-identical** to the slug set a direct SQL
    aggregate returns for the same window: **52 pins**, 188 events carried, 10 of
    them settlements.
  - `data-venue="obidos" | "marinha-grande" | "leiria" | "caldas-da-rainha"`
    = **0 each** — no município is drawn as a point.
  - 16 `data-concelho` shapes, 10 `stroke-dasharray="2 3"` settlement rings.
  - the panel's own numbers agree with the map: 492 events (merged rows) in the
    window, 171 pinned + 10 settlements.
  - `tsc --noEmit` clean on both packages; 114 tests pass, 14 of them new in
    `apps/web/src/utils/pins_test.ts`.

## Known gaps (filed, not fixed here)

- **Touch targets.** A 3.5 px dot is a pointer affordance, not a tappable one.
  The "Locais no mapa" list is the touch/keyboard route; a tap-size floor on the
  map markers themselves is unbuilt.
- **15 vs 16.** The masthead counts concelhos *with events*; the map's status
  line counts the concelhos *the map draws*. Both true, read as a contradiction.
  One of them should say which it is.
- **De-clustering.** Fourteen of the fifty-two pins sit in Leiria city and
  overlap at district zoom. Zoom separates them; a collapser at low zoom does not
  exist.

## Also worth fixing (found during recon, unrelated to the map)

`feat/scraper-identity-day-pages` (the branch the 07:00 scrape actually runs from)
is **33 commits behind master and 2 ahead** — `b6fe48d` (turismodocentro, figueiró,
district-gate fix) and `3bf5345` (nocartaz.pt, Tier 2) exist only there, and
`b6fe48d` is not merged. Auth and saved-events are absent from the copy that
produces the data every morning. Either merge that branch or make the pipeline
copy track master; today the scraper and the deployed web app are different trees.
