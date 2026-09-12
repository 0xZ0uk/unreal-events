import { savedRoutes } from "@events-tracker/auth";
import { Hono } from "hono";

/**
 * The reader's saved events, on the same origin as the app.
 *
 * A reader's session cookie is first-party (see `api/auth.ts` for why that
 * matters on Safari). The auth DB's read-write token never leaves this
 * function runtime — the browser only ever talks to `/api/saved`.
 */
const app = new Hono().route("/", savedRoutes);

export default {
	fetch: (request: Request) => app.fetch(request),
};
