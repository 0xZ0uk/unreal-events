# SLICE 9 — rebuid the UI from scratch (jakub.kr/skills)

**Goal.** Throw away the current page and rebuild it as a single static page with no
navigation, applying the eleven interface skills at https://jakub.kr/skills
(`better-interface` orchestrates: layout, accessibility, writing, typography, color, ui).
Color tokens are frozen: `packages/ui/src/styles/globals.css` is untouched. Everything
above the token layer is rewritten.

## What gets deleted

The product is one page, so the router, the header and the loader are machinery with no
job:

- `src/routes/index.tsx`, `src/routes/__root.tsx`, `src/routeTree.gen.ts` — no routes.
- `src/components/header.tsx` — no navigation. The wordmark moves into the masthead.
- `src/components/loader.tsx` — dead: two `--arc-canvas` references (token does not exist),
  replaced by real loading/error/empty states for the agenda.
- `src/components/mode-toggle.tsx` + `theme-provider.tsx` — replaced by a 40px toggle
  button and a 20-line theme module (we own the `dark`/`light` class, no dep semantics to
  guess). Inline `<script>` in `index.html` applies the stored theme before paint.
- Dependencies: `@tanstack/react-router`, `@tanstack/router-plugin`,
  `@tanstack/react-router-devtools`, `@trpc/client`, `@trpc/server`,
  `@trpc/tanstack-react-query`, `sonner`, `next-themes`.

## New shape

```
src/
  main.tsx                  mount <App/> — no router
  app.tsx                   theme + page composition
  utils/api.ts              react-query options (stats, window, undated); no toast
  utils/format.ts           pt-PT dates/times/days, all pinned to Europe/Lisbon
  components/theme.ts       useTheme + toggle
  components/agenda/
    page.tsx                masthead + filters + agenda + footer
    masthead.tsx            wordmark, h1, dek, three real figures
    filter-bar.tsx          search, concelho, tipo, local, de/até, limpar
    agenda-list.tsx         day groups with sticky headers
    event-row.tsx           thumbnail, time, title, venue · concelho, chips
    announcements.tsx       "Datas por confirmar" (renders only when rows exist)
    states.tsx              skeleton, error + retry, two empty states
  hooks/use-agenda.ts       one window query + client-side filtering + facet options
```

## Data flow

One query carries the agenda: `listEvents({ dateFrom: startOfToday, dateTo: +90 days })`.
Everything else — search text, concelho, tipo, local, date range — filters those ~240 rows
in memory. So filters are instant, no refetch, and facet options are derived from the
loaded window, so selecting a value never empties the option list.

Two defects from the old page are fixed on the way:

1. The old filtered path called `listEvents` with **no time floor**, so filtering surfaced
   23 past events at the top of the list (`byDay`, the unfiltered path, did apply one).
   One window query with an explicit floor removes the inconsistency.
2. There was no loading or error state — `?? []` meant a failed or slow Turso read
   rendered as "Nenhum evento". Both states are now explicit.

Guard kept: if the window ever returns the 500-row limit, the list says so instead of
silently truncating.

## Craft rules being applied (the short version)

- **Layout** — groups separated by space, not lines; one container, one measure; controls
  in a 12px grid; no dead options (facets come from data); the day header sticks because
  the agenda is long, and the filter bar does not, so the two never stack.
- **Typography** — display face for structure (h1, day headers, wordmark), Karla for
  content, mono for figures and labels; 17px body floor, 16px titles, 12–13px labels;
  `tabular-nums` on every clock; `text-wrap: balance` on the h1, `pretty` on deks;
  titles clamp at 3 lines with the full string as the link's accessible name.
- **Color** — tokens only, no new hues. Amber means *brand or interaction*: wordmark, link
  hover, focus ring, selected state. Category chips are neutral hairlines, so the page
  stops spending the accent on decoration.
- **Accessibility** — skip link, h1 → h2 per day, `<section aria-labelledby>`, labelled
  controls, `aria-live="polite"` on the result count, 2px amber `:focus-visible` ring with
  offset, 40/44px hit areas, 16px search input (no iOS zoom), real `<time>` elements,
  `motion-safe:` on decorative transitions, `role="alert"` on the error block.
- **Writing** — sentence case pt-PT; buttons name their outcome ("Limpar filtros"); the
  empty state quotes the query and offers the exit; the last-collection figure is a real
  timestamp instead of the old "atualizado diariamente · 07:00" claim.
- **UI/motion** — two radii (4px surfaces, 2px chips), hover fill instead of borders,
  animations only on state entry (search icon, press), nothing on page load.

## Verification

`pnpm check-types`, `vite build`, biome, then Playwright against the production build:

- 390×844 and 1440×900 screenshots, read back with vision.
- Loading, error, empty-filter and announcements states forced by intercepting the Turso
  endpoint — no data is touched.
- Keyboard walk, focus-ring visibility, 320px reflow, 200% zoom, 44px hit areas,
  reduced-motion, and measured contrast for every rendered foreground/background pair.

Then the consolidated `better-interface` review (six domain reviewers) against the frozen
build; HIGH/MEDIUM findings get fixed before the commit.
