# SLICE_14 — Mapa de atividade (density map)

Status: PLAN (2026-09-12). Not started.
Owner: Pedro. Repo: /root/findleiria (master), data pipeline: /root/workspaces/products/events-tracker.

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

## Layer 2 — Venue pins + heat (needs geocoding first)

1. Run `geocode:venues` (Nominatim, 1 req/s, idempotent, already written) against
   the local.db of the pipeline copy. 214 venues outstanding; the script caps at
   `MAX_REQUESTS=100` → raise or batch it (~4 min per 100).
2. Add a `scope` column to `venues` (`venue` | `municipality`) so the 36
   pseudo-venues are drawn as concelho markers, never as precise pins. Needs one
   migration + a backfill rule (name == city, or name contains the city).
3. Runtime: Leaflet + heat layer (~50 KB gz) or deck.gl (heavier). Tile source is
   the open decision — see below.
4. Gate the heat layer on coverage: it is honest above ~80% of the *visible*
   window; below that, show pins with a "sem localização" count.

## Open decision (needs Pedro)

Tile strategy for Layer 2:

- **A. Protomaps PMTiles on R2** — one district `.pmtiles` (~10–50 MB) on the
  existing bucket, free, brand-styled, no key, no third-party requests.
  Most work, best look and least lock-in. **Recommended if Layer 2 is wanted.**
- **B. MapTiler free tier** — key, 100k loads/mo free, styleable-ish. Fastest path.
- **C. OSM raster tiles** — no key, but usage policy + generic look that fights
  the current design. Fine for an internal prototype only.

## Verification

- Layer 1: Playwright at 390px + 1440px; assert the 16 concelhos render, counts
  equal a direct Turso aggregate, filter clicks change `location.search`.
- Layer 2: assert no pin without lat/lng, pseudo-venues render as concelho
  markers, and the heat layer is absent when coverage < threshold.

## Also worth fixing (found during recon, unrelated to the map)

`feat/scraper-identity-day-pages` (the branch the 07:00 scrape actually runs from)
is **33 commits behind master and 2 ahead** — `b6fe48d` (turismodocentro, figueiró,
district-gate fix) and `3bf5345` (nocartaz.pt, Tier 2) exist only there, and
`b6fe48d` is not merged. Auth and saved-events are absent from the copy that
produces the data every morning. Either merge that branch or make the pipeline
copy track master; today the scraper and the deployed web app are different trees.
