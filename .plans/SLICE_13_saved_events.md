# SLICE 13 — Saved events

Goal: a signed-in reader can save an event and see their saved events on one page.
Navigation follows the reader's device: top nav on desktop, bottom tab bar on
mobile, with the wordmark still at the top of the page on every breakpoint.

## Locked decisions

- **Saved events live in the auth database** (`findleiria-auth`), table
  `saved_event`. The events database is mirrored to a Turso token that is baked
  into the browser bundle, so user data must never live there. The events DB,
  `publish-turso.ts`, and the table mirror are untouched by this slice.
- **All writes go through a same-origin Vercel function.** The auth DB's
  read-write token never leaves the function runtime; the browser talks to
  `/api/saved` and nothing else.
- **Event details stay a client-side read** (`eventsBySlugs` on the existing
  browser libSQL client), so the saved page reuses the agenda's row shape and
  formatting instead of a second server-side projection.
- **One single-segment API route**, `GET`/`POST /api/saved`. Slice 12 proved
  Vercel's `/api` param expansion only matches one segment; a single route with
  the action in the body needs no rewrite and no routing gamble.
- **Unsave is `POST { saved: false }`** — no `DELETE` route, no path segment
  carrying an id.
- **No event snapshots.** The mirror keeps past events, so a saved slug stays
  hydratable after the date passes. A slug that no longer resolves renders as a
  muted "já não está disponível" row with a remove action — honest, not blank.
- **Saving requires an account.** Signed out, the save control is a link to
  `/entrar?redirect=<where you were>`; no silent failure, no local-only saves.
- **Mobile account actions move into the bottom bar.** The header keeps the
  wordmark (and the theme toggle); the desktop `AccountMenu` dropdown is hidden
  below `sm` and the bottom bar's Conta tab owns sign-out on phones.

## Interfaces (frozen — build against these, do not rename)

### `packages/auth/src/schema.ts`

```ts
export const savedEvent = sqliteTable(
  "saved_event",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventSlug: text("event_slug").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("saved_event_user_slug_idx").on(table.userId, table.eventSlug),
    index("saved_event_user_idx").on(table.userId),
  ],
);
```

Migration: `bun x drizzle-kit generate` (from `packages/auth`, needs
`AUTH_DATABASE_URL` for the dialect config only) → commit the generated
`src/migrations/0001_*.sql` + `meta/0001_snapshot.json` + journal. Do not
hand-write or hand-edit SQL.

### `packages/auth/src/saved.ts` (logic, exported from `index.ts`)

```ts
export async function listSavedSlugs(userId: string): Promise<string[]>; // newest first
export async function saveEvent(userId: string, slug: string): Promise<void>;   // idempotent
export async function unsaveEvent(userId: string, slug: string): Promise<void>; // idempotent
```

Use `crypto.randomUUID()` for the id, `new Date()` for `createdAt`, and the
existing `authDb` from `db.js`. Imports need `.js` specifiers (ESM emit).

### `packages/auth/src/saved-routes.ts` (shared handler)

```ts
export const savedRoutes: Hono; // GET + POST /api/saved
```

- Session: `auth.api.getSession({ headers: c.req.raw.headers })`. No session →
  `401 { error: "unauthorized" }`.
- `GET` → `200 { slugs: string[] }`
- `POST` body `{ slug: string, saved: boolean }` → `200 { slug, saved }`;
  body invalid (not JSON, missing/blank slug, slug > 200 chars, non-boolean
  `saved`) → `400 { error: "invalid" }`.
- Written once and mounted by both `api/saved.ts` and the dev server, exactly
  like `authRoutes`.

### `api/saved.ts` (Vercel function)

Same shape as `api/auth.ts`: a Hono app, `export default { fetch }`. Mounts
`savedRoutes`. No `vercel.json` change is needed.

### `apps/server/src/index.ts`

Mount `savedRoutes` alongside the existing auth routes so local dev exercises
the same handler.

### `packages/api/src/queries/events.ts`

```ts
export async function eventsBySlugs(db: Db, slugs: string[]): Promise<PublicEvent[]>;
```

`inArray(schema.events.slug, slugs)`, `rows.map(toPublicEvent)`, ordered by
`start_at`. **No same-day session merging** — each saved slug keeps its own
identity, unlike the agenda. Empty `slugs` → `[]` with no query.

### `apps/web/src/utils/route.ts`

`/guardados` → `{ kind: "saved" }`; add `savedHref()` returning `/guardados`.
Update `route_test.ts`.

### `apps/web/src/utils/saved-client.ts`

```ts
export function listSaved(): Promise<string[]>;              // GET  /api/saved
export function setSaved(slug: string, saved: boolean): Promise<void>; // POST
```

`fetch(..., { credentials: "include" })`, throws on non-OK.

### `apps/web/src/hooks/use-saved.ts`

```ts
export function useSaved(): {
  slugs: Set<string>;
  isSaved(slug: string): boolean;
  pending: boolean;
  toggle(slug: string): void;
  signedIn: boolean;
  ready: boolean;
};
```

react-query: `queryKey: ["saved"]`, enabled only when a session exists;
mutation with an optimistic update and rollback on error; a 401 invalidates the
session query rather than retrying.

### Components

- `apps/web/src/components/saved/save-button.tsx` —
  `<SaveButton slug={string} layout={"row" | "detail"} />`. Labelled
  "Guardar" / "Guardado", `aria-pressed`, ≥44px on phones (`h-11 sm:h-10`).
  Signed out: a link to `signInHref(currentPath)`.
- `apps/web/src/components/saved/saved-page.tsx` — `<SavedPage />`. Signed out:
  a short prompt + sign-in CTA that returns to `/guardados`. Signed in: slugs →
  `eventsBySlugs(db, slugs)` → upcoming first, then past; each row links to the
  event page; unresolvable slugs render muted with a remove action; nothing
  saved → a real empty state.
- `apps/web/src/components/nav/nav-bar.tsx` — `<TopNav />` (hidden below `sm`,
  inline links in the masthead row) and `<BottomNav />` (`sm:hidden`, fixed to
  the bottom, `env(safe-area-inset-bottom)` padding, tabs: Agenda `/`,
  Guardados `/guardados`, Conta). Conta is a link to `/entrar` when signed out
  and an inline sheet (name, email, "Terminar sessão") when signed in. Active
  tab in amber, targets ≥44px.
- `components/agenda/masthead.tsx` — mount `<TopNav />` for desktop; the
  `AccountMenu` becomes `hidden sm:flex`; the wordmark stays at the top on every
  breakpoint.
- `app.tsx` — route `saved` → `<SavedPage />`; mount the nav once at the app
  level for agenda/saved/event routes (not on the sign-in page). Give the shell
  `pb-20 sm:pb-0` so the fixed bar never covers the footer.
- `SaveButton` appears on event rows (`components/agenda/event-row.tsx`) and on
  the event page (`components/event/event-page.tsx`).

## Conventions

- Portuguese copy, sentence case, no marketing voice.
- Biome: tabs, double quotes. Format only the files you touch
  (`biome check --write <paths>`); never run a repo-wide format.
- Comments explain *why*, in the existing voice. No comment restating the code.
- No `as any`; types come from the shared packages.
- Do not touch the events DB, `publish-turso.ts`, `packages/db`, or `vercel.json`.

## Acceptance

1. `bun test` green in `packages/auth` and `packages/api` (new tests included).
2. `npx tsc --noEmit` clean in `packages/auth`, `packages/api`, `apps/web`.
3. `pnpm --filter ./apps/web build` exits 0.
4. A local round trip works: sign in (dev file DB) → save a slug → `GET
   /api/saved` returns it → unsave → empty.
5. Real-browser check at 390px and 1440px: bottom bar on mobile with the
   wordmark still on top, top nav on desktop, save button toggling, saved page
   listing the event.
6. Production: migration applied to `findleiria-auth`, deployed, and
   `GET /api/saved` verified against the live site with a real session cookie.
