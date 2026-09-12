---
slice: 11
topic: Findable — per-event pages, share cards, structured data, sitemap, analytics
status: proposed
base: master @ 65f6076
branch: feat/slice11-findable
depends_on: SLICE_10 (shareable filter state), #20 (window headroom)
---

# SLICE_11 — Make it findable

Every event we collect is currently invisible to search engines and social previews. We hold
**585 events with unique slugs**, and the public site exposes exactly **one** indexable URL.

This is the only item on the roadmap that compounds: pages keep earning traffic after the slice
ships, whereas QoL polish has to be re-earned every release.

## What is actually wrong (measured, not guessed)

| Claim | Evidence |
|---|---|
| There is no per-event URL | `apps/web/src/app.tsx` renders `<AgendaShell />` unconditionally — no router, no pathname read. `/evento/<slug>` loads the agenda |
| Every URL shares one preview | `apps/web/index.html` holds the only `<title>` and `<meta name="description">`; nothing is per-route |
| New paths can't serve new HTML anyway | `vercel.json` rewrites everything except `/assets/`, `events.ics`, `favicon.ico` to `/index.html` |
| No structured data, no sitemap | `apps/web/public/` contains only `favicon.svg`; no `application/ld+json` anywhere in `apps/web` or `packages` |
| No analytics | zero instrumentation in the repo |
| The data is already ready | `packages/db/src/schema/index.ts`: `events.slug` and `venues.slug` are `.notNull().unique()`; `eventSelect` (`packages/api/src/queries/events.ts`) already selects `slug` and `venueSlug`; 585/585 events have slug + source URL, 478 have images, 449 have descriptions |
| The API has no single-event read | `packages/api/src/queries/events.ts` exports `listEvents`, `eventsByDay`, `undatedEvents`, `venues`, `eventStats` — nothing by slug |

## Scope

**A. Route layer + event page.** `apps/web/src/app.tsx` gets a pathname resolver (no router
dependency — one page type, `matchEventSlug(pathname)`), rendering either the agenda (`/`) or
`EventPage` (`/evento/<slug>`). New `eventBySlug(db, slug)` in
`packages/api/src/queries/events.ts` returns the event plus its venue; the page shows title, venue,
day, description, image, source link, and the "add to calendar" hook left for SLICE_12. Unknown
slug renders a real 404 view with a link back to the agenda.

**B. Prerendered HTML per event.** A build step (`apps/web/scripts/prerender-events.ts`, run from
`apps/web`'s `build` after `vite build`) reads Turso, then writes
`apps/web/dist/evento/<slug>/index.html` for every event: per-event `<title>`, description,
canonical, OG/Twitter tags, and `<script type="application/ld+json">` with schema.org `Event`
(`name`, `startDate`, `location` with venue name + locality, `image`, `url`, `offers.url` to the
source). `vercel.json` gets `/evento/` carved out of the catch-all rewrite so the static document
wins. The SPA still boots on top and takes over for interactions.

**C. Share cards.** One 1200×630 PNG per event at `/og/<slug>.png`, generated in the same build
step (satori + resvg, already available in the toolchain family we use). Card carries the event
title, day, venue, and the FindLeiria mark — the product looks deliberate in a WhatsApp thread
instead of showing a bare link.

**D. Sitemap + robots.** Generated in the same step: `sitemap.xml` with the home page, all 585
event URLs, and venue URLs scoped to what exists; `robots.txt` allowing everything and pointing at
the sitemap. `lastmod` from the event's `scraped_at`/`updated_at`, not build time.

**E. Analytics.** Cookieless and self-hosted, so no consent banner and no per-pageview bill. One
script tag plus an event on outbound source clicks (that click is the only thing we can measure
that correlates with the product's purpose).

## The one decision I need redlined

Analytics host. I recommend **self-hosted Umami on the existing Dokploy** (`dash.blugg.pt`): free,
cookieless, no banner, one container + Postgres. The alternative is Vercel Web Analytics — zero
ops, but paid per event and it can't be self-hosted. If neither is wanted now, E becomes a
data-layer-only change and the slice still ships A–D.

## Out of scope

Venue pages (needs copy we don't have), the map (venue geo is **10/224** — a map of ten pins is
worse than no map), event submissions (needs a writable backend + moderation), promoted listings,
weekly digest (SLICE_13), multi-district.

## Task breakdown

Each task lands with its own evidence; no task is "done" on assertion.

| # | Task | Evidence required |
|---|---|---|
| 1 | `eventBySlug` + tests | unit test: known slug, unknown slug, event with no venue |
| 2 | `matchEventSlug` + route resolver + tests | test: `/`, `/evento/x`, `/evento/`, `/evento/x/y`, unknown path |
| 3 | `EventPage` + 404 view | Playwright: real slug renders title/venue/day; bogus slug renders 404 and doesn't crash |
| 4 | Prerender script | `dist/evento/<slug>/index.html` count == event count; spot-check 3 files by curl |
| 5 | `vercel.json` carve-out | `curl https://…/evento/<slug>` returns the prerendered `<title>`, not the generic one |
| 6 | JSON-LD | validate 3 representative events (dated, date-only, no description) |
| 7 | OG cards | `curl -I /og/<slug>.png` → 200 `image/png`; card renders legibly at 1200×630 |
| 8 | Sitemap + robots | URL count == expected; all URLs 200; `robots.txt` allows and points at sitemap |
| 9 | Analytics | one pageview visible in the dashboard from a real visit; no cookie set |

## Risks

- **Build-time DB access.** The prerender script needs Turso read credentials in the build
  environment. `vercel build --prod` already has them (the client bundle bakes `VITE_TURSO_*`), but
  the script must read them from the environment and **fail the build loudly** if a fetch returns 0
  events — a silently empty prerender would ship 585 dead pages.
- **Dates without a time.** 201 of 321 evening-looking events have no clock time and are stored at
  `00:00`. Structured data must emit `date`-only for those, never a fabricated `datetime`.
- **Dirty text.** Descriptions carry HTML entities (`&#8217;`) and some titles contain unescaped
  characters (#17). Meta tags must be entity-decoded and quoted safely, or previews show `&#8217;`.
- **Missing media.** 107 events have no image: the OG card must render a typographic layout, not a
  broken `<img>`.
- **Static count.** 585 pages + 585 cards is a few MB of build output; Vercel's file limit is not a
  concern at this size, but the build step must stay idempotent so a re-run doesn't duplicate.

## Acceptance

- `/evento/<slug>` returns a document whose `<title>` names the event, from `curl` alone.
- A WhatsApp/Slack unfurl of an event URL shows the event title and day.
- All event URLs appear in `sitemap.xml` and respond 200.
- Pageviews appear in analytics; no cookie is set on first visit.
- Existing agenda behaviour is unchanged: 72 day groups / 492 events, no truncation note.
