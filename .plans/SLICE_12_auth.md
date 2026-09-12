# SLICE 12 — Contas de utilizador (better-auth)

Goal: the app gets real user accounts, so the next features (saved events first)
have something to hang off. Email/password + Google, chosen because most people
use the app on a phone.

## Decisions

1. **better-auth 1.7.4**, mounted as **Vercel Functions in this same project** at
   `/api/auth/*` (Hono handler, `api/auth/[[...all]].ts`).
   - Same origin is the point: an auth API on another domain (`api.blugg.pt`)
     gets its cookies treated as third-party by Safari, which breaks sign-in for
     a large share of phone users. Probe deploy confirmed this project builds
     `api/*` functions even though `vercel.json` pins
     `outputDirectory: apps/web/dist`.
2. **Separate Turso database `findleiria-auth`**, credentials only in Vercel
   env. The events DB keeps its read-only token baked into the public bundle —
   so the events token physically cannot read user rows.
3. **New `packages/auth`** owns the better-auth instance, schema, migrations and
   its own DB client. Nothing in `packages/db`, `publish-turso.ts` or the table
   mirror changes.
4. **Own env module** (`packages/auth/src/env.ts`): the auth runtime must not
   depend on `@events-tracker/env/server`, which requires the events
   `DATABASE_URL`/`CORS_ORIGIN` and would tie the auth function to an unrelated DB.
5. **No email sender this slice.** Email/password works without verification
   (`requireEmailVerification: false`), and Google linking stays on so a user who
   later signs in with Google on the same email gets both methods on one account.
   Consequence, accepted: a forgotten password has no self-serve reset. Google is
   the recovery path; a real mailer is its own slice.
6. **Accounts are the shell, not the feature.** This slice ships sign-up,
   sign-in, sign-out, session state, and a guardable UI. Saved events / follows /
   submissions are the next slices and will add their own server routes.

## Steps

1. `packages/auth`: env, libSQL client + drizzle, generated schema, better-auth
   instance, drizzle config, migrations.
2. `api/auth/[[...all]].ts` — Vercel function, Hono + `auth.handler`; root
   `package.json` gains the workspace dep.
3. `apps/server` mounts the same handler under `/api/auth/*` so local dev (Vite on
   :3300 → proxy → Hono :3301) exercises the real code path, and Vite gets an
   `/api` dev proxy.
4. `apps/web`: `better-auth` react client, `/entrar` route (sign in / create
   account + Google), masthead account control, sign-out.
5. Migrations pushed to `findleiria-auth`; Vercel env set; production verification.

## Verification

- `bun test` (auth round-trip against a local libSQL file: sign-up → session →
  sign-in → sign-out), `pnpm check-types`, `biome check`.
- Local end-to-end in a real browser at 390px and desktop: create account, session
  survives reload, sign-out works, Google button redirects to `accounts.google.com`
  with the right `client_id`/`redirect_uri`.
- Production: same checks against `findleiria.vercel.app` (previews sit behind
  Vercel SSO, so previews can't be used for auth).
- Untouched: agenda reads, `/evento/<slug>` pages, prerender output, the cron
  publish path.

## Risks

- Vercel's Node builder must bundle `@events-tracker/auth` + `better-auth` from
  workspace source (`@vercel/nft` following pnpm symlinks). Verified by a probe
  deploy before the real work lands.
- The SPA rewrite (`/(.*)` → `/index.html`) could swallow `/api/auth/*`. Verified
  against production; fallback is excluding `api/` from the rewrite source.
- Without a mailer, one lost password is an unrecoverable account; documented in
  the sign-up copy.

## What shipped

- `packages/auth` — env, libSQL client, hand-written schema (from
  `getAuthTables()` in the installed 1.7.4), better-auth instance, migration.
- `api/auth/[[...all]].ts` + `apps/server` mount — one handler, two runtimes.
- `apps/web` — `/entrar` page (Google + email/password, password reveal, mode
  switch under the form), masthead account control with session-aware menu, and
  `better-auth/react` client with **no `baseURL`**, so `/api/auth` is same-origin
  by construction in dev (Vite proxy) and in production alike.
- Session policy tuned for phones: 30-day expiry, 1-day `updateAge`, signed
  `cookieCache`.
- `getTrustedOrigins()` also trusts the loopback spellings in development only —
  `localhost` and `127.0.0.1` are the same machine but different origins, and
  that difference cost a real `INVALID_ORIGIN` 403. Production stays explicit.

Verified: 8/8 `bun test` (real libSQL round-trip through the Hono handler),
34/34 browser checks at 390px and desktop (Playwright: sign-up → session
survives reload → sign-out → sign-in, wrong password, duplicate email, short
password, ESC closes the menu, tap targets ≥44px, no horizontal overflow,
Google handoff reaching `accounts.google.com`), `tsc --noEmit` clean in
`apps/web` and `packages/auth`, `pnpm build` green with all 585 event pages
prerendered.

## Left before this is live

1. Turso: create `findleiria-auth` (aws-eu-west-1) + a read-write token →
   `AUTH_DATABASE_URL` / `AUTH_DATABASE_TOKEN` in Vercel env (production +
   preview), then `AUTH_DATABASE_URL=… drizzle-kit migrate`.
2. Google Cloud Console: OAuth client with
   `https://findleiria.vercel.app/api/auth/callback/google` on the callback list
   → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Vercel env.
3. `BETTER_AUTH_SECRET` in Vercel env (the local one is a dev secret).
4. Mailer (its own slice) for verification and password reset; until then the
   Google account is the recovery path.
5. Check the built function after the first production deploy: `/api/auth/ok`
   must answer 200 and the SPA rewrite must not swallow `/api/auth/*`.

