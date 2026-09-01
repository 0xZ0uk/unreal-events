# events-tracker

Personal events tracker for Leiria, Portugal. Scrapes local event sources into
one deduplicated calendar with a fast web UI.

**Status:** SLICE_1 — Leiriagenda source live (160 events ingested, idempotent),
API + web UI.

## Stack

better-t-stack monorepo · pnpm + Bun · Hono (server, :3301) · React + TanStack
Router (web, :3300) · tRPC · Drizzle + SQLite (libsql, `local.db` at repo root)
· Turborepo + Biome.

```
apps/server/     Hono API + scraper (src/scraper/)
apps/web/        TanStack Router UI
packages/api/    tRPC routers
packages/db/     Drizzle schema, migrations, seeds
```

## Commands

```bash
pnpm install
pnpm check-types            # typecheck everything
pnpm --filter @events-tracker/server scrape:leiriagenda   # run the scraper
pnpm dev                    # turbo dev (web :3300, server :3301)
```

Scraper runs standalone: `cd apps/server && bun run src/scraper/run.ts
[leiriagenda]`.

## How it works

1. **Scrape** — `apps/server/src/scraper/leiriagenda.ts` fetches the
   Leiriagenda listing (`?page=N` pagination) + every event detail page.
   Per-card failures are counted, never fatal; fetches carry a 15s timeout + 2
   retries; request cap enforced exactly (400).
2. **Fingerprint** — `sha1(normalizedTitle | venueSlug | YYYY-MM-DD HH:mm
   Europe/Lisbon)`. Time-of-day is in the key so same-day twin sessions (e.g.
   18h30 vs 21h30) stay distinct events.
3. **Ingest** — venue resolve-or-create, event upsert by fingerprint,
   `event_sources` attribution rows (cross-source ready), one `scrape_runs`
   row per run (found/new/failed/error).
4. **Serve** — tRPC `events.list | events.byDay | events.stats` with venue
   join; UI groups upcoming events by day.

Second consecutive run inserts 0 new rows — idempotency is a hard invariant.

## Data model

- `venues` — name, slug, address, lat/lng, city
- `events` — title, slug, description, start_at/end_at (epoch), venue_id,
  image_url, url, categories (JSON), fingerprint (unique)
- `event_sources` — (event_id, source, source_event_id, source_url) —
  attribution, unique per (event, source)
- `scrape_runs` — source, started/finished, items_found/new/failed, error

## Next slices

- SLICE_2: BOL/Ticketline + Visite Leiria + RSS sources; venue geocoding;
  filters; calendar view
- SLICE_3: daily Discord digest + keyword watchlist
- SLICE_4: Eventbrite, ICS export, paste-a-URL ingest

Plan: `/root/.plans/SLICE_EVENTS_TRACKER.md`
