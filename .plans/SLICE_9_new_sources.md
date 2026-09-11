# SLICE_9 — new source candidates (recon 2026-09-11, all verified live)

Question: which sources can we add that aren't already in the registry?
Current registry (9): leiriagenda, cmleiriarss, bol, eventbrite, viralagenda,
ticketline, festasearraiais, cisterfestas, shotgun.

**Coverage gap:** every district municipality except Leiria (leiriagenda,
cm-leiria RSS) is reachable only through third-party aggregators. No dedicated
source for Alcobaça, Alvaiázere, Ansião, Batalha, Bombarral, Caldas da Rainha,
Castanheira de Pêra, Figueiró dos Vinhos, Marinha Grande, Nazaré, Óbidos,
Pedrógão Grande, Peniche, Pombal. That's the whole gap this slice closes.

## Tier 1 — build now (verified structured, district-wide)

### A. Municipal agendas on the `wm-smile` platform — ONE scraper, 8 concelhos

Shared widget markup (verified live): container `#events_list_<id>`,
items `<a class="linl_overlay" href=…><h4 class="linl_hidden">Title</h4>`,
fields `<div class="widget_label|widget_value">` (date, venue, category),
listing paginated by `?events_list_<id>_page=N&paginating=true`.
No JSON-LD — HTML parse, deterministic. Server-rendered (no JS needed).

| Concelho | Listing path | Detail pattern | Observed volume |
| --- | --- | --- | --- |
| Marinha Grande | `/pages/356` | `/comunicar/eventos/todos-os-eventos/evento/<slug>` | 6/page, 44 pages |
| Nazaré | `/visitar/todos-os-eventos` | `…/evento/<slug>` | 15/page, 71 pages |
| Batalha | `/municipe/comunicacao/agenda-cultural` | `…/evento/<slug>` | 4/page |
| Alvaiázere | `/municipio/comunicacao/eventos` | `…/evento/<slug>` | 12/page, 14 pages |
| Ansião | `/concelho/comunicacao/eventos` | `…/evento/<slug>` | 11/page |
| Peniche | `/visitar/agenda-de-eventos` (categories) | `…/evento-36/<slug>` | 3/page |
| Pedrógão Grande | `/viver/cultura/agenda-de-eventos` | `/evento/46` | variant markup, verify |
| Pombal | `/municipio/comunicacao/agenda-cultural` | folder-based (`folders_list_42_folder_id`) | variant, verify |

Detail pages carry ISO-ish date (`2026/09/26`) + description + venue.
District gate = the site itself (one scraper run per concelho), but keep a
venue/place check for cross-posted events (e.g. Leiria city events on the
Marinha Grande agenda).

### B. Óbidos — agenda.obidos.pt (WordPress + Eventin)

- Discovery: `sitemap.xml` → `etn-sitemap.xml` → **95 event URLs**, `<lastmod>`
  regenerated daily (same incremental trick as festasearraiais).
- Detail: server-rendered `/evento/<slug>/`.
- Dead end: `wp-json/eventin/v2/events` → 401 `rest_forbidden` (auth only).
  `wp-json/` itself is open, useful for nothing else here.
- Why: largest culture program in the district (FOLIO, Festival de Ópera,
  Mercado Medieval, Vila Natal, feiras).

### C. Região de Leiria — "Cartaz" agenda (JSON, no scraping)

- Dates: `GET /api/wp-json/user/events/get-by-month?month=9&year=2026`
  → `[{post_id, date}]` (256 dated rows / 114 unique posts in Sept 2026).
- Content: `GET /api/wp-json/wp/v2/cartaz?include=<ids>` — CPT `cartaz`,
  **6324 posts**, fields incl. `localidade` (taxonomy) and `meta.tipo`
  (e.g. `festa`). REST base is `/api/` for these routes.
- Why: biggest local news outlet; carries parish festas nothing else has.
- Caveat: `localidade` values must be checked against `isLeiriaDistrict`
  before ingest (site covers Leiria + Oeste).

### D. Caldas da Rainha — mcr.pt

- Listing `/agenda?lang=pt&amount=12` (also `/conhecer/agenda-de-eventos`);
  detail `/agenda/<slug>`, server-rendered, HTML.
- Why: UNESCO Creative City, festivals (Festas Adiafas, Bienal de Cerâmica,
  FRUTOS) — only partial coverage via Viral Agenda today.

## Tier 2 — good adds, extra caveats

- **nocartaz.pt** — venue/festival aggregator, **JSON-LD `Event` on pages**,
  venue ring grouped by `data-distrito` (Leiria-district venues observed:
  `cm-nazare-agenda`, `cm-peniche-agenda`, `cultura-pombal-agenda`,
  `agenda-obidos`, `agenda-leiria`, `cine-teatro-alcobaca`,
  `cine-teatro-pombal`, `cineteatro-nazare`, `museu-vidro-marinha-grande`,
  `filarmonica-marinha-grande`, `central-eletrica-peniche`,
  `festival-folio-obidos`, `festival-chocolate-obidos`,
  `nazare-big-wave-challenge`, `bienal-ceramica-caldas`). Caveat: `/eventos/`
  index is JS-driven; venue pages render fine.
- **gazetadascaldas.pt/agenda/** — Caldas weekly paper agenda, HTML, items at
  `/agenda/<id>/`. WP REST open but no event CPT.
- **turismodocentro.pt** — clean public JSON `wp-json/wp/v2/event`, but only
  **~24 Leiria-district events all-time** (Leiria 8, Porto de Mós 4,
  Marinha Grande 3, Alcobaça 2, Batalha 2, rest 1). Cheap overflow source.
- **figueirodosvinhos**: Joomla `com_djevents` with a real
  `listar-agenda-rss/details/<date>/<id>-<slug>` feed + monthly PDF agenda.
- **bombarral / castanheira de pêra**: sites live, sitemap present — agenda
  path not yet located.
- **aondevamos.pt** — national agenda with distrito/concelho filters
  (`avLoadConcelhos`, admin-ajax). Medium effort.
- **uniaodeleiria.pt** — UD Leiria fixtures (category `Desporto` exists);
  structure unverified.
- **teatrostephens.cm-mgrande.pt** — Marinha Grande's main venue; already
  reachable through the MG municipal agenda (add only if the agenda misses it).

## Ruled out — dead ends, don't revisit

- Meetup: no Leiria events (page has 1 "leiria" mention, no listings).
- blueticket.meo.pt: every URL (incl. robots.txt/sitemap.xml) returns the
  Queue-it wall — browser session required. Ticketing already covered by BOL +
  Ticketline.
- ra.co/events/pt, patrimoniocultural.gov.pt/pt/agenda: Cloudflare 403.
- Wrong domains: `cm-marinhagrande.pt` → `cm-mgrande.pt`;
  `cm-caldas-rainha.pt` / `cmcr.pt` → `mcr.pt`; `tjls.pt` → `teatrojlsilva.pt`.
- `expoleiria.pt`, `obidoscriativa.pt` (parked), `calendarios.sapo.pt` (dead).
- cm-leiria.pt `/cultura/eventos` — mirrors leiriagenda (existing source).
- teatrojlsilva.pt — TJLS is a leiriagenda promoter; near-total duplicate.
- jornaldeleiria.pt (no WP REST/agenda), diarioleiria.pt (REST 401).
- ipl.leiria /eventos — no event listing.

## Proposed build order

1. `municipal-wmsmile` (Marinha Grande, Nazaré, Batalha, Alvaiázere, Ansião,
   Peniche, Pedrógão Grande, Pombal) — highest yield, one parser.
2. `obidos-agenda` (etn-sitemap + detail HTML).
3. `regiaoleiria-cartaz` (JSON, lowest effort).
4. `caldas-mcr` (HTML) + `gazetadascaldas` (Caldas depth).

Dedupe: all new sources get low `TIME_SOURCE_PRIORITY` so existing sources keep
winning on time fields; expect overlap with viralagenda/festasearraiais on
festas — fingerprint handles it.
