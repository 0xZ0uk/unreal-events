# events-tracker

Personal events tracker for Leiria, Portugal. Scrapes local event sources into
one deduplicated calendar with a web UI, ICS feed, and a daily Discord digest.

**Status:** SLICE_1–4 complete (2026-09-01). Sources: leiriagenda (160 events),
cm-leiria RSS (30, stale-since-2023 feed — kept for when it revives), BOL
(0 today — district listings work, concelho yield is seasonal), Eventbrite
(Leiria-city scope). 191 events, 35 venues (16 geocoded via Nominatim).

## Setup guide

### 1. Prerequisites

- **Node 20+** and **pnpm 10+** (`corepack enable` works — the repo pins
  `pnpm@10.34.4`)
- **Bun 1.4+** (`curl -fsSL https://bun.sh/install | bash` — the server,
  scrapers and CLI all run on Bun)

### 2. Install & env

```bash
git clone git@github.com:0xZ0uk/unreal-events.git
cd unreal-events
pnpm install
```

Create the two env files (gitignored):

```bash
# apps/server/.env — server config
CORS_ORIGIN=http://localhost:3300
DATABASE_URL=file:../../local.db
PORT=3301
# optional: keyword watchlist for the digest CLI
# DIGEST_KEYWORDS=tattoo,jazz,fado,rock

# apps/web/.env — web app points at the API
VITE_SERVER_URL=http://localhost:3301
```

Optional: if your machine's dev ports collide (3000/3001 are commonly taken),
change `PORT` in `apps/server/.env`, the matching `CORS_ORIGIN`, and both the
`port` in `apps/web/vite.config.ts` and `VITE_SERVER_URL` accordingly.

### 3. Database

SQLite at the repo root — migrations are committed, so after install:

```bash
cd packages/db && bun run db:migrate:deploy && bun run db:seed && cd ../..
```

That creates `local.db` with the 4 tables (`venues`, `events`,
`event_sources`, `scrape_runs`) plus 10 seed venues. Schema changes later:
`bun run db:generate` (new migration) + `bun run db:push`.

### 4. Run

```bash
pnpm dev        # web :3300 + server :3301 (turbo)
```

Open http://localhost:3300 — first visit shows an empty agenda until the
first scrape.

### 5. First scrape

```bash
pnpm --filter server scrape            # all four sources sequentially
# or one at a time:
pnpm --filter server scrape:leiriagenda
```

Each source prints `{found, new, updated, failed, error}` and writes a
`scrape_runs` row. Run it twice — the second must report `new: 0`
(idempotency invariant). Note: **Eventbrite rate-limits hard**; if a run
dies with HTTP 429 wait a few minutes before retrying — the run is recorded
and the next scheduled run self-heals.

Optional, one-time: geocode the venues for map work later:

```bash
pnpm --filter server geocode:venues   # Nominatim, 1 req/s, idempotent
```

### 6. Digest & calendar

```bash
pnpm --filter server digest                # plaintext digest of upcoming events
DIGEST_KEYWORDS=tattoo,jazz pnpm --filter server digest -- --new 24
```

- `--new N` limits to events ingested in the last N hours
- `DIGEST_KEYWORDS` ⭐-marks watchlist hits in the output
- ICS feed: start the server, then
  http://localhost:3301/events.ics (add `?keyword=a,b` to filter, or
  `?scope=undated` for undated events as text). Subscribe from any calendar
  app.
- Paste-a-link ingest:
  `pnpm --filter server ingest:url -- https://leiriagenda.cm-leiria.pt/pt/agenda/<slug>`

### 7. Cron automation (Hermes-specific)

The daily scrape + Discord digest are Hermes Agent cron jobs (see
`/.plans/SLICE_EVENTS_TRACKER.md`): scrape all sources daily at 07:00, digest
to Discord at 09:00. To replicate elsewhere, cron these two commands:

```bash
cd apps/server && bun run src/scraper/run.ts leiriagenda && bun run src/scraper/run.ts cmleiriarss && bun run src/scraper/run.ts bol && bun run src/scraper/run.ts eventbrite
DIGEST_KEYWORDS="..." bun run src/digest-cli.ts --new 24   # pipe to your notifier
```

### 8. Tests & checks

```bash
pnpm check-types              # tsc across the monorepo
cd apps/server && bun test    # 52 offline tests (fixtures, no network)
bunx biome check .            # lint/format
```

## Stack

better-t-stack monorepo · pnpm + Bun · Hono (server, :3301) · React + TanStack
Router (web, :3300) · tRPC · Drizzle + SQLite (libsql, `local.db` at repo root)
· Turborepo + Biome.

```
apps/server/     Hono API + scraper (src/scraper/) + digest (src/digest*.ts)
apps/web/        TanStack Router UI (/ = agenda, /admin = runs dashboard)
packages/api/    tRPC routers (events, admin)
packages/db/     Drizzle schema, migrations, seeds
```

## Commands

```bash
pnpm install
pnpm check-types            # typecheck everything
pnpm --filter server scrape             # all sources
pnpm --filter server scrape:leiriagenda # single source
pnpm --filter server geocode:venues     # Nominatim geocoding (idempotent)
pnpm --filter server digest             # plaintext digest (--new N supported)
pnpm --filter server ingest:url -- <url> [venue]   # paste-a-link ingest
pnpm dev                    # turbo dev (web :3300, server :3301)
```

Sources registry: `apps/server/src/scraper/index.ts` —
leiriagenda | cmleiriarss | bol | eventbrite.

## How it works

1. **Scrape** — each source returns `{events, failures, firstError}`. Per-card
   failures are counted, never fatal; fetches carry a 15s timeout + 2 retries;
   request caps enforced exactly; every run writes a `scrape_runs` row.
2. **Fingerprint** — dated: `sha1(normalizedTitle|venueSlug|YYYY-MM-DD HH:mm
   Europe/Lisbon)`; undated: `...|UNDATED` (never rotates). Same-day twin
   sessions stay distinct.
3. **Ingest** — venue resolve-or-create, event upsert by fingerprint,
   `event_sources` attribution rows, ghost cleanup when an undated event
   gains a date.
4. **Serve** — tRPC `events.list` (venue/category/city/date filters +
   includeUndated) / `byDay` / `undated` / `venues` / `stats`; `admin.runs`.
   Plain endpoints: `/digest` (JSON), `/events.ics` (RFC 5545 calendar,
   keyword filter, `scope=undated` text list).
5. **Cron (Hermes)** — daily scrape 07:00 (all sources; 0-found×2 days =
   broken-selector alert), daily Discord digest 09:00 (`DIGEST_KEYWORDS`
   watchlist → ⭐ lines, rest compressed). Webapp: subscribe via
   http://localhost:3301/events.ics.

## Data model

- `venues` — name, slug, address, lat/lng (16 geocoded), city
- `events` — title, slug, description, start_at/end_at (epoch), venue_id,
  image_url, url, categories (JSON), fingerprint (unique), date_text
  (non-null ⇒ undated: start_at is an ingestion placeholder, calendar views
  exclude it)
- `event_sources` — attribution per (event, source)
- `scrape_runs` — source, started/finished, items_found/new/failed, error

## Deferred

- Visite Leiria (JS-rendered dates) + Ticketline (bot-walled) — need the
  Playwright pipeline; parked.
- Calendar month view on the web UI (data model + filters ready for it).

Plan: `/root/.plans/SLICE_EVENTS_TRACKER.md`

