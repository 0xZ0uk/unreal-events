# SLICE_6 — Session merging + category canonicalization

Two decluttering fixes requested after SLICE_5 (multi-source dedupe).

## Problem 1 — same-day sessions show as separate rows

A screening at 18h30 and 21h30 (theatre, cinema, some concerts) produces two
event rows: `fingerprint()` intentionally includes Lisbon HH:mm so sessions
don't collide into one. Correct data-wise (ICS/one VEVENT per session), wrong
presentation-wise.

**Fix: merge at the API layer, not in the DB.**

- `packages/api/src/grouping.ts` (pure, tested): `mergeSameDaySessions(rows)`
  groups consecutive rows by `normalizeTitle(title) + venueId + lisbonDay(start_at)`
  and returns the earliest row with `sessionStarts: number[]` (sorted, deduped,
  includes the original start_at). ICS feed keeps per-session VEVENTs (untouched).
- Wire into `eventsRouter` `list`, `byDay`, `calendar` (all feed agenda view,
  calendar grid, day-click filter). Public event type gains `sessionStarts`.
- UI: agenda EventRow time rail shows first + "· +1 sessão" hint when
  `sessionStarts.length > 1`; calendar cell shows first session time with
  "· +1" suffix. Type in index.tsx/calendario.tsx updated.

Kept distinct: different venues, different days, different shows. Title
normalization reuses `normalizeTitle` (NFD, diacritics, punctuation) — same
rules that already make fingerprinting work.

## Problem 2 — 56 raw category labels, many dupes/variants/platform names

Sources send their own labels; some scrapers inject platform fallbacks
(`Shotgun`, `Eventbrite`, `Ticketline`, `Viral Agenda`). Current distinct
labels: 56 across 398 events.

**Fix: canonical taxonomy applied at ingest.**

- `apps/server/src/scraper/categories.ts` (pure, tested):
  `canonicalizeCategories(raw: string[]): string[]` — exact match, then
  normalized match (diacritics/singular/plural/punct via normalizeTitle), then
  alias map → canonical label. Unknown labels pass through (never lose data)
  but are logged via `unknownCategory()`. Dedupes + stable sort.
- Canonical taxonomy (PT, ~21): Cultura, Música, Concertos, Festivais,
  Clubbing, Teatro, Dança, Cinema, Literatura, Encontros, Conferências,
  Workshop, Museus & Exposições, Mercados e Feiras, Tradição, Infantil,
  Comedy, Desporto, Gastronomia, Natureza, Outros.
- Wire into `upsertEvent` (single choke point for all 7 scrapers) on both
  insert and update paths; change-detection compares canonicalized values so
  re-scrapes converge instead of flip-flopping.
- Scrapers stop injecting platform names as categories (shotgun, eventbrite,
  ticketline, viralagenda fallbacks).
- One-off backfill CLI `apps/server/src/backfill-categories.ts` re-canonicalizes
  all existing `events.categories` (maps legacy labels in place, then unknowns
  are left as-is and reported).

Result: filter dropdown goes from 56 → ~21 options; `Concertos` filter matches
what used to be `Concerto`; platform junk gone.
