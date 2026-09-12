import type { createBrowserDb } from "@events-tracker/db/browser";

type BrowserDb = ReturnType<typeof createBrowserDb>;

/**
 * Shared tRPC context (SLICE_8). The drizzle handle is injected by each caller
 * — the Hono server passes its server db, the web SPA its in-browser libSQL
 * client — never imported as a module singleton. That keeps the router code
 * importable (and executable) in the browser without dragging in
 * dotenv/process.env and making it server-only.
 */
export type Context = {
	db: BrowserDb;
	auth: null;
	session: null;
};

/** Build a context from an injected db handle (browser or server alike). */
export function createContext(db: BrowserDb): Context {
	return { db, auth: null, session: null };
}
