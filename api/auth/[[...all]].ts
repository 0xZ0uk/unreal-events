import { authRoutes } from "@events-tracker/auth";
import { Hono } from "hono";

/**
 * Every auth endpoint, on the same origin as the app.
 *
 * Same origin is not a preference: cookies from a separate API domain are
 * third-party cookies, which Safari refuses — and most people here arrive on an
 * iPhone. Vercel's Node.js runtime accepts a Web-standard `fetch` export, so no
 * adapter is needed.
 */
const app = new Hono().route("/", authRoutes);

export default {
	fetch: (request: Request) => app.fetch(request),
};
