# SLICE_17 — Known venues (venues we know by fact are in the district)

## Why

Some upstreams never localize a venue, so the district gate throws the row away
even though the event is in Leiria. Z0uk's example: **O Pica Miolos**, a bar in
the city of Leiria —

    https://www.nocartaz.pt/eventos/1a7f6837bb86d0cd/   (Baleia Baleia Baleia @ O Pica Miolos)
    https://www.nocartaz.pt/eventos/28592c47db0ef640/   (Chimera Black @ O Pica Miolos)

Both are invisible to us today: NoCartaz files them under **Coimbra**, and never
on the Leiria hub. There is no locality anywhere on the row to gate on.

## Recon (live, 2026-09-12)

NoCartaz = Astro SSR. What the rows actually carry:

- Card attributes: `data-id`, `data-concelho`, `data-distrito`, `data-venue`
  (the *feed* slug, e.g. `bandsintown-leiria`, `ecultura-leiria`,
  `ticketline-leiria`, `bol-leiria`, `blueticket-leiria`, `dgartes-leiria`),
  `data-date`, `data-starts-at`, `data-genre`, `data-free`, `data-search`.
- Aggregator-fed rows carry **`data-concelho=""`**, an empty `.where` venue span,
  an empty `·` concelho chip, and `data-distrito` = the *aggregator's* guess.
- Detail JSON-LD for those rows: `location.name = "Portugal"`, **no
  `addressLocality`**, `addressRegion` = the aggregator's guess (Leiria for
  `bandsintown-leiria` rows, **Coimbra** for O Pica Miolos), `organizer.url` =
  `/salas/bandsintown-<region>/` and those sala pages **404**.
- So the venue name exists in exactly one place: **the title suffix after ` @ `**
  (`<artist> @ <venue>`).
- The `/distrito/leiria/` hub carries **27 cards with `data-concelho=""`** today,
  all 203 cards labelled `data-distrito="Leiria"` — including rows that are *not*
  in the district ("Mão Cabeça @ Azambuja CultFest", "The Boojums @ Fuzz
  Cartaxo", the Santarém rows). Hub filing is therefore not trustworthy on its
  own: this is the fact the slice is built on.
- Other district hubs carry rows we would otherwise never see. `/distrito/coimbra/`
  lists both O Pica Miolos events (today's events appear in the hub's JSON-LD
  `ItemList`, 30 items; the card grid is capped at 203 cards and starts tomorrow).
- `robots.txt` **disallows** `/api/`, `/events.json`, `/events-rest.json`,
  `/search-index.json` ("keep search engines and scrapers off them"). We stay on
  HTML pages and never call those. NoCartaz search is JS + `search-index.json`,
  so search is not a discovery path we may use.

## Design

Three pieces, no new network surfaces beyond the district hubs.

### 1. `packages/api/src/known-venues.ts` (new)

Curated, hand-vetted facts — the same idea as the places roster: data in
`packages/api`, gate logic in the scraper.

```ts
export interface KnownVenue {
  /** Canonical venue name as we want it stored. */
  name: string;
  /** Other spellings the sources use (English names, without articles, typos). */
  aliases: readonly string[];
  /** The concelho the venue sits in (one of the 16 district municipalities). */
  city: string;
  /** Why we know it — a reviewer must be able to re-check. */
  note: string;
}

export const KNOWN_LEIRIA_VENUES: readonly KnownVenue[] = [ ... ];

/** Normalized match: case/accent/punctuation-insensitive, token-subsequence. */
export function knownVenueFor(evidence: string | null | undefined): KnownVenue | null;
```

Matching rule (documented in the file): normalize the evidence (lowercase, strip
accents and punctuation), then match an entry when the entry's normalized name
(or an alias) appears as a **contiguous token subsequence** of the evidence —
so `"Baleia Baleia Baleia @ O Pica Miolos"` → entry `Pica Miolos`, and a bare
`"O Pica Miolos"` matches too. Entries are curated: no generic single-token
alias (e.g. no `Maiorca`, no `Pombal`) — those collide with places outside the
district. Reuse the existing normalization helpers rather than adding a third
one (see `normalizePlace` in `places.ts`, `venueTokens`/`decodeEntities` in the
scraper's `normalize.ts`).

Seed: **O Pica Miolos → Leiria** only. Z0uk confirms the rest of the list; add
entries one at a time with a `note`, never a guess.

### 2. `apps/server/src/scraper/district.ts`

```ts
/** True when the evidence names a venue we know is in the district. */
export function isKnownLeiriaVenue(evidence: string | null | undefined): boolean;

/** District scope for a row: the resolved place, or a known venue name. */
export function inDistrictScope(
  city: string | null | undefined,
  venueEvidence?: string | null,
): boolean;
```

`isLeiriaDistrict()` stays exactly as it is — every other caller keeps its
behaviour. `inDistrictScope` = `isLeiriaDistrict(city) || isLeiriaDistrict(venue) ||
isKnownLeiriaVenue(venue)`: feeding the venue through the place gate already
catches names that embed a place ("Castelo de Leiria", "ÁGORA no Castelo de
Leiria"), and the curated list catches the ones that carry no place token at all.

### 3. `apps/server/src/scraper/nocartaz.ts`

- `titleVenue(title)`: the substring after the **last** `" @ "` (also accept
  `"@"` with no spaces when a space-delimited prefix exists), trimmed, rejected
  when empty or longer than 60 chars. Documented as aggregator markup.
- Venue evidence for a card =
  `detail.location.name` (when it is not a country name) → `card.venue` →
  `titleVenue(card.title)`. A `location.name` of `"Portugal"` must NOT become the
  venue name — we already drop those; keep dropping them.
- Gate: `inDistrictScope(city, evidence)`. When the gate passes only because the
  venue is known, the event's city = `detail.city ?? card.city ?? known.city`
  (so a Leiria bar never ships with `city = null` or `"Coimbra"`).
- **Discovery.** The Leiria hub stays the primary listing. Add a *best-effort*
  secondary scan of the other 19 `/distrito/<slug>/` hubs, keeping **only** cards
  whose venue evidence matches the curated list (never ingest another district's
  events wholesale). From each hub page read both surfaces: the card grid and the
  JSON-LD `ItemList` (it carries today's events, which the grid can drop under its
  203-card cap). Extra hub failures are counted, never fatal; the existing
  `MAX_DETAIL_REQUESTS` budget and the per-id detail cache still apply, so the
  steady-state cost is 19 listing fetches/day plus details for allowlist hits.
- The existing `isFeedVenue` rule still applies: a feed-named venue falls back to
  its concelho.

### 4. Wiring

`apps/server/src/scraper/index.ts`: pass the venue-aware gate
(`inDistrictScope`) to `scrapeNocartaz` instead of the bare `isLeiriaDistrict`.

## Tests

- `packages/api/src/known-venues_test.ts` — matching: exact, with-article, alias,
  accents/case, inside a longer title; negatives: empty, `"Portugal"`, an unknown
  venue, a venue that merely shares a generic word with an entry.
- `apps/server/src/scraper/district.test.ts` — `inDistrictScope` accepts a known
  venue with no city, still rejects an unknown venue with an out-of-district city,
  rejects `null`/`""`.
- `apps/server/src/scraper/nocartaz.test.ts` — with fixture HTML:
  - a `data-concelho=""` card on the Leiria hub whose title names a known venue is
    emitted with the curated city;
  - the same card with an unknown venue is still dropped;
  - a card from a non-Leiria hub is emitted only when its venue is known, and is
    not fetched for details when it is not;
  - `titleVenue()` unit cases (Bandsintown markup, titles with no `@`, `@` inside
    the artist name).

## Acceptance evidence

1. `bun test` (apps/server) and `bun test` (packages/api) green; `check-types` green.
2. **Live dry run** of the source against the real site (no ingest): the returned
   events include `nocartaz-1a7f6837bb86d0cd` and `nocartaz-28592c47db0ef640`
   with `city = "Leiria"`, and the Leiria-hub untagged rows whose venue is known
   are present. Script output is the proof, not a claim.
3. PR open, unmerged, with the counts above in the body.

## Non-goals

- No use of the robots-disallowed JSON endpoints (`/api/`, `events.json`,
  `events-rest.json`, `search-index.json`).
- No automatic venue discovery from our own `venues` table — its `city` column is
  not trustworthy yet (live example: `Auditório Municipal Beatriz Costa (Mafra)`
  stored with `city = "Leiria"`). It can become a *candidate queue* for review
  later; it must not become a gate input.
- Token-matching venue names against the parish roster (e.g. "Baleal", "Maiorca")
  is deliberately out: curated entries instead, because the roster holds generic
  words (`guia`, `vilar`, `montes`) that would false-positive.

## Follow-up (not this slice)

- Contact NoCartaz: report the mis-filing (O Pica Miolos in Leiria, filed
  Coimbra) and ask whether a data feed is available. One person runs that site;
  they may welcome the correction, and a feed would remove the guessing entirely.

## Verified (2026-09-12, live)

- `apps/server`: 395 pass / 0 fail; `packages/api`: 75 pass / 0 fail; `check-types` clean.
- Live dry run against nocartaz.pt, state warmed from the production cache:
  20 district hubs fetched, `discovered=213`, `events=188`, `failures=0`,
  `firstError=null`, **0 events placeless**, 11.4s steady state (hub listings
  only — every detail was already cached).
- Rows that used to be dropped, now emitted:
  `nocartaz-1a7f6837bb86d0cd` and `nocartaz-28592c47db0ef640` (both `city=Leiria`,
  `venueName="O Pica Miolos"`, found via the Coimbra hub's `ItemList`);
  `ORFEU E EURÍDICE … ÓBIDOS` → `city=Óbidos`;
  `Caldas da Rainha Ladies Open` → `city=Caldas da Rainha`;
  `Iúri Oliveira @ Alcobaça Monastery` → `city=Alcobaça`;
  `ÁGORA regressa ao Castelo de Leiria` → `city=Leiria`.
- Cities emitted (all 188 in-district): Óbidos 119, Marinha Grande 26, Bombarral
  9, Peniche 8, Nazaré 6, Pombal 6, Leiria 4, Alcobaça 4, Caldas da Rainha 3,
  Pedrógão Grande 3.
