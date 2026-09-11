import { Hono } from "hono";
import { buildDigest, parseKeywords } from "./digest-core";

/**
 * Digest endpoint (SLICE_3). Logic lives in digest-core.ts so the cron CLI
 * (digest-cli.ts) and this route share one implementation.
 *
 * GET /digest?since=<epoch>&keyword=a,b,c
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
