import { buildDigest, buildIcs, parseKeywords } from "./digest-core";
import { db, schema } from "@events-tracker/db";
import { desc, eq, isNotNull } from "drizzle-orm";
import { Hono } from "hono";

/**
 * Digest + ICS endpoints (SLICE_3). Logic lives in digest-core.ts so the
 * cron CLI (digest-cli.ts) and these routes share one implementation.
 *
 * GET /digest?since=<epoch>&keyword=a,b,c
 * GET /events.ics?keyword=a,b,c        (RFC 5545 calendar)
 * GET /events.ics?scope=undated        (undated events as plain text)
 */
export const digestRoutes = new Hono();

digestRoutes.get("/digest", async (c) => {
	const sinceParam = c.req.query("since");
	const since = sinceParam ? Number.parseInt(sinceParam, 10) : undefined;
	if (sinceParam && !Number.isFinite(since)) {
		return c.json({ error: "invalid since" }, 400);
	}
	const keywords = parseKeywords(c.req.query("keyword"));
	const digest = await buildDigest({
		...(since != null ? { since } : {}),
		keywords,
	});
	return c.json(digest);
});

digestRoutes.get("/events.ics", async (c) => {
	const keywords = parseKeywords(c.req.query("keyword"));
	const scope = c.req.query("scope") ?? "upcoming";

	if (scope === "undated") {
		const rows = await db
			.select({
				title: schema.events.title,
				date_text: schema.events.date_text,
				venueName: schema.venues.name,
			})
			.from(schema.events)
			.leftJoin(schema.venues, eq(schema.events.venue_id, schema.venues.id))
			.where(isNotNull(schema.events.date_text))
			.orderBy(desc(schema.events.id))
			.limit(500);
		const lines = rows.map(
			(r) => `• ${r.title} — ${r.venueName ?? "—"}${r.date_text ? ` (${r.date_text})` : ""}`,
		);
		return c.text(["Eventos sem data fixa", "", ...lines].join("\n"), 200, {
			"content-type": "text/plain; charset=utf-8",
		});
	}

	const ics = await buildIcs(keywords);
	return c.text(ics, 200, {
		"content-type": "text/calendar; charset=utf-8",
		"content-disposition": 'inline; filename="events.ics"',
	});
});
