import { Hono } from "hono";

import { auth } from "./auth.js";
import { listSavedSlugs, saveEvent, unsaveEvent } from "./saved.js";

const MAX_SLUG_LENGTH = 200;

/**
 * `GET`/`POST /api/saved` — the reader's saved events, on the same origin as
 * the app so the session cookie is a first-party cookie.
 *
 * Written once and mounted by the Vercel function and the dev server, exactly
 * like `authRoutes`. The unsave is a `POST` body flag, not a `DELETE` route, so
 * Vercel's `/api` param expansion (which only matches one segment) needs no
 * rewrite.
 */
export const savedRoutes = new Hono()

	.get("/api/saved", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) return c.json({ error: "unauthorized" }, 401);

		return c.json({ slugs: await listSavedSlugs(session.user.id) });
	})

	.post("/api/saved", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) return c.json({ error: "unauthorized" }, 401);

		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: "invalid" }, 400);
		}

		const { slug, saved } = (body ?? {}) as { slug?: unknown; saved?: unknown };

		if (
			typeof slug !== "string" ||
			slug.trim() === "" ||
			slug.length > MAX_SLUG_LENGTH ||
			typeof saved !== "boolean"
		) {
			return c.json({ error: "invalid" }, 400);
		}

		// Store the slug trimmed so a trailing space never leaves a phantom row.
		const cleanSlug = slug.trim();
		if (saved) await saveEvent(session.user.id, cleanSlug);
		else await unsaveEvent(session.user.id, cleanSlug);

		return c.json({ slug: cleanSlug, saved });
	});
