---
slice: 10
topic: Agenda QoL — shareable state, period chips, honest facets
status: implemented
base: feat/slice8-vercel-turso @ master merge (aa3b519 + master)
branch: feat/slice10-agenda-qol
supersedes: PR #7 (which conflicts with master on packages/db/package.json only)
---

# SLICE_10 — Agenda QoL (items 1 + 4 + 2)

Scope approved verbatim: *"Let's do 1 + 4 + 2 in one slice, but save the others for a next slice."*
Everything else from the audit is filed as an issue and left alone.

## Why these three

They are the highest ratio wins and all three touch the same surface (the filter bar), so they
ship together without dragging the scraper or the schema along.

| # | What | Live evidence before |
|---|------|----------------------|
| 1 | Filters live in the URL | `useState` only: picking `Concelho=Leiria` left `location.href` at `/`. Nothing shareable, back button didn't undo a filter, reload lost everything |
| 4 | Quick period filters | 61 of 492 events were today+tomorrow, and the only date control was a pair of raw `De`/`Até` inputs |
| 2 | Canonical facets | `Concelho` offered **37** options for a district with **16** municípios; `Tipo` offered 33 with drift; `Local` offered 107 "venues" whose top entry was the town `Óbidos (113)` |

## What was actually wrong (measured, not guessed)

Live production DB (`venues.city`, events in window):

- Leiria's **183** in-window events were split across **10** options — `Leiria (165)`, `Marrazes`,
  `Colmeias`, `Caranguejeira`, `Carreira`, `Milagres`, `Cortes`, `Carvide`, `Santa Eufémia`,
  `Barreira`.
- Duplicate spellings shipped as separate options: `Castanheira de Pera` + `Castanheira de Pêra`,
  `Mira d'Aire` + `Mira de Aire`.
- Masthead claimed **"concelhos: 37"** — wrong by 2.3×, and it was counting `venues.city` strings.
- `Tipo` carried 12 labels that were neither canonical nor aliased: `Festas (51)`,
  `Atividades ao Ar Livre (27)`, `Oficina / workshop (5)`, `Evento ao ar livre (3)`,
  `Educação (3)`, `Saúde`, `Mais Novos`, `Feiras`, `Espetáculo`, `Corrida`, `Caminhada`, `Ambiente`.
- Root cause of the category drift: two labels our **own** mappers emit (`regiaoleiria.ts` →
  `"Festas"`, `"Atividades ao Ar Livre"`, `"Agenda"`; `cmleiriarss.ts` → `"CM Leiria"`;
  `obidos.ts` → `"Oficinas"`) were in neither `CANONICAL_CATEGORIES` nor `ALIASES_RAW`. Unknown
  labels pass through by design (never lose data), so they became filter options. Aliases are keyed
  on exact normalized strings: `Feira` was aliased, `Feiras` was not.

**Bonus find, not cosmetic:** `LEIRIA_DISTRICT_MUNICIPALITIES` listed 14 municipalities and omitted
**Ansião** and **Peniche** — both are in the district, and `municipal.ts` has configured, parsing,
fixture-tested sources for `cm-ansiao.pt` and `cm-peniche.pt`. Every Ansião event was gated out at
ingest (`isInScope(raw.city)` on city `"Ansião"`). Peniche only appeared at all via other sources
that happened to report a different city string.

## Implementation

**Shared taxonomy — `packages/api/src/places.ts` (new).** `DISTRICT_MUNICIPALITIES` (16) +
`normalizePlace` + a verified freguesia→município table + `municipalityOf()`. Lives in the shared
package because both sides ask the same question: the server gates on it, the web facet folds on it.
`apps/server/src/scraper/district.ts` now derives its municipality roster from it and unions its
local parish list with the shared one, so the gate and the UI can no longer drift apart.

**Period maths — `packages/api/src/period.ts` (new).** Pure Lisbon-day maths for
`hoje / amanhã / fim-de-semana / 7 dias / 30 dias`, plus `activePreset()` so a shared link lights the
right chip. Weekend window is the Saturday–Sunday of the current-or-next weekend, clipped to today.

**URL state — `apps/web/src/hooks/use-agenda.ts`.** `?q= &concelho= &tipo= &local= &de= &ate= &dia=`.
`pushState` for discrete picks (so back undoes a filter), `replaceState` for the search box (so
typing doesn't flood history), `popstate` listener to restore on back/forward. Date params are shape-
validated; unknown values are ignored. `?dia=YYYY-MM-DD` scrolls to that day group once, after render.

**Chips + copy link — `apps/web/src/components/agenda/filter-bar.tsx`.** The period row is always
visible (not folded behind "mais filtros") because it is the highest-value control. Clicking the lit
chip clears the range. A "Copiar link" button copies `location.href` so the URL state is discoverable
instead of a hidden implementation detail.

**Categories — `apps/server/src/scraper/categories.ts`.** `"Festas"` and `"Atividades ao Ar Livre"`
join the canonical set (our own mappers emit them and they are the two biggest buckets); the 12
observed labels are aliased. `categories_test.ts` gains a drift guard that pins the exact labels the
production DB carried, so the next unmapped synonym fails a test instead of shipping.

**A11y:** event rows get `scroll-mt-16` so a keyboard-focused row no longer lands under the sticky
day header. The chip row is a `<fieldset>` with an `sr-only` legend.

## Verification (real output)

- `bun test` → **342 pass / 0 fail** (was 310; 31 new).
- `pnpm check-types` → 3/3 tasks pass; `vite build` succeeds.
- biome clean on all 12 touched files.
- Playwright against the dev server (`.verify/verify_slice10.py`, `.verify/counts_slice10.py`):

```
unfiltered            "492 eventos nos próximos 90 dias"   72 day groups   492 rows
?concelho=Leiria      183 rows   63 day groups   ← facet says "Leiria (183)"
?concelho=Leiria&de=ate=2026-09-12   13 rows, 1 day group, chip "Hoje" pressed
?concelho=Óbidos&de=2026-09-12&ate=2026-09-18   select=Óbidos, chip "7 dias" pressed
go_back()             ?concelho=Leiria, 9 rows restored
Concelho facet        16 options = "Todos" + 15 municípios, zero freguesias, zero dupes
mobile (390px)        horizontal overflow 0
```

The fold cross-checks exactly: the 15 municípios now total **492**, the same number the unmerged
list showed before — nothing was lost, only relabelled. Masthead now reads **"15 concelhos"**.

## Deferred (filed as issues, untouched here)

Window truncation at 500, add-to-calendar/.ics, PWA/offline, per-event and per-venue pages + SEO
surface, `venues.city` source-level cleanup, image dimensions/CLS, the `.ics` link hardcoded to
`localhost:3301`, ops (deploy traceability + a build-time guard against shipping a write token).

## Follow-ups found while verifying

- Event titles render raw entities (`&#8217;`) in the list.
- `<input type="date">` shows `mm/dd/yy` in the verification browser. `index.html` already sets
  `<html lang="pt">`, so this is Chromium's own locale winning over `lang` — not an app bug, but
  worth a real-device check with a PT locale before deciding anything.
- Council-hosted images (cm-batalha.pt, cm-mgrande.pt) fail with `ERR_BLOCKED_BY_ORB` in Chromium.
